import chalk from "chalk";
import type { GradeResult } from "./grader.js";
import type { ProjectType } from "./analyze.js";

const DIMENSION_WEIGHTS: Record<ProjectType, Record<string, number>> = {
  application: { Security: 1, Testing: 1, Documentation: 1, Architecture: 1, DevOps: 1, Maintenance: 1 },
  iac: { Security: 1.5, Testing: 0.8, Documentation: 1, Architecture: 1.5, DevOps: 0.8, Maintenance: 0.8 },
  hybrid: { Security: 1.2, Testing: 1, Documentation: 1, Architecture: 1.2, DevOps: 1, Maintenance: 0.8 },
  library: { Security: 0.8, Testing: 1.2, Documentation: 1.5, Architecture: 1, DevOps: 0.5, Maintenance: 1 },
  documentation: { Security: 0.3, Testing: 0.5, Documentation: 2, Architecture: 1.5, DevOps: 0.5, Maintenance: 0.5 },
  runtime: { Security: 0.5, Testing: 0.8, Documentation: 1.5, Architecture: 0.5, DevOps: 0.5, Maintenance: 1.5 },
  mirror: { Security: 0.3, Testing: 0.5, Documentation: 1.5, Architecture: 0.5, DevOps: 0.2, Maintenance: 1.5 },
};

/**
 * When --explain flag is used, show detailed scoring breakdown.
 */
export function explainScore(grade: GradeResult, projectType: ProjectType): string {
  const weights = DIMENSION_WEIGHTS[projectType] ?? DIMENSION_WEIGHTS.application;
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.white("  Scoring Breakdown"));
  lines.push(chalk.gray(`  ${"=".repeat(60)}`));
  lines.push("");

  // 1. Project type and weight profile
  lines.push(`  ${chalk.bold("Project type:")} ${chalk.cyan(projectType)}`);
  lines.push(`  ${chalk.bold("Weight profile:")} ${formatWeightProfile(weights)}`);
  lines.push("");

  // 2. Per-dimension: score x weight = contribution
  lines.push(chalk.bold("  Per-dimension contributions:"));
  lines.push(chalk.gray(`  ${"─".repeat(60)}`));
  lines.push(
    chalk.gray(
      `  ${"Dimension".padEnd(18)} ${"Score".padStart(5)}   ${"Weight".padStart(6)}   ${"Contribution".padStart(12)}`
    )
  );
  lines.push(chalk.gray(`  ${"─".repeat(60)}`));

  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of grade.dimensions) {
    const w = weights[dim.name] ?? 1;
    const contribution = dim.score * w;
    weightedSum += contribution;
    totalWeight += w;

    const scoreStr = `${dim.score}`.padStart(5);
    const weightStr = `x ${w.toFixed(1)}`.padStart(6);
    const contribStr = `= ${contribution.toFixed(1)}`.padStart(12);

    const color = dim.score >= 80 ? chalk.green : dim.score >= 60 ? chalk.yellow : chalk.red;
    lines.push(`  ${chalk.white(dim.name.padEnd(18))} ${color(scoreStr)}   ${chalk.gray(weightStr)}   ${contribStr}`);
  }

  lines.push(chalk.gray(`  ${"─".repeat(60)}`));

  // 3. Total weighted sum / total weight = overall
  lines.push(
    `  ${"Weighted sum".padEnd(18)} ${String(weightedSum.toFixed(1)).padStart(5)}   / ${totalWeight.toFixed(1).padStart(5)}   = ${chalk.bold(String(grade.overall))}`
  );
  lines.push("");

  // 4. Grade thresholds
  lines.push(chalk.bold("  Grade scale:"));
  const thresholds = [
    { letter: "A", range: ">= 90", color: chalk.green },
    { letter: "B", range: ">= 80", color: chalk.greenBright },
    { letter: "C", range: ">= 70", color: chalk.yellow },
    { letter: "D", range: ">= 60", color: chalk.hex("#FFA500") },
    { letter: "F", range: "< 60", color: chalk.red },
  ];
  for (const t of thresholds) {
    const marker = grade.letter === t.letter ? " <--" : "";
    lines.push(`    ${t.color(t.letter)}  ${t.range}${chalk.bold(marker)}`);
  }

  if (!grade.graded) {
    lines.push("");
    lines.push(chalk.gray("  Note: Documentation and mirror repos are not assigned letter grades."));
  }

  lines.push("");

  return lines.join("\n");
}

function formatWeightProfile(weights: Record<string, number>): string {
  return Object.entries(weights)
    .map(([dim, w]) => `${dim}=${w}`)
    .join(", ");
}
