#!/usr/bin/env node

/**
 * Batch runner for repo-health-report.
 *
 * Fetches top N repos from GitHub by stars (or reads from a file),
 * runs analysis on each, and stores structured JSON results.
 *
 * Usage:
 *   node dist/batch.js --count 50 --delay 2000
 *   node dist/batch.js --file data/curated-repos.txt
 *   node dist/batch.js --file data/curated-repos.txt --delay 3000
 */

import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import chalk from "chalk";
import {
  parseRepoSlug,
  fetchRepoMeta,
  fetchRepoTree,
  detectProjectType,
  normalizeLanguage,
  type RepoMeta,
} from "./analyze.js";
import { analyzeSecurityDimension } from "./dimensions/security.js";
import { analyzeTestingDimension } from "./dimensions/testing.js";
import { analyzeDocsDimension } from "./dimensions/docs.js";
import { analyzeArchitectureDimension } from "./dimensions/architecture.js";
import { analyzeDevOpsDimension } from "./dimensions/devops.js";
import { analyzeMaintenanceDimension } from "./dimensions/maintenance.js";
import { computeGrade, type GradeResult } from "./grader.js";
import type { ProjectType } from "./analyze.js";

const TOOL_VERSION = "1.0.0";
const DATA_DIR = join(process.cwd(), "data");
const REPORTS_DIR = join(DATA_DIR, "reports");
const INDEX_PATH = join(DATA_DIR, "index.json");

/**
 * Compute a short SHA-256 hash of detectors.ts source for audit trail.
 * Tracks when detection logic changes between batch runs.
 */
async function computeDetectorVersion(): Promise<string> {
  try {
    const detectorsPath = join(dirname(new URL(import.meta.url).pathname), "detectors.js");
    const source = await readFile(detectorsPath, "utf-8");
    return createHash("sha256").update(source).digest("hex").slice(0, 12);
  } catch {
    return "unknown";
  }
}

interface BatchArgs {
  count: number;
  delay: number;
  file: string | null;
}

interface IndexEntry {
  slug: string;
  grade: string;
  score: number;
  type: ProjectType;
  language: string | null;
  reportPath: string;
  analyzedAt: string;
}

interface DimensionCheckCount {
  name: string;
  checkCount: number;
}

interface BatchReport {
  repo: string;
  letter: string;
  overall: number;
  dimensions: GradeResult["dimensions"];
  totalDurationMs: number;
  projectType: ProjectType;
  language: string | null;
  analyzedAt: string;
  toolVersion: string;
  detectorVersion: string;
  checkCounts: DimensionCheckCount[];
}

