#!/usr/bin/env node

/**
 * Org-level audit for repo-health-report.
 *
 * Analyzes all public repos in a GitHub organization and produces
 * a structured audit report with aggregate scores, risk analysis,
 * and a human-readable markdown report.
 *
 * Usage:
 *   node dist/org-audit.js --org cloud-gov
 *   node dist/org-audit.js --org cloud-gov --parallel 3 --skip-docs --delay 2000
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { ghApi } from "./analyze.js";
import { analyzeRepo, sleep } from "./batch.js";
import type { BatchReport } from "./batch.js";
import { RepoCache } from "./cache.js";

// ── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), "data");
const MAX_PARALLEL = 5;
const MAX_ORG_REPOS = 500;

/**
 * Strict GitHub org name regex.
 * 1-39 alphanumeric or hyphen chars. Must start/end with alphanumeric.
 */
const ORG_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

// ── Types ────────────────────────────────────────────────────────────────────

interface OrgAuditArgs {
  org: string;
  parallel: number;
  delay: number;
  skipDocs: boolean;
}

interface OrgTreeAnalyticsSummary {
  totalFileCount: number;
  avgFileCount: number;
  reposWithAntiPatterns: string[];
  reposWithVendorCommitted: string[];
  reposWithDotEnvCommitted: string[];
  avgTestToSourceRatio: number;
  monorepoCount: number;
}

interface OrgSupplyChainSummary {
  riskDistribution: Record<string, number>; // critical, high, medium, low, unknown
  reposWithCriticalAlerts: string[];
  reposWithoutLockfile: string[];
  totalOpenAlerts: number;
}

interface OrgInsightsSummary {
  totalInsights: number;
  criticalCount: number;
  warningCount: number;
  positiveCount: number;
  /** Top critical insight texts across all repos (deduplicated, up to 10) */
  topCritical: string[];
  /** Top warning insight texts across all repos (deduplicated, up to 10) */
  topWarnings: string[];
}

interface OrgLanguageDetail {
  primaryCount: number;
  totalFileCount: number;
  reposContaining: number;
}

interface OrgSummary {
  org: string;
  analyzedAt: string;
  totalRepos: number;
  gradedRepos: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  dimensionAverages: Record<string, number>;
  /** @deprecated Use multiLanguageBreakdown for richer data */
  languageBreakdown: Record<string, number>;
  multiLanguageBreakdown: Record<string, OrgLanguageDetail>;
  typeBreakdown: Record<string, number>;
  treeAnalytics?: OrgTreeAnalyticsSummary;
  insightsSummary?: OrgInsightsSummary;
  supplyChainSummary?: OrgSupplyChainSummary;
}

export interface RiskEntry {
  finding: string;
  failCount: number;
  failRate: number;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  recommendation: string;
}

interface RisksReport {
  risks: RiskEntry[];
}

// ── Risk Classification ──────────────────────────────────────────────────────

/** Maps finding names to risk categories. */
const FINDING_CATEGORY_MAP: Record<string, string> = {
  "Pinned dependencies (Actions SHA)": "supply-chain",
  "Dependency update automation": "supply-chain",
  "Token permissions": "supply-chain",
  "Security policy (SECURITY.md)": "security-policy",
  "Code ownership": "security-policy",
  "No committed .env files": "security-policy",
  ".gitignore present": "security-policy",
  "CI workflows (branch protection proxy)": "ci-testing",
  "CI/CD pipeline": "ci-testing",
  "CI workflows": "ci-testing",
  "CI pipeline": "ci-testing",
  "Test files": "ci-testing",
  "Coverage configuration": "ci-testing",
  "Test runner configured": "ci-testing",
  "Pre-commit hooks": "ci-testing",
  "README quality": "documentation",
  "LICENSE file": "documentation",
  "CONTRIBUTING guide": "documentation",
  "CHANGELOG": "documentation",
  "Documentation directory or API docs": "documentation",
  "Repository description": "documentation",
  "Type safety": "architecture",
  "Linter configuration": "architecture",
  "Code formatter": "architecture",
  "Organized source structure": "architecture",
  "Build configuration": "architecture",
  "Container support (Docker)": "ci-testing",
  "Release automation": "ci-testing",
  "Issue/PR templates": "ci-testing",
  "Deployment/Infrastructure config": "ci-testing",
  "Last commit recency": "maintenance",
  "Open issue freshness": "maintenance",
  "Recent releases": "maintenance",
  "Community adoption (stars)": "maintenance",
  "Bus factor": "maintenance",
  "Maintainer funding": "maintenance",
};

