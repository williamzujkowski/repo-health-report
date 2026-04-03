/**
 * Derived insights from tree analytics and scoring data.
 * Issue #24: Natural-language health insights from repo analysis.
 */

import type { GradeResult } from "./grader.js";
import type { TreeAnalytics } from "./tree-analytics.js";
import type { LanguageBreakdown, RepoMeta } from "./analyze.js";

export interface Insight {
  category: "positive" | "warning" | "critical";
  text: string;
}

/**
 * Generate natural-language insights from tree analytics and scoring data.
 * Returns an ordered list of insights — positive findings first, then warnings,
 * then critical issues.
 */
export function generateInsights(
  grade: GradeResult,
  analytics: TreeAnalytics,
  languages: LanguageBreakdown,
  meta: RepoMeta
): Insight[] {
  const insights: Insight[] = [];

  // Test culture
  if (analytics.testToSourceRatio >= 0.8) {
    insights.push({
      category: "positive",
      text: `Excellent testing culture — ${analytics.testToSourceRatio.toFixed(2)} test-to-source ratio`,
    });
  } else if (analytics.testToSourceRatio === 0) {
    insights.push({ category: "critical", text: "No test files detected" });
  } else if (analytics.testToSourceRatio < 0.2) {
    insights.push({
      category: "warning",
      text: `Low test coverage — only ${analytics.testToSourceRatio.toFixed(2)} test-to-source ratio`,
    });
  }

  // Config maturity
  if (analytics.configScore >= 8) {
    insights.push({
      category: "positive",
      text: `Well-configured project — ${analytics.configScore}/10 operational config maturity`,
    });
  } else if (analytics.configScore <= 3) {
    insights.push({
      category: "warning",
      text: `Minimal configuration — only ${analytics.configScore}/10 operational maturity`,
    });
  }

  // Anti-patterns
  if (analytics.hasVendorCommitted) {
    insights.push({
      category: "warning",
      text: "vendor/ directory committed to git — consider using .gitignore",
    });
  }
  if (analytics.hasDotEnvCommitted) {
    insights.push({
      category: "critical",
      text: ".env file committed — potential secret exposure",
    });
  }
  if (analytics.hasDistCommitted) {
    insights.push({
      category: "warning",
      text: "Build artifacts (dist/) committed to git",
    });
  }

  // Monorepo
  if (analytics.isMonorepo) {
    insights.push({
      category: "positive",
      text: `Monorepo structure — ${analytics.dependencyFileCount} dependency manifests detected`,
    });
  }

  // Multi-language
  if (languages.all.length >= 3) {
    const top3 = languages.all
      .slice(0, 3)
      .map((l) => `${l.language} ${l.percentage}%`)
      .join(", ");
    insights.push({ category: "positive", text: `Polyglot codebase: ${top3}` });
  }

  // Size
  if (analytics.sizeCategory === "massive") {
    insights.push({
      category: "warning",
      text: `Very large codebase (${analytics.fileCount.toLocaleString()} files) — consider modularization`,
    });
  }

  // Age + activity
  if (meta.created_at) {
    const ageYears = Math.round(
      (Date.now() - new Date(meta.created_at).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );
    if (ageYears >= 5) {
      insights.push({
        category: "positive",
        text: `Mature project — ${ageYears} years old`,
      });
    }
  }

  // Suppress unused-variable lint warning — grade is accepted for future use
  void grade;

  return insights;
}
