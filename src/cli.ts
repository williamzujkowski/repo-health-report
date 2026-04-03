#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import chalk from "chalk";
import {
  parseRepoSlug,
  fetchRepoMeta,
  fetchRepoMetaGraphQL,
  fetchRepoTree,
  detectProjectType,
  detectRepoSize,
  normalizeLanguage,
  detectAllLanguages,
} from "./analyze.js";
import { computeTreeAnalytics } from "./tree-analytics.js";
import { detectPlatform } from "./platforms.js";
import type { PlatformConfig } from "./platforms.js";
import {
  fetchGitLabMeta,
  fetchGitLabTree,
  fetchCodebergMeta,
  fetchCodebergTree,
} from "./platform-apis.js";
import { analyzeSecurityDimension } from "./dimensions/security.js";
import { analyzeTestingDimension } from "./dimensions/testing.js";
import { analyzeDocsDimension } from "./dimensions/docs.js";
import { analyzeArchitectureDimension } from "./dimensions/architecture.js";
import { analyzeDevOpsDimension } from "./dimensions/devops.js";
import { analyzeMaintenanceDimension } from "./dimensions/maintenance.js";
import { computeGrade } from "./grader.js";
import { renderTerminal } from "./render.js";
import { generateMarkdown } from "./report.js";
import { getUnavailableResult, buildVoteProposal } from "./ai-analysis.js";
import type { AiAnalysisResult } from "./ai-analysis.js";
import { detectAiContributors } from "./ai-contributors.js";
import type { AiContributorResult } from "./ai-contributors.js";
import { explainScore } from "./explain.js";
import {
  fetchScorecard,
  fetchDepsDevInfo,
  detectPackageInfo,
} from "./external-apis.js";
import type { ScorecardResult, DepsDevResult } from "./external-apis.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
${chalk.bold("repo-health-report")} — Analyze any GitHub, GitLab, or Codeberg repo's health

${chalk.bold("Usage:")}
  repo-health-report <owner/repo>
  repo-health-report <https://github.com/owner/repo>
  repo-health-report <https://gitlab.com/owner/repo>
  repo-health-report <https://codeberg.org/owner/repo>

${chalk.bold("Options:")}
  --output, -o <file>   Write markdown report to file (default: health-report.md)
  --no-file             Skip writing markdown file
  --json                Output JSON instead of terminal rendering
  --ai                  Include AI vote proposal for nexus-agents MCP tools
  --scorecard           Fetch OpenSSF Scorecard + deps.dev dependent count (external APIs)
  --explain             Show detailed scoring breakdown (weights, contributions, grade scale)
  --ai-contributors     Detect AI agent and automation bot contributors (extra API calls)
  --help, -h            Show this help

${chalk.bold("Batch & Org Commands:")}
  npm run batch -- --file repos.txt    Batch-analyze repos from a file
  npm run org-audit -- --org cloud-gov Audit all repos in a GitHub organization

${chalk.bold("Examples:")}
  repo-health-report williamzujkowski/nexus-agents
  repo-health-report https://github.com/facebook/react --output react-report.md
  repo-health-report https://gitlab.com/inkscape/inkscape
  repo-health-report https://codeberg.org/forgejo/forgejo
  repo-health-report williamzujkowski/nexus-agents --ai
  repo-health-report williamzujkowski/nexus-agents --scorecard
