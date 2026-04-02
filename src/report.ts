import type { GradeResult } from "./grader.js";

function gradeEmoji(letter: string): string {
  switch (letter) {
    case "A":
      return "excellent";
    case "B":
      return "good";
    case "C":
      return "fair";
    case "D":
      return "needs work";
    default:
      return "poor";
  }
}

export function generateMarkdown(slug: string, grade: GradeResult): string {
  const lines: string[] = [];

  lines.push(`# Repo Health Report: ${slug}`);
  lines.push("");
  lines.push(
    `**Overall Grade: ${grade.letter} (${grade.overall}/100)** — ${gradeEmoji(grade.letter)}`
  );
  lines.push("");
  lines.push(
    `Generated on ${new Date().toISOString().split("T")[0]} via [repo-health-report](https://github.com/williamzujkowski/repo-health-report) (pure static analysis, no AI APIs).`
  );
  lines.push("");

  // Summary table
  lines.push("## Dimension Scores");
  lines.push("");
  lines.push("| Dimension | Score | Grade |");
  lines.push("|-----------|------:|-------|");
  for (const dim of grade.dimensions) {
    const dimLetter =
      dim.score >= 90
        ? "A"
        : dim.score >= 80
          ? "B"
          : dim.score >= 70
            ? "C"
            : dim.score >= 60
              ? "D"
              : "F";
    lines.push(`| ${dim.name} | ${dim.score}/100 | ${dimLetter} |`);
  }
  lines.push("");

  // Detailed findings
  lines.push("## Detailed Findings");
  lines.push("");

  for (const dim of grade.dimensions) {
    lines.push(`### ${dim.name} (${dim.score}/100)`);
    lines.push("");
    for (const f of dim.findings) {
      const icon = f.passed ? "[PASS]" : "[FAIL]";
      lines.push(`- ${icon} **${f.name}**: ${f.detail}`);
    }
    lines.push("");
  }

  // Recommendations
  const failedFindings = grade.dimensions.flatMap((d) =>
    d.findings.filter((f) => !f.passed).map((f) => ({ dim: d.name, ...f }))
  );

  if (failedFindings.length > 0) {
    lines.push("## Recommendations");
    lines.push("");
    // Sort by weight descending — highest impact first
    const sorted = [...failedFindings].sort((a, b) => b.weight - a.weight);
    for (const f of sorted.slice(0, 10)) {
      lines.push(`1. **${f.dim} — ${f.name}**: ${f.detail}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(
    `*Analysis completed in ${(grade.totalDurationMs / 1000).toFixed(1)}s across ${grade.dimensions.length} dimensions.*`
  );
  lines.push("");

  return lines.join("\n");
}
