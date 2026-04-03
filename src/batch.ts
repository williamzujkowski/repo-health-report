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
 *   node dist/batch.js --file data/curated-repos.txt --parallel 3 --incremental --skip-docs
 */

import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import chalk from "chalk";
import {
  parseRepoSlug,
  fetchRepoMeta,
  fetchRepoMetaGraphQL,
  fetchRepoTree,
  detectProjectType,
  detectRepoSize,
  normalizeLanguage,
  detectAllLanguages,
  type RepoMeta,
  type LanguageBreakdown,
} from "./analyze.js";
import { analyzeSecurityDimension } from "./dimensions/security.js";
import { analyzeTestingDimension } from "./dimensions/testing.js";
import { analyzeDocsDimension } from "./dimensions/docs.js";
import { analyzeArchitectureDimension } from "./dimensions/architecture.js";
import { analyzeDevOpsDimension } from "./dimensions/devops.js";
import { analyzeMaintenanceDimension } from "./dimensions/maintenance.js";
import { computeGrade, type GradeResult } from "./grader.js";
import { RepoCache } from "./cache.js";
import type { ProjectType, RepoSizeTier } from "./analyze.js";
import { detectAiContributors } from "./ai-contributors.js";
import type { AiContributorResult } from "./ai-contributors.js";

const TOOL_VERSION = "1.0.0";
const DATA_DIR = join(process.cwd(), "data");
const REPORTS_DIR = join(DATA_DIR, "reports");
const INDEX_PATH = join(DATA_DIR, "index.json");
const MAX_PARALLEL = 5;

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

