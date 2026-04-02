import chalk from "chalk";
import type { GradeResult } from "./grader.js";
import type { AiAnalysisResult } from "./ai-analysis.js";

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

export function renderAiAnalysis(ai: AiAnalysisResult): void {
  console.log("");
  console.log(chalk.bold.white("  AI Expert Analysis (nexus-agents):"));
  console.log(chalk.gray(`  ${"─".repeat(50)}`));

  if (!ai.available) {
    console.log(
      chalk.yellow(`  ${ai.error ?? "nexus-agents not available"}`)
    );
    return;
  }

  if (ai.error) {
    console.log(chalk.red(`  AI analysis error: ${ai.error}`));
    return;
  }

  if (ai.experts.length === 0) {
    console.log(chalk.gray("  No expert results returned."));
    return;
  }

  console.log("");
  for (const expert of ai.experts) {
    const scoreStr =
      expert.score >= 0
        ? `${expert.score}/100`
        : chalk.gray("n/a");
    const confStr =
      expert.confidence > 0
        ? chalk.gray(` (${(expert.confidence * 100).toFixed(0)}% confidence)`)
        : "";
    const truncated =
      expert.analysis.length > 200
        ? `${expert.analysis.slice(0, 197)}...`
        : expert.analysis;

    const colorFn =
      expert.score >= 80
        ? chalk.green
        : expert.score >= 60
          ? chalk.yellow
          : expert.score >= 0
            ? chalk.red
            : chalk.gray;

    console.log(
      `  ${chalk.white(expert.dimension.padEnd(16))} ${colorFn(scoreStr)}${confStr}`
    );
    console.log(chalk.gray(`    ${truncated}`));
  }

  if (ai.consensus) {
    console.log("");
    console.log(
      `  ${chalk.bold("Consensus Vote:")} ${chalk.cyan(ai.consensus.grade)} — ${ai.consensus.approvalPercentage}% approval`
    );
    const truncatedReasoning =
      ai.consensus.reasoning.length > 200
        ? `${ai.consensus.reasoning.slice(0, 197)}...`
        : ai.consensus.reasoning;
    console.log(chalk.gray(`    ${truncatedReasoning}`));
  }
}

export function renderTerminal(
  slug: string,
  grade: GradeResult,
  ai?: AiAnalysisResult
): void {
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
  const analysisMode = ai?.available
    ? "Static + AI analysis (nexus-agents)"
    : "Pure static analysis via GitHub API";
  console.log(
    chalk.gray(
      `  Completed in ${(grade.totalDurationMs / 1000).toFixed(1)}s | ${grade.dimensions.length} dimensions | ${analysisMode}`
    )
  );
  console.log("");

  // AI section (only when --ai flag was used)
  if (ai !== undefined) {
    renderAiAnalysis(ai);
    console.log("");
  }
}