function parseArgs(argv: string[]): BatchArgs {
  let count = 50;
  let delay = 2000;
  let file: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--count" && argv[i + 1]) {
      count = parseInt(argv[++i], 10);
      if (isNaN(count) || count < 1) {
        throw new Error("--count must be a positive integer");
      }
    } else if (arg === "--delay" && argv[i + 1]) {
      delay = parseInt(argv[++i], 10);
      if (isNaN(delay) || delay < 0) {
        throw new Error("--delay must be a non-negative integer (ms)");
      }
    } else if (arg === "--file" && argv[i + 1]) {
      file = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
${chalk.bold("repo-health-report batch")} - Analyze many repos at once

${chalk.bold("Usage:")}
  node dist/batch.js --count 50           Analyze top 50 repos by stars
  node dist/batch.js --file repos.txt     Analyze repos from file (one slug per line)

${chalk.bold("Options:")}
  --count <n>     Number of top repos to fetch (default: 50)
  --delay <ms>    Delay between repos in ms (default: 2000)
  --file <path>   Read repo slugs from file instead of GitHub search
  --help, -h      Show this help
`);
      process.exit(0);
    }
  }

  return { count, delay, file };
}

/**
 * Fetch top repos from GitHub by star count.
 */
async function fetchTopRepos(count: number): Promise<string[]> {
  const { ghApi } = await import("./analyze.js");
  const perPage = Math.min(count, 100);
  const pages = Math.ceil(count / perPage);
  const slugs: string[] = [];

  for (let page = 1; page <= pages && slugs.length < count; page++) {
    const endpoint =
      `/search/repositories?q=stars:>10000&sort=stars&per_page=${perPage}&page=${page}`;
    const result = await ghApi<{
      items: Array<{ full_name: string }>;
    }>(endpoint);
    for (const item of result.items) {
      if (slugs.length < count) {
        slugs.push(item.full_name);
      }
    }
  }

  return slugs;
}

/**
 * Read repo slugs from a text file (one per line, # comments allowed).
 */
async function readRepoFile(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Sanitize a slug for use as a filesystem path.
 */
function sanitizeForPath(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

/**
 * Build the report file path for a given slug and timestamp.
 */
function reportPath(slug: string, timestamp: string): string {
  const safe = sanitizeForPath(slug);
  const [owner, repo] = safe.split("/");
  const filename = `${timestamp.replace(/:/g, "-")}.json`;
  return join(REPORTS_DIR, owner, repo, filename);
}

/**
 * Check whether a report already exists for a slug (any timestamp).
 */
async function hasExistingReport(slug: string): Promise<boolean> {
  const safe = sanitizeForPath(slug);
  const [owner, repo] = safe.split("/");
  const dir = join(REPORTS_DIR, owner, repo);
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Analyze a single repo and return the structured report.
 */
async function analyzeRepo(
  slug: string
): Promise<{ report: BatchReport; meta: RepoMeta; type: ProjectType }> {
  const validSlug = parseRepoSlug(slug);
  const meta = await fetchRepoMeta(validSlug);
  const tree = await fetchRepoTree(validSlug, meta.default_branch);
  const projectType = detectProjectType(tree, validSlug);
  const language = normalizeLanguage(meta.language);

  const dimensionResults = await Promise.all([
    analyzeSecurityDimension(tree, meta, validSlug),
    analyzeTestingDimension(tree, meta, validSlug, projectType),
    analyzeDocsDimension(tree, meta, validSlug),
    analyzeArchitectureDimension(tree, meta, validSlug, projectType, language),
    analyzeDevOpsDimension(tree, meta, validSlug, projectType),
    analyzeMaintenanceDimension(tree, meta, validSlug),
  ]);

  const grade = computeGrade(dimensionResults);
  const analyzedAt = new Date().toISOString();
  const detectorVersion = await computeDetectorVersion();

  const checkCounts: DimensionCheckCount[] = dimensionResults.map((d) => ({
    name: d.name,
    checkCount: d.findings.length,
  }));

  const report: BatchReport = {
    repo: validSlug,
    letter: grade.letter,
    overall: grade.overall,
    dimensions: grade.dimensions,
    totalDurationMs: grade.totalDurationMs,
    projectType,
    language: meta.language,
    analyzedAt,
    toolVersion: TOOL_VERSION,
    detectorVersion,
    checkCounts,
  };

  return { report, meta, type: projectType };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Get the list of repos
  let slugs: string[];
  if (args.file) {
    console.log(chalk.gray(`  Reading repos from ${args.file}...`));
    slugs = await readRepoFile(args.file);
  } else {
    console.log(
      chalk.gray(`  Fetching top ${args.count} repos by stars...`)
    );
    slugs = await fetchTopRepos(args.count);
  }

  console.log(
    chalk.bold(`\n  Found ${slugs.length} repos to analyze\n`)
  );

  const index: IndexEntry[] = [];
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];

    // Resume support: skip repos with existing reports
    if (await hasExistingReport(slug)) {
      skipped++;
      console.log(
        chalk.gray(
          `  [${i + 1}/${slugs.length}] Skipping ${slug} (report exists)`
        )
      );
      continue;
    }

    console.log(
      chalk.cyan(
        `  Analyzing ${i + 1}/${slugs.length}: ${slug}...`
      )
    );

    try {
      const { report, type } = await analyzeRepo(slug);

      // Write the report
      const filePath = reportPath(slug, report.analyzedAt);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");

      // Build index entry
      const relPath = filePath
        .replace(DATA_DIR + "/", "")
        .replace(DATA_DIR + "\\", "");
      index.push({
        slug: report.repo,
        grade: report.letter,
        score: report.overall,
        type,
        language: report.language,
        reportPath: relPath,
        analyzedAt: report.analyzedAt,
      });

      succeeded++;
      console.log(
        chalk.green(
          `    Grade: ${report.letter} (${report.overall}/100) in ${(report.totalDurationMs / 1000).toFixed(1)}s`
        )
      );
    } catch (err) {
      failed++;
      console.error(
        chalk.red(
          `    Failed: ${(err as Error).message}`
        )
      );
    }

    // Rate limit delay (skip on last iteration)
    if (i < slugs.length - 1 && args.delay > 0) {
      await sleep(args.delay);
    }
  }

  // Write index
  if (index.length > 0) {
    await mkdir(DATA_DIR, { recursive: true });
    const existingIndex = await loadExistingIndex();
    const merged = mergeIndex(existingIndex, index);
    await writeFile(INDEX_PATH, JSON.stringify({ repos: merged }, null, 2), "utf-8");
    console.log(
      chalk.gray(`\n  Index written to ${INDEX_PATH}`)
    );
  }

  // Summary
  console.log(
    chalk.bold(`\n  Batch complete: ${succeeded} analyzed, ${skipped} skipped, ${failed} failed\n`)
  );
}

/**
 * Load existing index.json if present.
 */
async function loadExistingIndex(): Promise<IndexEntry[]> {
  try {
    const content = await readFile(INDEX_PATH, "utf-8");
    const data = JSON.parse(content) as { repos: IndexEntry[] };
    return data.repos;
  } catch {
    return [];
  }
}

/**
 * Merge new index entries with existing ones (newer wins per slug).
 */
function mergeIndex(
  existing: IndexEntry[],
  incoming: IndexEntry[]
): IndexEntry[] {
  const map = new Map<string, IndexEntry>();
  for (const entry of existing) {
    map.set(entry.slug, entry);
  }
  for (const entry of incoming) {
    map.set(entry.slug, entry);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );
}

main().catch((err: unknown) => {
  console.error(chalk.red(`Fatal: ${(err as Error).message}`));
  process.exit(1);
});
