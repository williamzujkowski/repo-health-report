import chalk from "chalk";
import type { GradeResult } from "./grader.js";

function gradeColor(letter: string): (text: string) => string {
  switch (letter) {
    case "A":
      return chalk.green;
    case "B":
      return chalk.greenBright;
    case "C":
      return chalk.yellow;
    case "D":
      return chalk.hex("#FFA500"); // orange
    default:
      return chalk.red;
  }
}

function scoreColor(score: number): (text: string) => string {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

function bar(score: number, width: number = 20): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
  return color("\u2588".repeat(filled)) + chalk.gray("\u2591".repeat(empty));
}

export function renderTerminal(slug: string, grade: GradeResult): void {
  const colorGrade = gradeColor(grade.letter);

  console.log("");
  console.log(
    chalk.bold.white(
      `  Repo Health Report: ${chalk.cyan(slug)}`
    )
  );
  console.log(chalk.gray(`  ${"─".repeat(50)}`));
  console.log("");

  // Overall grade
  console.log(
    `  Overall Grade: ${colorGrade(chalk.bold(`${grade.letter} (${grade.overall}/100)`))}`
  );
  console.log("");

  // Dimension scores
  for (const dim of grade.dimensions) {
    const colorFn = scoreColor(dim.score);
    const nameStr = dim.name.padEnd(16);
    console.log(
      `  ${chalk.white(nameStr)} ${bar(dim.score)} ${colorFn(`${dim.score}`).padStart(3)}/100  ${chalk.gray(`${dim.durationMs.toFixed(0)}ms`)}`
    );
  }
  console.log("");

  // Findings detail
  console.log(chalk.bold.white("  Findings:"));
  console.log(chalk.gray(`  ${"─".repeat(50)}`));

  for (const dim of grade.dimensions) {
    console.log("");
    console.log(chalk.bold(`  ${dim.name}`));
    for (const f of dim.findings) {
      const icon = f.passed ? chalk.green("\u2714") : chalk.red("\u2718");
      const detail = f.passed
        ? chalk.gray(f.detail)
        : chalk.yellow(f.detail);
      console.log(`    ${icon} ${f.name}`);
      console.log(`      ${detail}`);
    }
  }

  console.log("");
  console.log(
    chalk.gray(
      `  Completed in ${(grade.totalDurationMs / 1000).toFixed(1)}s | ${grade.dimensions.length} dimensions | Pure static analysis via GitHub API`
    )
  );
  console.log("");
}