`);
    process.exit(0);
  }

  // Parse flags
  let outputFile = "health-report.md";
  let writeMarkdown = true;
  let jsonOutput = false;
  let aiEnabled = false;
  let scorecardEnabled = false;
  let explainEnabled = false;
  let aiContributorsEnabled = false;
  let repoArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      outputFile = args[++i] ?? "health-report.md";
    } else if (arg === "--no-file") {
      writeMarkdown = false;
    } else if (arg === "--json") {
      jsonOutput = true;
    } else if (arg === "--ai") {
      aiEnabled = true;
    } else if (arg === "--scorecard") {
      scorecardEnabled = true;
    } else if (arg === "--explain") {
      explainEnabled = true;
    } else if (arg === "--ai-contributors") {
      aiContributorsEnabled = true;
    } else if (!arg.startsWith("-")) {
      repoArg = arg;
    }
  }

  if (!repoArg) {
    console.error(chalk.red("Error: No repository specified."));
    process.exit(1);
  }

  // Detect platform and validate input
  let platformConfig: PlatformConfig;
  let slug: string;
  try {
    platformConfig = detectPlatform(repoArg);
    slug = platformConfig.slug;
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  if (platformConfig.platform !== "github") {
    console.log(
      chalk.gray(`  Platform: ${platformConfig.platform}`)
    );
  }
  console.log(chalk.gray(`  Analyzing ${slug}...`));

  // Fetch repo metadata, then tree (tree needs the default branch name)
  let meta;
  let tree;
  try {
    if (platformConfig.platform === "gitlab") {
      meta = await fetchGitLabMeta(platformConfig.apiBase, slug);
      tree = await fetchGitLabTree(
        platformConfig.apiBase,
        slug,
        meta.default_branch
      );
    } else if (platformConfig.platform === "codeberg") {
      meta = await fetchCodebergMeta(platformConfig.apiBase, slug);
      tree = await fetchCodebergTree(
        platformConfig.apiBase,
        slug,
        meta.default_branch
      );
    } else {
      // GitHub — try GraphQL first (richer metadata, one request), fall back to REST
      const ghSlug = parseRepoSlug(repoArg);
      try {
        meta = await fetchRepoMetaGraphQL(ghSlug);
      } catch {
        meta = await fetchRepoMeta(ghSlug);
      }
      tree = await fetchRepoTree(ghSlug, meta.default_branch);
    }
  } catch (err) {
    console.error(
      chalk.red(`Failed to fetch repo data: ${(err as Error).message}`)
    );
    if (platformConfig.platform === "github") {
      console.error(
        chalk.gray(
          "Make sure 'gh' CLI is installed and authenticated (gh auth login)."
        )
      );
    }
    process.exit(1);
  }

  const projectType = detectProjectType(tree, slug, meta);
  const sizeTier = detectRepoSize(tree);
  const language = normalizeLanguage(meta.language, tree);
  const languages = detectAllLanguages(tree, meta.language);
  if (projectType !== "application") {
    console.log(chalk.gray(`  Detected project type: ${projectType}`));
  }
  if (sizeTier !== "medium") {
    console.log(chalk.gray(`  Detected repo size: ${sizeTier}`));
  }
  if (languages.all.length > 1) {
    const langStr = languages.all
      .map((l) => `${l.language} (${l.percentage}%)`)
      .join(", ");
    console.log(chalk.gray(`  Languages: ${langStr}`));
  } else if (language !== "other") {
    console.log(chalk.gray(`  Detected language: ${language}`));
  }

  // Zero-cost tree analytics
  const analytics = computeTreeAnalytics(tree);
  console.log(
    chalk.gray(
      `  Analytics: ${analytics.fileCount} files, ${analytics.directoryCount} dirs, depth ${analytics.maxDepth}, test ratio ${analytics.testToSourceRatio}, config ${analytics.configScore}/10, ${analytics.antiPatternCount} anti-patterns`
    )
  );

  // Run all 6 dimensions in parallel
  const dimensionResults = await Promise.all([
    analyzeSecurityDimension(tree, meta, slug),
    analyzeTestingDimension(tree, meta, slug, projectType),
    analyzeDocsDimension(tree, meta, slug),
    analyzeArchitectureDimension(tree, meta, slug, projectType, language),
    analyzeDevOpsDimension(tree, meta, slug, projectType),
    analyzeMaintenanceDimension(tree, meta, slug),
  ]);

  // Compute grade
  const grade = computeGrade(dimensionResults, projectType, sizeTier);

  // External APIs: when --scorecard is used, fetch Scorecard + deps.dev
  let scorecard: ScorecardResult | null = null;
  let depsDev: DepsDevResult | null = null;
  if (scorecardEnabled) {
    console.log(chalk.gray("  Fetching OpenSSF Scorecard..."));
    const treePaths = tree.tree.map((f) => f.path);
    // Detect npm package name from package.json if present
    let packageJsonName: string | undefined;
    if (treePaths.includes("package.json")) {
      try {
        const { ghApi } = await import("./analyze.js");
        const pkgContent = await ghApi<{ content: string; encoding: string }>(
          `/repos/${slug}/contents/package.json`,
          { paginate: false }
        );
        if (pkgContent?.encoding === "base64") {
          const decoded = Buffer.from(pkgContent.content.replace(/\s/g, ""), "base64").toString("utf-8");
          const pkg = JSON.parse(decoded) as { name?: string };
          if (typeof pkg.name === "string") packageJsonName = pkg.name;
        }
      } catch {
        // package.json name not available — continue
      }
    }
    const [scorecardResult, pkgInfo] = await Promise.all([
      fetchScorecard(slug),
      Promise.resolve(detectPackageInfo(treePaths, packageJsonName)),
    ]);
    scorecard = scorecardResult;
    if (pkgInfo) {
      console.log(chalk.gray(`  Fetching deps.dev info for ${pkgInfo.system}/${pkgInfo.packageName}...`));
      depsDev = await fetchDepsDevInfo(pkgInfo.packageName, pkgInfo.system);
    }
  }

  // AI contributors: when --ai-contributors is used, detect bot and AI agents
  let aiContributors: AiContributorResult | null = null;
  if (aiContributorsEnabled && platformConfig.platform === "github") {
    console.log(chalk.gray("  Detecting AI contributors..."));
    aiContributors = await detectAiContributors(slug);
  }

  // AI analysis: when --ai is used, output a vote proposal for nexus-agents MCP
  let ai: AiAnalysisResult | undefined;
  if (aiEnabled) {
    const proposal = buildVoteProposal(slug, projectType, dimensionResults, grade.letter, grade.overall);
    if (jsonOutput) {
      // In JSON mode, include the vote proposal for MCP tool consumption
      ai = {
        available: true,
        experts: [],
        consensus: null,
        error: undefined,
        voteProposal: proposal,
      } as AiAnalysisResult & { voteProposal: string };
    } else {
      // In terminal mode, show instructions for MCP integration
      const result = getUnavailableResult();
      result.error =
        `AI analysis works via nexus-agents MCP tools in Claude Code.\n` +
        `  Use: repo-health-report ${slug} --json --ai | then feed to nexus-agents MCP\n` +
        `  Or use the /analyze Claude Code command.\n\n` +
        `  Vote proposal for nexus-agents consensus_vote:\n` +
        `  "${proposal.substring(0, 200)}..."`;
      ai = result;
    }
  }

  // Output
  if (jsonOutput) {
    const output = {
      repo: slug,
      platform: platformConfig.platform,
      ...grade,
      ...(ai ? { ai } : {}),
      ...(scorecard ? { scorecard } : {}),
      ...(depsDev ? { depsDev } : {}),
      ...(aiContributors ? { aiContributors } : {}),
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    renderTerminal(slug, grade, ai);
    // Scorecard terminal display
    if (scorecard) {
      const scoreLine = scorecard.score.toFixed(1);
      const scoreColor =
        scorecard.score >= 7
          ? chalk.green
          : scorecard.score >= 4
            ? chalk.yellow
            : chalk.red;
      console.log(
        chalk.bold(`\n  OpenSSF Scorecard: ${scoreColor(scoreLine + "/10")}`) +
          (scorecard.date ? chalk.gray(` (${scorecard.date})`) : "")
      );
      for (const check of scorecard.checks.slice(0, 10)) {
        const icon =
          check.score >= 7 ? chalk.green("✔") : check.score >= 4 ? chalk.yellow("?") : chalk.red("✘");
        const scoreStr = check.score >= 0 ? ` ${check.score}/10` : " N/A";
        console.log(`    ${icon} ${check.name}:${scoreStr}`);
      }
    } else if (scorecardEnabled) {
      console.log(chalk.gray("  OpenSSF Scorecard: not indexed for this repo"));
    }
    // deps.dev dependent count display
    if (depsDev) {
      const countStr = depsDev.dependentCount.toLocaleString();
      console.log(
        chalk.bold(`\n  deps.dev dependents: ${chalk.cyan(countStr)}`) +
          (depsDev.latestVersion ? chalk.gray(` (latest: ${depsDev.latestVersion})`) : "")
      );
    }
    if (scorecard || depsDev) console.log("");
    // AI contributors display
    if (aiContributors) {
      console.log(chalk.bold("\n  AI Contributors:"));
      if (
        aiContributors.botContributors.length === 0 &&
        aiContributors.aiTrailers.length === 0
      ) {
        console.log(chalk.gray("    (none detected)"));
      } else {
        for (const bot of aiContributors.botContributors) {
          const icon = bot.type === "ai" ? chalk.cyan("🧠") : chalk.gray("🤖");
          console.log(
            `    ${icon} ${chalk.white(bot.login)} ${chalk.gray(`(${bot.type}, ${bot.contributions} commits)`)}`
          );
        }
        for (const trailer of aiContributors.aiTrailers) {
          console.log(
            `    ${chalk.cyan("🧠")} Co-Authored-By: ${chalk.white(trailer.agent)} ${chalk.gray(`— found in ${trailer.count}/20 recent commits`)}`
          );
        }
      }
      const levelColor =
        aiContributors.automationLevel === "none"
          ? chalk.gray
          : aiContributors.automationLevel === "low"
            ? chalk.blue
            : aiContributors.automationLevel === "medium"
              ? chalk.yellow
              : chalk.cyan;
      console.log(
        `\n  ${chalk.bold("Automation level:")} ${levelColor(aiContributors.automationLevel)}`
      );
      console.log("");
    }
  }

  // Explain scoring breakdown
  if (explainEnabled && !jsonOutput) {
    console.log(explainScore(grade, projectType));
  }

  // Write markdown
  if (writeMarkdown) {
    const md = generateMarkdown(slug, grade, ai, scorecard, depsDev);
    await writeFile(outputFile, md, "utf-8");
    if (!jsonOutput) {
      console.log(
        chalk.gray(`  Report written to ${chalk.white(outputFile)}`)
      );
      console.log("");
    }
  }
}

main().catch((err: unknown) => {
  console.error(chalk.red(`Fatal: ${(err as Error).message}`));
  process.exit(1);
});