/** Maps finding names to human-readable recommendations. */
const FINDING_RECOMMENDATIONS: Record<string, string> = {
  "Pinned dependencies (Actions SHA)": "Pin all GitHub Actions to full commit SHA",
  "Dependency update automation": "Enable Dependabot or Renovate for automated dependency updates",
  "Token permissions": "Add explicit permissions block to GitHub Actions workflows",
  "Security policy (SECURITY.md)": "Add a SECURITY.md with vulnerability disclosure instructions",
  "Code ownership": "Add a CODEOWNERS file to enforce review requirements",
  "No committed .env files": "Remove committed .env files and add to .gitignore",
  ".gitignore present": "Add a .gitignore file appropriate for the project language",
  "CI workflows (branch protection proxy)": "Add CI workflows to enable branch protection",
  "CI/CD pipeline": "Set up a CI/CD pipeline (GitHub Actions recommended)",
  "CI workflows": "Add CI workflow files (.github/workflows/)",
  "Test files": "Add test files for the project",
  "Coverage configuration": "Configure test coverage reporting",
  "Test runner configured": "Configure a test runner in the build scripts",
  "Pre-commit hooks": "Add pre-commit hooks (husky, pre-commit, lefthook)",
  "README quality": "Improve README.md with description, install steps, and usage examples",
  "LICENSE file": "Add a LICENSE file",
  "CONTRIBUTING guide": "Add a CONTRIBUTING.md guide",
  "CHANGELOG": "Add a CHANGELOG to track releases",
  "Documentation directory or API docs": "Add a docs/ directory or API documentation",
  "Repository description": "Set the repository description on GitHub",
  "Type safety": "Add type checking (TypeScript, mypy, etc.)",
  "Linter configuration": "Add a linter configuration file",
  "Code formatter": "Add a code formatter configuration",
  "Organized source structure": "Organize code into src/, lib/, or packages/ structure",
  "Build configuration": "Add a build configuration file",
  "Container support (Docker)": "Add a Dockerfile for containerized builds",
  "Release automation": "Set up automated releases (semantic-release, changesets)",
  "Issue/PR templates": "Add issue and PR templates",
  "Deployment/Infrastructure config": "Add deployment or infrastructure configuration",
};

/**
 * Classify risk severity based on finding name and fail rate.
 *
 * - Critical: Security-related findings failing >50%
 * - High: Testing/DevOps findings failing >60%
 * - Medium: Documentation/Architecture findings failing >40%
 * - Low: Everything else (maintenance findings)
 */
export function classifyRiskSeverity(
  findingName: string,
  failRate: number,
  category: string,
): "critical" | "high" | "medium" | "low" {
  const securityFindings = [
    "Security policy (SECURITY.md)",
    "Pinned dependencies (Actions SHA)",
    "Token permissions",
    "Code ownership",
    "No committed .env files",
    ".gitignore present",
  ];

  if (securityFindings.includes(findingName) && failRate > 50) {
    return "critical";
  }

  if (category === "ci-testing" && failRate > 60) {
    return "high";
  }

  if ((category === "documentation" || category === "architecture") && failRate > 40) {
    return "medium";
  }

  if (category === "maintenance") {
    return "low";
  }

  // Default: medium for anything with >40% fail rate, low otherwise
  if (failRate > 40) {
    return "medium";
  }
  return "low";
}

// ── Org name validation ──────────────────────────────────────────────────────

