#!/usr/bin/env node

/**
 * Generate dashboard-ready JSON files from batch analysis data.
 *
 * Reads all JSON files in data/reports/, aggregates into clean API formats,
 * and writes to data/dashboard/.
 *
 * Output:
 *   data/dashboard/
 *     ├── summary.json       # Overall stats, grade distribution
 *     ├── leaderboard.json   # All repos sorted by score, with key fields
 *     ├── languages.json     # Per-language stats
 *     ├── types.json         # Per-project-type stats
 *     └── repos/             # Individual repo detail files
 *         ├── facebook-react.json
 *         └── ...
 *
 * Usage: node dist/export.js
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const REPORTS_DIR = join(DATA_DIR, "reports");
const DASHBOARD_DIR = join(DATA_DIR, "dashboard");
const REPOS_DIR = join(DASHBOARD_DIR, "repos");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Finding {
  name: string;
  passed: boolean;
  detail: string;
  weight: number;
}

interface DimensionResult {
  name: string;
  score: number;
  findings: Finding[];
  durationMs?: number;
}

interface LanguageBreakdownEntry {
  language: string;
  fileCount: number;
  percentage: number;
}

interface LanguageBreakdownStored {
  primary: string;
  all: LanguageBreakdownEntry[];
}

interface StoredReport {
  repo: string;
  letter: string;
  overall: number;
  graded?: boolean;
  dimensions: DimensionResult[];
  totalDurationMs: number;
  projectType: string;
  language: string | null;
  languages?: LanguageBreakdownStored;
  analyzedAt: string;
  toolVersion: string;
}

interface GradeDistribution {
  A: number;
  B: number;
  C: number;
  D: number;
  F: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively find all JSON files under a directory.
 */
async function findJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findJsonFiles(fullPath);
      files.push(...nested);
    } else if (entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Load and parse a single report file. Returns null on parse failure.
 */
async function loadReport(filePath: string): Promise<StoredReport | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as StoredReport;
  } catch {
    return null;
  }
}

/**
 * Whether a stored report is for a graded (code) repository.
 * Reports without the `graded` field fall back to checking projectType.
 */
function isGraded(report: StoredReport): boolean {
  if (report.graded !== undefined) {
    return report.graded;
  }
  return report.projectType !== "documentation";
}

/**
 * Extract star count from the "Community adoption (stars)" finding detail,
 * e.g. "244,350 stars — strong community adoption" → 244350.
 * Returns null when the finding is absent or unparseable.
 */
function extractStars(report: StoredReport): number | null {
  for (const dim of report.dimensions) {
    for (const finding of dim.findings) {
      if (finding.name === "Community adoption (stars)") {
        const match = finding.detail.match(/^([\d,]+)\s+stars/);
        if (match) {
          return parseInt(match[1].replace(/,/g, ""), 10);
        }
      }
    }
  }
  return null;
}

/**
 * Convert a repo slug (owner/name) to a safe filename (owner-name).
 */
function slugToFilename(slug: string): string {
  return slug.replace("/", "-");
}

/**
 * Build an empty grade distribution object.
 */
function emptyGradeDistribution(): GradeDistribution {
  return { A: 0, B: 0, C: 0, D: 0, F: 0 };
}

// ─── Dashboard builders ────────────────────────────────────────────────────────

interface SummaryOutput {
  generatedAt: string;
  totalRepos: number;
  codeRepos: number;
  documentationRepos: number;
  averageScore: number;
  gradeDistribution: GradeDistribution;
  dimensionAverages: Record<string, number>;
}

interface LeaderboardEntry {
  slug: string;
  grade: string;
  score: number;
  language: string | null;
  languages: LanguageBreakdownEntry[] | null;
  type: string;
  stars: number | null;
  graded: boolean;
}

interface LanguageStat {
  name: string;
  count: number;
  averageScore: number | null;
  gradeDistribution: GradeDistribution;
}

interface TypeStat {
  name: string;
  count: number;
  averageScore: number | null;
  graded: boolean;
  gradeDistribution: GradeDistribution;
}

function buildSummary(reports: StoredReport[]): SummaryOutput {
  const gradeDistribution = emptyGradeDistribution();
  const dimensionScores: Record<string, number[]> = {};
  let totalOverall = 0;
  let codeRepos = 0;
  let documentationRepos = 0;

  for (const report of reports) {
    const graded = isGraded(report);
    if (graded) {
      const grade = report.letter as keyof GradeDistribution;
      if (grade in gradeDistribution) {
        gradeDistribution[grade]++;
      }
      totalOverall += report.overall;
      codeRepos++;
    } else {
      documentationRepos++;
    }

    for (const dim of report.dimensions) {
      if (!dimensionScores[dim.name]) {
        dimensionScores[dim.name] = [];
      }
      dimensionScores[dim.name].push(dim.score);
    }
  }

  const dimensionAverages: Record<string, number> = {};
  for (const [name, scores] of Object.entries(dimensionScores)) {
    dimensionAverages[name] = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    totalRepos: reports.length,
    codeRepos,
    documentationRepos,
    averageScore: codeRepos > 0 ? Math.round(totalOverall / codeRepos) : 0,
    gradeDistribution,
    dimensionAverages,
  };
}

function buildLeaderboard(reports: StoredReport[]): { repos: LeaderboardEntry[] } {
  const entries: LeaderboardEntry[] = reports.map((report) => ({
    slug: report.repo,
    grade: report.letter,
    score: report.overall,
    language: report.language,
    languages: report.languages?.all ?? null,
    type: report.projectType,
    stars: extractStars(report),
    graded: isGraded(report),
  }));

  entries.sort((a, b) => b.score - a.score);
  return { repos: entries };
}

