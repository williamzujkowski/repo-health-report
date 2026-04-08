#!/usr/bin/env node

/**
 * Trend snapshot generator for repo-health-report.
 *
 * Analyzes repos from a curated list and produces a compact monthly
 * JSON snapshot with only scores (no findings). Designed to be
 * committed to git for historical tracking.
 *
 * Usage:
 *   node dist/trend.js --input data/curated-repos.txt --output data/trends/2026-04.json
 *   node dist/trend.js --input data/curated-repos.txt  # defaults to data/trends/YYYY-MM.json
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import chalk from "chalk";
import { analyzeRepo, sleep } from "./batch.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TrendRepoEntry {
  slug: string;
  score: number;
  letter: string;
  dimensions: Record<string, number>;
  error?: string;
}

export interface TrendSnapshot {
  meta: {
    month: string;
    generated: string;
    totalRepos: number;
    successCount: number;
    failCount: number;
  };
  repos: TrendRepoEntry[];
}

// ── Args ───────────────────────────────────────────────────────────────────

interface TrendArgs {
  input: string;
  output: string;
  delay: number;
  parallel: number;
}

function parseArgs(argv: string[]): TrendArgs {
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let input = "data/curated-repos.txt";
  let output = `data/trends/${defaultMonth}.json`;
  let delay = 3000;
  let parallel = 2;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      input = argv[++i];
    } else if (arg === "--output" && argv[i + 1]) {
      output = argv[++i];
    } else if (arg === "--delay" && argv[i + 1]) {
      delay = parseInt(argv[++i], 10);
    } else if (arg === "--parallel" && argv[i + 1]) {
      parallel = Math.min(parseInt(argv[++i], 10), 3);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
${chalk.bold("repo-health-report trend")} — Generate monthly trend snapshot

${chalk.bold("Usage:")}
  node dist/trend.js --input data/curated-repos.txt
  node dist/trend.js --output data/trends/2026-04.json

${chalk.bold("Options:")}
  --input <file>     Repo list file (default: data/curated-repos.txt)
  --output <file>    Output JSON path (default: data/trends/YYYY-MM.json)
  --delay <ms>       Delay between batches (default: 3000)
  --parallel <n>     Concurrent repos (default: 2, max: 3)
  --help, -h         Show this help
`);
      process.exit(0);
    }
  }

  return { input, output, delay, parallel };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function readRepoList(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Analyze a single repo and return a compact trend entry.
 * Returns an error entry on failure instead of throwing.
 */
async function analyzeTrendRepo(slug: string): Promise<TrendRepoEntry> {
  try {
    const { report } = await analyzeRepo(slug, false);
    const dimensions: Record<string, number> = {};
    for (const dim of report.dimensions) {
      dimensions[dim.name] = dim.score;
    }
    return {
      slug: report.repo,
      score: report.overall,
      letter: report.letter,
      dimensions,
    };
  } catch (err) {
    return {
      slug,
      score: 0,
      letter: "F",
      dimensions: {},
      error: (err as Error).message,
    };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function generateTrendSnapshot(
  slugs: string[],
  delay: number,
  parallel: number,
): Promise<TrendSnapshot> {
  const repos: TrendRepoEntry[] = [];
  let successCount = 0;
  let failCount = 0;
  const total = slugs.length;

  for (let i = 0; i < total; i += parallel) {
    const batch = slugs.slice(i, i + parallel);

    const results = await Promise.allSettled(
      batch.map(async (slug, batchIdx) => {
        const globalIdx = i + batchIdx;
        console.log(chalk.cyan(`  [${globalIdx + 1}/${total}] ${slug}...`));
        return analyzeTrendRepo(slug);
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        repos.push(result.value);
        if (result.value.error) {
          failCount++;
          console.log(chalk.red(`    ✗ ${result.value.slug}: ${result.value.error}`));
        } else {
          successCount++;
          console.log(
            chalk.green(
              `    ✓ ${result.value.slug}: ${result.value.letter} (${result.value.score}/100)`
            )
          );
        }
      } else {
        failCount++;
      }
    }

    // Rate limit delay between batches
    if (i + parallel < total && delay > 0) {
      await sleep(delay);
    }
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    meta: {
      month,
      generated: now.toISOString(),
      totalRepos: total,
      successCount,
      failCount,
    },
    repos,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(chalk.bold("\n  Trend Snapshot Generator"));
  console.log(chalk.gray(`  Input: ${args.input}`));
  console.log(chalk.gray(`  Output: ${args.output}`));
  console.log(chalk.gray(`  Parallel: ${args.parallel}, Delay: ${args.delay}ms\n`));

  const slugs = await readRepoList(args.input);
  console.log(chalk.bold(`  Found ${slugs.length} repos to analyze\n`));

  const snapshot = await generateTrendSnapshot(slugs, args.delay, args.parallel);

  // Write output
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, JSON.stringify(snapshot, null, 2), "utf-8");

  console.log(
    chalk.bold(
      `\n  Snapshot complete: ${snapshot.meta.successCount} success, ${snapshot.meta.failCount} failed`
    )
  );
  console.log(chalk.gray(`  Written to ${args.output}\n`));
}

// Only run main when executed directly
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("trend.js") || process.argv[1].endsWith("trend.ts"));

if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(chalk.red(`Fatal: ${(err as Error).message}`));
    process.exit(1);
  });
}