export function validateOrgName(name: string): string {
  if (!ORG_NAME_REGEX.test(name)) {
    throw new Error(
      `Invalid org name: "${name}". Must be 1-39 alphanumeric/hyphen chars, start/end with alphanumeric.`
    );
  }
  return name;
}

// ── CLI argument parsing ─────────────────────────────────────────────────────

function parseArgs(argv: string[]): OrgAuditArgs {
  let org = "";
  let parallel = 1;
  let delay = 2000;
  let skipDocs = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--org" && argv[i + 1]) {
      org = argv[++i];
    } else if ((arg === "--parallel" || arg === "-p") && argv[i + 1]) {
      parallel = parseInt(argv[++i], 10);
      if (isNaN(parallel) || parallel < 1) {
        throw new Error("--parallel must be a positive integer");
      }
      if (parallel > MAX_PARALLEL) {
        console.log(chalk.yellow(`  Warning: clamping --parallel to max ${MAX_PARALLEL}`));
        parallel = MAX_PARALLEL;
      }
    } else if (arg === "--delay" && argv[i + 1]) {
      delay = parseInt(argv[++i], 10);
      if (isNaN(delay) || delay < 0) {
        throw new Error("--delay must be a non-negative integer (ms)");
      }
    } else if (arg === "--skip-docs") {
      skipDocs = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
${chalk.bold("repo-health-report org-audit")} - Audit all repos in a GitHub organization

${chalk.bold("Usage:")}
  node dist/org-audit.js --org cloud-gov
  node dist/org-audit.js --org cloud-gov --parallel 3 --skip-docs --delay 2000

${chalk.bold("Options:")}
  --org <name>      GitHub organization name (required)
  --parallel <n>    Process N repos concurrently (default: 1, max: ${MAX_PARALLEL})
  -p <n>            Alias for --parallel
  --delay <ms>      Delay between batches in ms (default: 2000)
  --skip-docs       Skip repos detected as documentation/mirror type
  --help, -h        Show this help
`);
      process.exit(0);
    }
  }

  if (!org) {
    throw new Error("--org is required. Usage: node dist/org-audit.js --org <org-name>");
  }

  return { org: validateOrgName(org), parallel, delay, skipDocs };
}

// ── Fetch org repos ──────────────────────────────────────────────────────────

interface GitHubRepo {
  full_name: string;
  archived: boolean;
}

async function fetchOrgRepos(org: string): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;

  while (slugs.length < MAX_ORG_REPOS) {
    const endpoint = `/orgs/${org}/repos?type=public&per_page=100&page=${page}`;
    const repos = await ghApi<GitHubRepo[]>(endpoint, { paginate: false });

    if (repos.length === 0) break;

    for (const repo of repos) {
      if (!repo.archived && slugs.length < MAX_ORG_REPOS) {
        slugs.push(repo.full_name);
      }
    }

    if (repos.length < 100) break;
    page++;
  }

  return slugs;
}

// ── Report generation ────────────────────────────────────────────────────────

function buildSummary(org: string, reports: BatchReport[], analyzedAt: string): OrgSummary {
  const gradedReports = reports.filter((r) => r.graded);
  const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const dimensionTotals: Record<string, { sum: number; count: number }> = {};
  const languageCounts: Record<string, number> = {};
  const multiLang: Record<string, OrgLanguageDetail> = {};
  const typeCounts: Record<string, number> = {};

  for (const report of reports) {
    // Grade distribution (graded repos only)
    if (report.graded && report.letter in gradeDistribution) {
      gradeDistribution[report.letter]++;
    }

    // Dimension averages
    for (const dim of report.dimensions) {
      if (!dimensionTotals[dim.name]) {
        dimensionTotals[dim.name] = { sum: 0, count: 0 };
      }
      dimensionTotals[dim.name].sum += dim.score;
      dimensionTotals[dim.name].count++;
    }

    // Primary language breakdown (backward compatible)
    const lang = report.language ?? "unknown";
    languageCounts[lang] = (languageCounts[lang] ?? 0) + 1;

    // Multi-language breakdown: aggregate from languages field when available
    if (report.languages) {
      // Count primary
      const primary = report.languages.primary;
      if (!multiLang[primary]) {
        multiLang[primary] = { primaryCount: 0, totalFileCount: 0, reposContaining: 0 };
      }
      multiLang[primary].primaryCount++;

      // Count all languages with file counts
      for (const entry of report.languages.all) {
        const name = entry.language;
        if (!multiLang[name]) {
          multiLang[name] = { primaryCount: 0, totalFileCount: 0, reposContaining: 0 };
        }
        multiLang[name].totalFileCount += entry.fileCount;
        multiLang[name].reposContaining++;
      }
    } else {
      // Fallback: count primary language only
      if (!multiLang[lang]) {
        multiLang[lang] = { primaryCount: 0, totalFileCount: 0, reposContaining: 0 };
      }
      multiLang[lang].primaryCount++;
      multiLang[lang].reposContaining++;
    }

    // Type breakdown
    typeCounts[report.projectType] = (typeCounts[report.projectType] ?? 0) + 1;
  }

  const dimensionAverages: Record<string, number> = {};
  for (const [name, { sum, count }] of Object.entries(dimensionTotals)) {
    dimensionAverages[name] = Math.round(sum / count);
  }

  const totalScore = gradedReports.reduce((sum, r) => sum + r.overall, 0);
  const averageScore = gradedReports.length > 0 ? Math.round(totalScore / gradedReports.length) : 0;

  // Aggregate tree analytics
  let treeAnalyticsSummary: OrgTreeAnalyticsSummary | undefined;
  const reportsWithAnalytics = reports.filter((r) => r.treeAnalytics);
  if (reportsWithAnalytics.length > 0) {
    let totalFiles = 0;
    let totalTestRatio = 0;
    let monorepoCount = 0;
    const reposWithAntiPatterns: string[] = [];
    const reposWithVendorCommitted: string[] = [];
    const reposWithDotEnvCommitted: string[] = [];

    for (const report of reportsWithAnalytics) {
      const ta = report.treeAnalytics!;
      totalFiles += ta.fileCount;
      totalTestRatio += ta.testToSourceRatio;
      if (ta.isMonorepo) monorepoCount++;
      if (ta.antiPatternCount > 0) reposWithAntiPatterns.push(report.repo);
      if (ta.hasVendorCommitted) reposWithVendorCommitted.push(report.repo);
      if (ta.hasDotEnvCommitted) reposWithDotEnvCommitted.push(report.repo);
    }

    treeAnalyticsSummary = {
      totalFileCount: totalFiles,
      avgFileCount: Math.round(totalFiles / reportsWithAnalytics.length),
      reposWithAntiPatterns,
      reposWithVendorCommitted,
      reposWithDotEnvCommitted,
      avgTestToSourceRatio:
        Math.round(
          (totalTestRatio / reportsWithAnalytics.length) * 100
        ) / 100,
      monorepoCount,
    };
  }

  // Aggregate insights across all reports
  let insightsSummary: OrgInsightsSummary | undefined;
  const reportsWithInsights = reports.filter((r) => r.insights && r.insights.length > 0);
  if (reportsWithInsights.length > 0) {
    let criticalCount = 0;
    let warningCount = 0;
    let positiveCount = 0;
    const criticalTexts: Map<string, number> = new Map();
    const warningTexts: Map<string, number> = new Map();

    for (const report of reportsWithInsights) {
      for (const insight of report.insights!) {
        if (insight.category === "critical") {
          criticalCount++;
          criticalTexts.set(insight.text, (criticalTexts.get(insight.text) ?? 0) + 1);
        } else if (insight.category === "warning") {
          warningCount++;
          warningTexts.set(insight.text, (warningTexts.get(insight.text) ?? 0) + 1);
        } else {
          positiveCount++;
        }
      }
    }

    // Sort by frequency descending, take top 10
    const topCritical = [...criticalTexts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text]) => text);
    const topWarnings = [...warningTexts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text]) => text);

    insightsSummary = {
      totalInsights: criticalCount + warningCount + positiveCount,
      criticalCount,
      warningCount,
      positiveCount,
      topCritical,
      topWarnings,
    };
  }

  // Aggregate supply chain risk across all reports
  let supplyChainSummary: OrgSupplyChainSummary | undefined;
  const reportsWithSupplyChain = reports.filter((r) => r.supplyChain);
  if (reportsWithSupplyChain.length > 0) {
    const riskDistribution: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    };
    const reposWithCriticalAlerts: string[] = [];
    const reposWithoutLockfile: string[] = [];
    let totalOpenAlerts = 0;

    for (const report of reportsWithSupplyChain) {
      const sc = report.supplyChain!;
      riskDistribution[sc.risk] = (riskDistribution[sc.risk] ?? 0) + 1;
      if (sc.risk === "critical") reposWithCriticalAlerts.push(report.repo);
      if (!sc.lockfilePresent) reposWithoutLockfile.push(report.repo);
      if (sc.dependabotAlerts) totalOpenAlerts += sc.dependabotAlerts.total;
    }

    supplyChainSummary = {
      riskDistribution,
      reposWithCriticalAlerts,
      reposWithoutLockfile,
      totalOpenAlerts,
    };
  }

  return {
    org,
    analyzedAt,
    totalRepos: reports.length,
    gradedRepos: gradedReports.length,
    averageScore,
    gradeDistribution,
    dimensionAverages,
    languageBreakdown: languageCounts,
    multiLanguageBreakdown: multiLang,
    typeBreakdown: typeCounts,
    ...(treeAnalyticsSummary ? { treeAnalytics: treeAnalyticsSummary } : {}),
    ...(insightsSummary ? { insightsSummary } : {}),
    ...(supplyChainSummary ? { supplyChainSummary } : {}),
  };
}

export function buildRisks(reports: BatchReport[]): RisksReport {
  // Count failures per finding across all repos
  const findingStats: Map<string, { failCount: number; totalCount: number }> = new Map();

  for (const report of reports) {
    for (const dim of report.dimensions) {
      for (const finding of dim.findings) {
        if (!findingStats.has(finding.name)) {
          findingStats.set(finding.name, { failCount: 0, totalCount: 0 });
        }
        const stats = findingStats.get(finding.name)!;
        stats.totalCount++;
        if (!finding.passed) {
          stats.failCount++;
        }
      }
    }
  }

  const risks: RiskEntry[] = [];
  for (const [name, stats] of findingStats) {
    if (stats.failCount === 0) continue;

    const failRate = Math.round((stats.failCount / stats.totalCount) * 100);
    const category = FINDING_CATEGORY_MAP[name] ?? "other";
    const severity = classifyRiskSeverity(name, failRate, category);
    const recommendation = FINDING_RECOMMENDATIONS[name] ?? `Address: ${name}`;

    risks.push({
      finding: name,
      failCount: stats.failCount,
      failRate,
      severity,
      category,
      recommendation,
    });
  }

  // Sort by severity priority, then by failCount descending
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.failCount - a.failCount;
  });

  return { risks };
}

export function generateOrgMarkdown(summary: OrgSummary, risks: RisksReport, reports: BatchReport[]): string {
  const lines: string[] = [];

  // Executive Summary
  lines.push(`# Org Audit: ${summary.org}`);
  lines.push("");
  lines.push(`**Analyzed:** ${summary.analyzedAt}`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total repos | ${summary.totalRepos} |`);
  lines.push(`| Graded repos | ${summary.gradedRepos} |`);
  lines.push(`| Average score | ${summary.averageScore}/100 |`);
  lines.push(`| Grade distribution | A:${summary.gradeDistribution.A} B:${summary.gradeDistribution.B} C:${summary.gradeDistribution.C} D:${summary.gradeDistribution.D} F:${summary.gradeDistribution.F} |`);
  lines.push("");

  // Dimension Averages
  if (Object.keys(summary.dimensionAverages).length > 0) {
    lines.push("### Dimension Averages");
    lines.push("");
    lines.push("| Dimension | Average Score |");
    lines.push("|-----------|--------------|");
    for (const [name, avg] of Object.entries(summary.dimensionAverages)) {
      lines.push(`| ${name} | ${avg}/100 |`);
    }
    lines.push("");
  }

  // Tree Analytics Summary
  if (summary.treeAnalytics) {
    const ta = summary.treeAnalytics;
    lines.push("### Tree Analytics");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Total files | ${ta.totalFileCount.toLocaleString()} |`);
    lines.push(`| Avg files/repo | ${ta.avgFileCount} |`);
    lines.push(`| Avg test-to-source ratio | ${ta.avgTestToSourceRatio} |`);
    lines.push(`| Monorepos | ${ta.monorepoCount} |`);
    lines.push(`| Repos with anti-patterns | ${ta.reposWithAntiPatterns.length} |`);
    if (ta.reposWithVendorCommitted.length > 0) {
      lines.push(`| Vendor committed | ${ta.reposWithVendorCommitted.join(", ")} |`);
    }
    if (ta.reposWithDotEnvCommitted.length > 0) {
      lines.push(`| .env committed | ${ta.reposWithDotEnvCommitted.join(", ")} |`);
    }
    lines.push("");
  }

  // Insights Summary
  if (summary.insightsSummary) {
    const ins = summary.insightsSummary;
    lines.push("### Insights Summary");
    lines.push("");
    lines.push("| Metric | Count |");
    lines.push("|--------|-------|");
    lines.push(`| Total insights | ${ins.totalInsights} |`);
    lines.push(`| Critical | ${ins.criticalCount} |`);
    lines.push(`| Warnings | ${ins.warningCount} |`);
    lines.push(`| Positive | ${ins.positiveCount} |`);
    lines.push("");
    if (ins.topCritical.length > 0) {
      lines.push("**Top Critical Issues:**");
      lines.push("");
      for (const text of ins.topCritical) {
        lines.push(`- ✗ ${text}`);
      }
      lines.push("");
    }
    if (ins.topWarnings.length > 0) {
      lines.push("**Top Warnings:**");
      lines.push("");
      for (const text of ins.topWarnings) {
        lines.push(`- ⚠ ${text}`);
      }
      lines.push("");
    }
  }

  // Supply Chain Summary
  if (summary.supplyChainSummary) {
    const sc = summary.supplyChainSummary;
    lines.push("### Supply Chain Risk");
    lines.push("");
    lines.push("| Risk Tier | Repos |");
    lines.push("|-----------|-------|");
    for (const [tier, count] of Object.entries(sc.riskDistribution)) {
      if (count > 0) lines.push(`| ${tier} | ${count} |`);
    }
    lines.push(`| **Total open alerts** | **${sc.totalOpenAlerts}** |`);
    lines.push("");
    if (sc.reposWithCriticalAlerts.length > 0) {
      lines.push(`**Repos with critical supply chain risk:** ${sc.reposWithCriticalAlerts.join(", ")}`);
      lines.push("");
    }
    if (sc.reposWithoutLockfile.length > 0) {
      lines.push(`**Repos without lockfile:** ${sc.reposWithoutLockfile.join(", ")}`);
      lines.push("");
    }
  }

  // Top Risks
  lines.push("## Top Risks");
  lines.push("");
  const severities: Array<"critical" | "high" | "medium"> = ["critical", "high", "medium"];
  for (const sev of severities) {
    const sevRisks = risks.risks.filter((r) => r.severity === sev);
    if (sevRisks.length === 0) continue;
    lines.push(`### ${sev.charAt(0).toUpperCase() + sev.slice(1)}`);
    lines.push("");
    for (const risk of sevRisks) {
      lines.push(`- **${risk.finding}** — ${risk.failCount} repos (${risk.failRate}%) [${risk.category}]`);
      lines.push(`  - ${risk.recommendation}`);
    }
    lines.push("");
  }

  // Quick Wins (>80% fail rate)
  const quickWins = risks.risks.filter((r) => r.failRate > 80);
  if (quickWins.length > 0) {
    lines.push("## Quick Wins");
    lines.push("");
    lines.push("Findings that fail >80% of repos — high-impact fixes:");
    lines.push("");
    for (const risk of quickWins) {
      lines.push(`- [ ] **${risk.finding}** (${risk.failRate}% fail rate) — ${risk.recommendation}`);
    }
    lines.push("");
  }

  // Per-Repo Grades
  lines.push("## Per-Repo Grades");
  lines.push("");
  lines.push("| Repo | Grade | Score | Language | Type |");
  lines.push("|------|-------|-------|----------|------|");
  const sorted = [...reports].sort((a, b) => b.overall - a.overall);
  for (const report of sorted) {
    const repoName = report.repo.split("/")[1] ?? report.repo;
    const grade = report.graded ? report.letter : "N/A";
    const lang = report.language ?? "—";
    lines.push(`| ${repoName} | ${grade} | ${report.overall} | ${lang} | ${report.projectType} |`);
  }
  lines.push("");

  // Recommendations
  lines.push("## Recommendations");
  lines.push("");

  // Quick wins
  const easyFixes = risks.risks.filter((r) => r.failRate > 80 && (r.severity === "critical" || r.severity === "high"));
  if (easyFixes.length > 0) {
    lines.push("### Quick Wins (high impact, low effort)");
    lines.push("");
    for (const fix of easyFixes) {
      lines.push(`1. **${fix.finding}** — ${fix.recommendation} (affects ${fix.failCount} repos)`);
    }
    lines.push("");
  }

  // Medium effort
  const mediumEffort = risks.risks.filter((r) => r.severity === "medium" && r.failRate > 50);
  if (mediumEffort.length > 0) {
    lines.push("### Medium Effort");
    lines.push("");
    for (const fix of mediumEffort) {
      lines.push(`1. **${fix.finding}** — ${fix.recommendation} (affects ${fix.failCount} repos)`);
    }
    lines.push("");
  }

  // Strategic
  const strategic = risks.risks.filter((r) => r.severity === "low" || (r.severity === "medium" && r.failRate <= 50));
  if (strategic.length > 0) {
    lines.push("### Strategic (long-term improvement)");
    lines.push("");
    for (const fix of strategic) {
      lines.push(`1. **${fix.finding}** — ${fix.recommendation} (affects ${fix.failCount} repos)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(chalk.bold(`\n  Org Audit: ${args.org}\n`));

  // Load cache
  const cache = new RepoCache();
  await cache.load();

  if (args.skipDocs) {
    console.log(chalk.gray(`  Cache loaded: ${cache.docRepoCount} cached doc repos`));
  }

  // Fetch org repos
  console.log(chalk.gray(`  Fetching repos for org "${args.org}"...`));
  const slugs = await fetchOrgRepos(args.org);
  console.log(chalk.bold(`  Found ${slugs.length} public non-archived repos\n`));

  if (slugs.length === 0) {
    console.log(chalk.yellow("  No repos to analyze. Exiting."));
    return;
  }

  // Analyze each repo
  const reports: BatchReport[] = [];
  let failed = 0;
  let skippedDoc = 0;
  const total = slugs.length;

  for (let i = 0; i < total; i += args.parallel) {
    const batch = slugs.slice(i, i + args.parallel);

    const results = await Promise.allSettled(
      batch.map(async (slug, batchIdx) => {
        const globalIdx = i + batchIdx;
        const prefix = `  [${globalIdx + 1}/${total}]`;

        // Skip cached documentation/mirror repos
        if (args.skipDocs && cache.isDocRepo(slug)) {
          skippedDoc++;
          console.log(chalk.gray(`${prefix} Skipping ${slug} (cached as doc/mirror)`));
          return null;
        }

        console.log(chalk.cyan(`${prefix} Analyzing ${slug}...`));
        const { report, type } = await analyzeRepo(slug, false);

        // Update cache for doc repos
        if (type === "documentation" || type === "mirror") {
          cache.addDocRepo(slug);
        }

        console.log(
          chalk.green(
            `    Grade: ${report.letter} (${report.overall}/100) in ${(report.totalDurationMs / 1000).toFixed(1)}s`
          )
        );
        return report;
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        if (result.value !== null) {
          reports.push(result.value);
        }
      } else {
        failed++;
        console.error(chalk.red(`    Failed ${batch[j]}: ${result.reason}`));
      }
    }

    // Rate limit delay
    if (i + args.parallel < total && args.delay > 0) {
      await sleep(args.delay);
    }
  }

  // Save cache
  await cache.save();

  // Generate outputs
  const analyzedAt = new Date().toISOString();
  const timestamp = analyzedAt.replace(/:/g, "-").replace(/\..+/, "");
  const auditDir = join(DATA_DIR, "audits", args.org, timestamp);
  const reposDir = join(auditDir, "repos");

  await mkdir(reposDir, { recursive: true });

  // Write individual repo reports
  for (const report of reports) {
    const repoName = report.repo.replace(/[^a-zA-Z0-9._/-]/g, "_").replace("/", "--");
    const filePath = join(reposDir, `${repoName}.json`);
    await writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
  }

  // Build and write summary
  const summary = buildSummary(args.org, reports, analyzedAt);
  await writeFile(join(auditDir, "summary.json"), JSON.stringify(summary, null, 2), "utf-8");

  // Build and write risks
  const risksReport = buildRisks(reports);
  await writeFile(join(auditDir, "risks.json"), JSON.stringify(risksReport, null, 2), "utf-8");

  // Generate and write markdown report
  const markdown = generateOrgMarkdown(summary, risksReport, reports);
  await writeFile(join(auditDir, "report.md"), markdown, "utf-8");

  // Print summary
  console.log(chalk.bold(`\n  Audit Results: ${args.org}`));
  console.log(chalk.gray(`  ─────────────────────────────────────`));
  console.log(`  Repos analyzed: ${chalk.cyan(String(reports.length))}`);
  if (skippedDoc > 0) console.log(`  Skipped (doc/mirror): ${chalk.gray(String(skippedDoc))}`);
  if (failed > 0) console.log(`  Failed: ${chalk.red(String(failed))}`);
  console.log(`  Average score: ${chalk.bold(String(summary.averageScore) + "/100")}`);
  console.log(`  Grade distribution: A:${summary.gradeDistribution.A} B:${summary.gradeDistribution.B} C:${summary.gradeDistribution.C} D:${summary.gradeDistribution.D} F:${summary.gradeDistribution.F}`);
  if (summary.treeAnalytics) {
    const ta = summary.treeAnalytics;
    console.log(`  Avg test ratio: ${chalk.cyan(String(ta.avgTestToSourceRatio))}, monorepos: ${chalk.cyan(String(ta.monorepoCount))}, anti-pattern repos: ${chalk.cyan(String(ta.reposWithAntiPatterns.length))}`);
  }
  if (summary.insightsSummary) {
    const ins = summary.insightsSummary;
    console.log(`  Insights: ${chalk.green(String(ins.positiveCount))} positive, ${chalk.yellow(String(ins.warningCount))} warnings, ${chalk.red(String(ins.criticalCount))} critical`);
  }
  if (summary.supplyChainSummary) {
    const sc = summary.supplyChainSummary;
    const parts: string[] = [];
    for (const [tier, count] of Object.entries(sc.riskDistribution)) {
      if (count > 0) parts.push(`${tier}:${count}`);
    }
    console.log(`  Supply chain risk: ${parts.join(", ")}, ${chalk.yellow(String(sc.totalOpenAlerts))} total open alerts`);
    if (sc.reposWithCriticalAlerts.length > 0) {
      console.log(chalk.red(`  Critical supply chain: ${sc.reposWithCriticalAlerts.join(", ")}`));
    }
  }
  console.log(chalk.gray(`\n  Output: ${auditDir}/`));
  console.log(chalk.gray(`    summary.json  risks.json  report.md  repos/\n`));
}

// Only run main when executed directly (not when imported for testing)
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("org-audit.js") || process.argv[1].endsWith("org-audit.ts"));

if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(chalk.red(`Fatal: ${(err as Error).message}`));
    process.exit(1);
  });
}