function buildLanguages(reports: StoredReport[]): { languages: LanguageStat[] } {
  const byLanguage: Record<string, { scores: number[]; gradeDistribution: GradeDistribution; allUngraded: boolean }> = {};

  for (const report of reports) {
    const lang = report.language ?? "unknown";
    if (!byLanguage[lang]) {
      byLanguage[lang] = {
        scores: [],
        gradeDistribution: emptyGradeDistribution(),
        allUngraded: true,
      };
    }
    const entry = byLanguage[lang];
    if (isGraded(report)) {
      entry.scores.push(report.overall);
      entry.allUngraded = false;
      const grade = report.letter as keyof GradeDistribution;
      if (grade in entry.gradeDistribution) {
        entry.gradeDistribution[grade]++;
      }
    }
  }

  const languages: LanguageStat[] = Object.entries(byLanguage)
    .map(([name, data]) => ({
      name,
      count: data.scores.length + (data.allUngraded ? 0 : 0),
      averageScore:
        data.scores.length > 0
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : null,
      gradeDistribution: data.gradeDistribution,
    }))
    .sort((a, b) => b.count - a.count);

  // Recompute count to include all repos (graded + ungraded) per language
  const totalCounts: Record<string, number> = {};
  for (const report of reports) {
    const lang = report.language ?? "unknown";
    totalCounts[lang] = (totalCounts[lang] ?? 0) + 1;
  }
  for (const lang of languages) {
    lang.count = totalCounts[lang.name] ?? 0;
  }
  languages.sort((a, b) => b.count - a.count);

  return { languages };
}

function buildTypes(reports: StoredReport[]): { types: TypeStat[] } {
  const byType: Record<string, { scores: number[]; gradeDistribution: GradeDistribution; hasGraded: boolean }> = {};

  for (const report of reports) {
    const type = report.projectType ?? "unknown";
    if (!byType[type]) {
      byType[type] = {
        scores: [],
        gradeDistribution: emptyGradeDistribution(),
        hasGraded: false,
      };
    }
    const entry = byType[type];
    if (isGraded(report)) {
      entry.scores.push(report.overall);
      entry.hasGraded = true;
      const grade = report.letter as keyof GradeDistribution;
      if (grade in entry.gradeDistribution) {
        entry.gradeDistribution[grade]++;
      }
    }
  }

  const totalCounts: Record<string, number> = {};
  for (const report of reports) {
    const type = report.projectType ?? "unknown";
    totalCounts[type] = (totalCounts[type] ?? 0) + 1;
  }

  const types: TypeStat[] = Object.entries(byType)
    .map(([name, data]) => ({
      name,
      count: totalCounts[name] ?? 0,
      averageScore:
        data.scores.length > 0
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : null,
      graded: data.hasGraded,
      gradeDistribution: data.gradeDistribution,
    }))
    .sort((a, b) => b.count - a.count);

  return { types };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Loading reports...");
  const jsonFiles = await findJsonFiles(REPORTS_DIR);
  console.log(`  Found ${jsonFiles.length} report files`);

  const reports: StoredReport[] = [];
  let failed = 0;
  for (const filePath of jsonFiles) {
    const report = await loadReport(filePath);
    if (report) {
      reports.push(report);
    } else {
      failed++;
    }
  }
  if (failed > 0) {
    console.warn(`  Warning: ${failed} files could not be parsed`);
  }
  console.log(`  Loaded ${reports.length} reports`);

  // Create output directories
  await mkdir(REPOS_DIR, { recursive: true });

  // summary.json
  console.log("\nGenerating summary.json...");
  const summary = buildSummary(reports);
  await writeFile(
    join(DASHBOARD_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf-8"
  );

  // leaderboard.json
  console.log("Generating leaderboard.json...");
  const leaderboard = buildLeaderboard(reports);
  await writeFile(
    join(DASHBOARD_DIR, "leaderboard.json"),
    JSON.stringify(leaderboard, null, 2),
    "utf-8"
  );

  // languages.json
  console.log("Generating languages.json...");
  const languages = buildLanguages(reports);
  await writeFile(
    join(DASHBOARD_DIR, "languages.json"),
    JSON.stringify(languages, null, 2),
    "utf-8"
  );

  // types.json
  console.log("Generating types.json...");
  const types = buildTypes(reports);
  await writeFile(
    join(DASHBOARD_DIR, "types.json"),
    JSON.stringify(types, null, 2),
    "utf-8"
  );

  // repos/{slug}.json — one file per repo
  console.log("Generating per-repo files...");
  let repoCount = 0;
  for (const report of reports) {
    const filename = slugToFilename(report.repo) + ".json";
    await writeFile(
      join(REPOS_DIR, filename),
      JSON.stringify(report, null, 2),
      "utf-8"
    );
    repoCount++;
  }
  console.log(`  Wrote ${repoCount} repo files`);

  console.log("\nDashboard export complete:");
  console.log(`  ${DASHBOARD_DIR}/`);
  console.log(`    summary.json    (${reports.length} repos total)`);
  console.log(`    leaderboard.json`);
  console.log(`    languages.json  (${languages.languages.length} languages)`);
  console.log(`    types.json      (${types.types.length} types)`);
  console.log(`    repos/          (${repoCount} files)`);
}

main().catch((err: unknown) => {
  console.error("Export failed:", err);
  process.exit(1);
});
