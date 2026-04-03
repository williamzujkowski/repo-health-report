#!/usr/bin/env node
/**
 * Lessons-learned analysis for batch results.
 *
 * Reads aggregate.json and identifies scoring gaps, false negatives,
 * and improvement priorities. Produces an actionable debrief report.
 *
 * Usage:
 *   node dist/debrief.js
 *   node dist/debrief.js --data-dir ./custom-data
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";

interface DimensionAverage {
  name: string;
  averageScore: number;
  minScore: number;
  maxScore: number;
}

interface CheckStat {
  name: string;
  passCount: number;
  failCount: number;
  passRate: number;
}

interface AggregateData {
  totalRepos: number;
  codeRepos?: number;
  documentationRepos?: number;
  averageOverall: number;
  gradeDistribution: Record<string, number>;
  dimensionAverages: DimensionAverage[];
  typeBreakdown: Record<string, number>;
  languageBreakdown: Record<string, number>;
  topPassingChecks: CheckStat[];
  topFailingChecks: CheckStat[];
}

function parseArgs(argv: string[]): { dataDir: string } {
  let dataDir = join(process.cwd(), "data");

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data-dir" && argv[i + 1]) {
      dataDir = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
${chalk.bold("repo-health-report debrief")} - Lessons-learned analysis

${chalk.bold("Usage:")}
  node dist/debrief.js                    Analyze data/ directory
  node dist/debrief.js --data-dir ./alt   Analyze alternative data directory

${chalk.bold("Options:")}
  --data-dir <path>   Path to data directory (default: ./data)
  --help, -h          Show this help
`);
      process.exit(0);
    }
  }

  return { dataDir };
}

function renderBar(score: number, width = 20): string {
  const filled = Math.round(score / (100 / width));
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function colorByScore(text: string, score: number): string {
  if (score < 50) return chalk.red(text);
  if (score < 70) return chalk.yellow(text);
  return chalk.green(text);
}

interface DebriefInsights {
  fRate: number;
  unknownLangCount: number;
  weakestDimension: DimensionAverage | undefined;
  docTypeCount: number;
  severelyFailingChecks: CheckStat[];
  actions: string[];
}

function computeInsights(aggregate: AggregateData): DebriefInsights {
  const gradedCount = aggregate.codeRepos ?? aggregate.totalRepos;
  const fRate = gradedCount > 0
    ? Math.round(((aggregate.gradeDistribution.F ?? 0) / gradedCount) * 100)
    : 0;
  const unknownLangCount = aggregate.languageBreakdown["unknown"] ?? 0;
  const sorted = [...aggregate.dimensionAverages].sort(
    (a, b) => a.averageScore - b.averageScore
  );
  const weakestDimension = sorted[0];
  const docTypeCount = aggregate.typeBreakdown["documentation"] ?? 0;

  const severelyFailingChecks = aggregate.topFailingChecks.filter(
    (c) => c.passRate < 15 && c.failCount > 50
  );

  const actions: string[] = [];
  if (fRate > 40) {
    actions.push(
      "Re-run batch with latest scoring fixes to reduce false F-grades"
    );
  }
  if (unknownLangCount > 10) {
    actions.push(
      `Implement language fallback for ${unknownLangCount} unknown-language repos`
    );
  }
  if (weakestDimension && weakestDimension.averageScore < 50) {
    actions.push(
      `Investigate ${weakestDimension.name} dimension (avg ${weakestDimension.averageScore}) for overly strict checks`
    );
  }
  if (docTypeCount === 0 && fRate > 30) {
    actions.push(
      "Documentation project type may not be triggering — check detection logic"
    );
  }
  for (const check of severelyFailingChecks.slice(0, 3)) {
    actions.push(
      `"${check.name}" fails ${check.failCount} repos (${check.passRate}% pass) — may be too strict`
    );
  }

  return {
    fRate,
    unknownLangCount,
    weakestDimension,
    docTypeCount,
    severelyFailingChecks,
    actions,
  };
}

function printOverallHealth(aggregate: AggregateData, fRate: number): void {
  console.log(chalk.bold("\n  1. Overall Health"));
  console.log(
    `  ${aggregate.totalRepos} repos analyzed`
  );
  if (aggregate.codeRepos !== undefined && aggregate.documentationRepos !== undefined) {
    console.log(
      `  Code Repos:          ${aggregate.codeRepos}, average score: ${aggregate.averageOverall}/100`
    );
    console.log(
      `  Documentation Repos: ${aggregate.documentationRepos} (not graded)`
    );
  } else {
    console.log(
      `  Average score: ${aggregate.averageOverall}/100`
    );
  }
  console.log(
    `  F-rate: ${fRate}% (${aggregate.gradeDistribution.F ?? 0} code repos)`
  );
  if (fRate > 40) {
    console.log(
      chalk.yellow(
        "  Warning: High F-rate suggests scoring may be too strict OR dataset includes many non-code repos"
      )
    );
  }
}

function printDimensionWeaknesses(dimensions: DimensionAverage[]): void {
  console.log(chalk.bold("\n  2. Weakest Dimensions"));
  const sorted = [...dimensions].sort(
    (a, b) => a.averageScore - b.averageScore
  );
  for (const dim of sorted) {
    const bar = renderBar(dim.averageScore);
    const label = `${dim.name.padEnd(18)} avg=${dim.averageScore} min=${dim.minScore} max=${dim.maxScore}`;
    console.log(`  ${colorByScore(bar, dim.averageScore)} ${label}`);
  }
}

function printTopFailures(checks: CheckStat[]): void {
  console.log(
    chalk.bold("\n  3. Most Common Failures (potential false negatives)")
  );
  for (const check of checks.slice(0, 15)) {
    const passRateStr = `${check.passRate}%`;
    const flag =
      check.passRate < 20
        ? chalk.red("!")
        : check.passRate < 50
          ? chalk.yellow("?")
          : " ";
    console.log(`  ${flag} ${passRateStr.padStart(4)} pass  ${check.name}`);
  }
}

function printLanguageCoverage(
  langBreakdown: Record<string, number>,
  unknownCount: number
): void {
  console.log(chalk.bold("\n  4. Language Coverage"));
  const langs = Object.entries(langBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [lang, count] of langs) {
    console.log(`  ${String(count).padStart(4)}  ${lang}`);
  }
  if (unknownCount > 10) {
    console.log(
      chalk.yellow(
        `  Warning: ${unknownCount} repos with unknown language — needs fallback detection`
      )
    );
  }
}

function printTypeDetection(
  typeBreakdown: Record<string, number>,
  docTypeCount: number,
  fRate: number
): void {
  console.log(chalk.bold("\n  5. Project Type Detection"));
  for (const [type, count] of Object.entries(typeBreakdown)) {
    console.log(`  ${String(count).padStart(4)}  ${type}`);
  }
  if (docTypeCount === 0 && fRate > 30) {
    console.log(
      chalk.yellow(
        "  Warning: No documentation type detected — many F-grades may be awesome lists"
      )
    );
  }
}

function printActions(actions: string[]): void {
  console.log(chalk.bold("\n  6. Recommended Actions"));
  if (actions.length === 0) {
    console.log(chalk.green("  No critical issues found."));
  } else {
    for (const action of actions) {
      console.log(`  -> ${action}`);
    }
  }
}

async function main(): Promise<void> {
  const { dataDir } = parseArgs(process.argv.slice(2));

  const raw = await readFile(join(dataDir, "aggregate.json"), "utf-8");
  const aggregate: AggregateData = JSON.parse(raw) as AggregateData;

  console.log(chalk.bold("\n  Lessons Learned Debrief"));
  console.log(chalk.gray("  " + "-".repeat(50)));

  const insights = computeInsights(aggregate);

  printOverallHealth(aggregate, insights.fRate);
  printDimensionWeaknesses(aggregate.dimensionAverages);
  printTopFailures(aggregate.topFailingChecks);
  printLanguageCoverage(
    aggregate.languageBreakdown,
    insights.unknownLangCount
  );
  printTypeDetection(
    aggregate.typeBreakdown,
    insights.docTypeCount,
    insights.fRate
  );
  printActions(insights.actions);

  console.log("");
}

main().catch((err: unknown) => {
  console.error(chalk.red(`Error: ${(err as Error).message}`));
  process.exit(1);
});

export {
  computeInsights,
  renderBar,
  type AggregateData,
  type DebriefInsights,
  type CheckStat,
  type DimensionAverage,
};
