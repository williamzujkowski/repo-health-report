import type { GradeResult } from "./grader.js";
import type { AiAnalysisResult } from "./ai-analysis.js";

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

export function generateMarkdown(
  slug: string,
  grade: GradeResult,
  ai?: AiAnalysisResult
): string {
  const lines: string[] = [];

  lines.push(`# Repo Health Report: ${slug}`);
  lines.push("");
  if (!grade.graded) {
    lines.push(
      `**Documentation Repo (not graded on code metrics)** — Score: ${grade.overall}/100 (documentation-specific checks only)`
    );
  } else {
    lines.push(
      `**Overall Grade: ${grade.letter} (${grade.overall}/100)** — ${gradeEmoji(grade.letter)}`
    );
  }
  lines.push("");
  const analysisMode =
    ai?.available
      ? "static analysis via GitHub API + AI expert analysis via nexus-agents"
      : "pure static analysis via GitHub API";
  lines.push(
    `Generated on ${new Date().toISOString().split("T")[0]} via [repo-health-report](https://github.com/williamzujkowski/repo-health-report) (${analysisMode}).`
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

  // AI Expert Analysis section
  if (ai !== undefined) {
    lines.push("## AI Expert Analysis");
    lines.push("");

    if (!ai.available) {
      lines.push(
        `> nexus-agents not available: ${ai.error ?? "not installed"}`
      );
    } else if (ai.error) {
      lines.push(`> AI analysis error: ${ai.error}`);
    } else if (ai.experts.length === 0) {
      lines.push("> No expert results returned.");
    } else {
      lines.push("| Dimension | AI Score | Confidence | Analysis |");
      lines.push("|-----------|:--------:|:----------:|---------|");
      for (const expert of ai.experts) {
        const scoreStr = expert.score >= 0 ? `${expert.score}/100` : "n/a";
        const confStr =
          expert.confidence > 0
            ? `${(expert.confidence * 100).toFixed(0)}%`
            : "—";
        const truncated =
          expert.analysis.length > 200
            ? `${expert.analysis.slice(0, 197)}...`
            : expert.analysis;
        lines.push(
          `| ${expert.dimension} | ${scoreStr} | ${confStr} | ${truncated} |`
        );
      }

      if (ai.consensus) {
        lines.push("");
        lines.push("### Consensus Vote");
        lines.push("");
        lines.push(
          `**Grade ${ai.consensus.grade}** — ${ai.consensus.approvalPercentage}% approval`
        );
        lines.push("");
        const truncatedReasoning =
          ai.consensus.reasoning.length > 400
            ? `${ai.consensus.reasoning.slice(0, 397)}...`
            : ai.consensus.reasoning;
        lines.push(`> ${truncatedReasoning}`);
      }
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