export interface BatchArgs {
  count: number;
  delay: number;
  file: string | null;
  parallel: number;
  incremental: boolean;
  skipDocs: boolean;
  detectAi: boolean;
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

export interface BatchReport {
  repo: string;
  letter: string;
  overall: number;
  graded: boolean;
  dimensions: GradeResult["dimensions"];
  totalDurationMs: number;
  projectType: ProjectType;
  sizeTier: RepoSizeTier;
  language: string | null;
  analyzedAt: string;
  toolVersion: string;
  detectorVersion: string;
  checkCounts: DimensionCheckCount[];
  // Enriched metadata fields from GraphQL (present when GraphQL fetch succeeds)
  forks_count?: number;
  topics?: string[];
  has_discussions?: boolean;
  has_projects?: boolean;
  pushed_at?: string;
  created_at?: string;
  size?: number;
  // Multi-language breakdown (always present)
  languages?: LanguageBreakdown;
  // AI contributor detection (present when --detect-ai is used)
  aiContributors?: AiContributorResult;
}

interface BatchStats {
  analyzed: number;
  skippedExisting: number;
  skippedDoc: number;
  skippedUnchanged: number;
  failed: number;
}

function parseArgs(argv: string[]): BatchArgs {
  let count = 50;
  let delay = 2000;
  let file: string | null = null;
  let parallel = 1;
  let incremental = false;
  let skipDocs = false;
  let detectAi = false;

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
    } else if ((arg === "--parallel" || arg === "-p") && argv[i + 1]) {
      parallel = parseInt(argv[++i], 10);
      if (isNaN(parallel) || parallel < 1) {
        throw new Error("--parallel must be a positive integer");
      }
      if (parallel > MAX_PARALLEL) {
        console.log(chalk.yellow(`  Warning: clamping --parallel to max ${MAX_PARALLEL}`));
        parallel = MAX_PARALLEL;
      }
    } else if (arg === "--incremental" || arg === "-i") {
      incremental = true;
    } else if (arg === "--skip-docs") {
      skipDocs = true;
    } else if (arg === "--detect-ai") {
      detectAi = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
${chalk.bold("repo-health-report batch")} - Analyze many repos at once

${chalk.bold("Usage:")}
  node dist/batch.js --count 50           Analyze top 50 repos by stars
  node dist/batch.js --file repos.txt     Analyze repos from file (one slug per line)

${chalk.bold("Options:")}
  --count <n>       Number of top repos to fetch (default: 50)
  --delay <ms>      Delay between batches in ms (default: 2000)
  --file <path>     Read repo slugs from file instead of GitHub search
  --parallel <n>    Process N repos concurrently (default: 1, max: ${MAX_PARALLEL})
  -p <n>            Alias for --parallel
  --incremental     Skip repos that haven't changed since last analysis
  -i                Alias for --incremental
  --skip-docs       Skip repos cached as documentation/mirror type
  --detect-ai       Detect AI agent and automation bot contributors (extra API calls)
  --help, -h        Show this help
`);
      process.exit(0);
    }
  }

  return { count, delay, file, parallel, incremental, skipDocs, detectAi };
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
 * Lightweight pushed_at check via REST (single small request).
 * Returns the pushed_at timestamp or undefined on failure.
 */
async function fetchPushedAt(slug: string): Promise<string | undefined> {
  try {
    const { ghApi } = await import("./analyze.js");
    const data = await ghApi<{ pushed_at?: string }>(
      `/repos/${slug}`,
      { paginate: false }
    );
    return data.pushed_at ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Analyze a single repo and return the structured report.
 */
export async function analyzeRepo(
  slug: string,
  detectAi = false
): Promise<{ report: BatchReport; meta: RepoMeta; type: ProjectType }> {
  const validSlug = parseRepoSlug(slug);
  // Try GraphQL first (enriched metadata in one request), fall back to REST
  let meta: RepoMeta;
  try {
    meta = await fetchRepoMetaGraphQL(validSlug);
  } catch {
    meta = await fetchRepoMeta(validSlug);
  }
  const tree = await fetchRepoTree(validSlug, meta.default_branch);
  const projectType = detectProjectType(tree, validSlug, meta);
  const sizeTier = detectRepoSize(tree);
  const language = normalizeLanguage(meta.language, tree);
  const languages = detectAllLanguages(tree, meta.language);

  const dimensionResults = await Promise.all([
    analyzeSecurityDimension(tree, meta, validSlug),
    analyzeTestingDimension(tree, meta, validSlug, projectType),
    analyzeDocsDimension(tree, meta, validSlug),
    analyzeArchitectureDimension(tree, meta, validSlug, projectType, language),
    analyzeDevOpsDimension(tree, meta, validSlug, projectType),
    analyzeMaintenanceDimension(tree, meta, validSlug),
  ]);

  const grade = computeGrade(dimensionResults, projectType, sizeTier);
  const analyzedAt = new Date().toISOString();
  const detectorVersion = await computeDetectorVersion();

  const checkCounts: DimensionCheckCount[] = dimensionResults.map((d) => ({
    name: d.name,
    checkCount: d.findings.length,
  }));

  // Optional: detect AI contributors (opt-in, extra API calls)
  let aiContributors: AiContributorResult | undefined;
  if (detectAi) {
    try {
      aiContributors = await detectAiContributors(validSlug);
    } catch {
      // non-fatal — continue without AI contributor data
    }
  }

  const report: BatchReport = {
    repo: validSlug,
    letter: grade.letter,
    overall: grade.overall,
    graded: grade.graded,
    dimensions: grade.dimensions,
    totalDurationMs: grade.totalDurationMs,
    projectType,
    sizeTier,
    language: meta.language,
    analyzedAt,
    toolVersion: TOOL_VERSION,
    detectorVersion,
    checkCounts,
    languages,
    // Enriched fields — present when GraphQL fetch succeeded
    ...(meta.forks_count !== undefined ? { forks_count: meta.forks_count } : {}),
    ...(meta.topics !== undefined ? { topics: meta.topics } : {}),
    ...(meta.has_discussions !== undefined ? { has_discussions: meta.has_discussions } : {}),
    ...(meta.has_projects !== undefined ? { has_projects: meta.has_projects } : {}),
    ...(meta.pushed_at !== undefined ? { pushed_at: meta.pushed_at } : {}),
    ...(meta.created_at !== undefined ? { created_at: meta.created_at } : {}),
    ...(meta.size !== undefined ? { size: meta.size } : {}),
    // AI contributor detection (present when --detect-ai is used)
    ...(aiContributors !== undefined ? { aiContributors } : {}),
  };

  return { report, meta, type: projectType };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a batch of repos with configurable concurrency and cache awareness.
 */
async function processBatch(
  slugs: string[],
  args: BatchArgs,
  cache: RepoCache,
): Promise<{ index: IndexEntry[]; stats: BatchStats }> {
  const index: IndexEntry[] = [];
  const stats: BatchStats = {
    analyzed: 0,
    skippedExisting: 0,
    skippedDoc: 0,
    skippedUnchanged: 0,
    failed: 0,
  };

  const total = slugs.length;

  for (let i = 0; i < total; i += args.parallel) {
    const batch = slugs.slice(i, i + args.parallel);

    const results = await Promise.allSettled(
      batch.map(async (slug, batchIdx) => {
        const globalIdx = i + batchIdx;
        const prefix = `  [${globalIdx + 1}/${total}]`;

        // 1. Skip repos with existing reports (resume support, same as before)
        if (await hasExistingReport(slug)) {
          stats.skippedExisting++;
          console.log(chalk.gray(`${prefix} Skipping ${slug} (report exists)`));
          return null;
        }

        // 2. Skip cached documentation/mirror repos
        if (args.skipDocs && cache.isDocRepo(slug)) {
          stats.skippedDoc++;
          console.log(chalk.gray(`${prefix} Skipping ${slug} (cached as doc/mirror)`));
          return null;
        }

        // 3. Incremental: check if repo changed since last analysis
        if (args.incremental) {
          const pushedAt = await fetchPushedAt(slug);
          if (!cache.needsReanalysis(slug, pushedAt)) {
            stats.skippedUnchanged++;
            console.log(chalk.gray(`${prefix} Skipping ${slug} (unchanged since last analysis)`));
            return null;
          }
        }

        // 4. Full analysis
        console.log(chalk.cyan(`${prefix} Analyzing ${slug}...`));

        const { report, type } = await analyzeRepo(slug, args.detectAi);

        // Write the report
        const filePath = reportPath(slug, report.analyzedAt);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");

        // Update cache
        if (type === "documentation" || type === "mirror") {
          cache.addDocRepo(slug);
        }
        cache.setMeta(slug, {
          pushedAt: report.pushed_at ?? "",
          analyzedAt: report.analyzedAt,
          projectType: type,
          score: report.overall,
        });

        // Build index entry
        const relPath = filePath
          .replace(DATA_DIR + "/", "")
          .replace(DATA_DIR + "\\", "");

        console.log(
          chalk.green(
            `    Grade: ${report.letter} (${report.overall}/100) in ${(report.totalDurationMs / 1000).toFixed(1)}s`
          )
        );

        return {
          slug: report.repo,
          grade: report.letter,
          score: report.overall,
          type,
          language: report.language,
          reportPath: relPath,
          analyzedAt: report.analyzedAt,
        } satisfies IndexEntry;
      })
    );

    // Collect results
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        if (result.value !== null) {
          index.push(result.value);
          stats.analyzed++;
        }
      } else {
        stats.failed++;
        const slug = batch[j];
        console.error(chalk.red(`    Failed ${slug}: ${result.reason}`));
      }
    }

    // Rate limit delay between batches (skip after last batch)
    if (i + args.parallel < total && args.delay > 0) {
      await sleep(args.delay);
    }
  }

  return { index, stats };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Load cache
  const cache = new RepoCache();
  await cache.load();

  if (args.skipDocs || args.incremental) {
    const parts: string[] = [];
    if (args.skipDocs) parts.push(`${cache.docRepoCount} cached doc repos`);
    if (args.incremental) parts.push(`${cache.metaCacheCount} cached metadata entries`);
    console.log(chalk.gray(`  Cache loaded: ${parts.join(", ")}`));
  }

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

  const modeInfo: string[] = [];
  if (args.parallel > 1) modeInfo.push(`parallel=${args.parallel}`);
  if (args.incremental) modeInfo.push("incremental");
  if (args.skipDocs) modeInfo.push("skip-docs");
  if (args.detectAi) modeInfo.push("detect-ai");
  const modeStr = modeInfo.length > 0 ? ` (${modeInfo.join(", ")})` : "";

  console.log(
    chalk.bold(`\n  Found ${slugs.length} repos to analyze${modeStr}\n`)
  );

  // Process all repos
  const { index, stats } = await processBatch(slugs, args, cache);

  // Save cache (always, so new doc repos and metadata are persisted)
  await cache.save();

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
  const parts: string[] = [`${stats.analyzed} analyzed`];
  if (stats.skippedExisting > 0) parts.push(`${stats.skippedExisting} skipped (existing)`);
  if (stats.skippedDoc > 0) parts.push(`${stats.skippedDoc} skipped (doc/mirror)`);
  if (stats.skippedUnchanged > 0) parts.push(`${stats.skippedUnchanged} skipped (unchanged)`);
  if (stats.failed > 0) parts.push(`${stats.failed} failed`);

  console.log(
    chalk.bold(`\n  Batch complete: ${parts.join(", ")}\n`)
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

// Only run main when executed directly (not when imported)
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("batch.js") || process.argv[1].endsWith("batch.ts"));

if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(chalk.red(`Fatal: ${(err as Error).message}`));
    process.exit(1);
  });
}
