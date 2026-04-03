#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import chalk from "chalk";
import {
  parseRepoSlug,
  fetchRepoMeta,
  fetchRepoTree,
  detectProjectType,
  normalizeLanguage,
} from "./analyze.js";
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
import { explainScore } from "./explain.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
${chalk.bold("repo-health-report")} — Analyze any GitHub repo's health

${chalk.bold("Usage:")}
  repo-health-report <owner/repo>
  repo-health-report <https://github.com/owner/repo>

${chalk.bold("Options:")}
  --output, -o <file>   Write markdown report to file (default: health-report.md)
  --no-file             Skip writing markdown file
  --json                Output JSON instead of terminal rendering
  --ai                  Include AI vote proposal for nexus-agents MCP tools
  --explain             Show detailed scoring breakdown (weights, contributions, grade scale)
  --help, -h            Show this help

${chalk.bold("Examples:")}
  repo-health-report williamzujkowski/nexus-agents
  repo-health-report https://github.com/facebook/react --output react-report.md
  repo-health-report williamzujkowski/nexus-agents --ai
`);
    process.exit(0);
  }

  // Parse flags
  let outputFile = "health-report.md";
  let writeMarkdown = true;
  let jsonOutput = false;
  let aiEnabled = false;
  let explainEnabled = false;
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
    } else if (arg === "--explain") {
      explainEnabled = true;
    } else if (!arg.startsWith("-")) {
      repoArg = arg;
    }
  }

  if (!repoArg) {
    console.error(chalk.red("Error: No repository specified."));
    process.exit(1);
  }

  // Validate input
  let slug: string;
  try {
    slug = parseRepoSlug(repoArg);
  } catch (err) {
    console.error(
      chalk.red((err as Error).message)
    );
    process.exit(1);
  }

  console.log(chalk.gray(`  Analyzing ${slug}...`));

  // Fetch repo metadata, then tree (tree needs the default branch name)
  let meta;
  let tree;
  try {
    meta = await fetchRepoMeta(slug);
    tree = await fetchRepoTree(slug, meta.default_branch);
  } catch (err) {
    console.error(
      chalk.red(`Failed to fetch repo data: ${(err as Error).message}`)
    );
    console.error(
      chalk.gray(
        "Make sure 'gh' CLI is installed and authenticated (gh auth login)."
      )
    );
    process.exit(1);
  }

  const projectType = detectProjectType(tree, slug, meta);
  const language = normalizeLanguage(meta.language, tree);
  if (projectType !== "application") {
    console.log(chalk.gray(`  Detected project type: ${projectType}`));
  }
  if (language !== "other") {
    console.log(chalk.gray(`  Detected language: ${language}`));
  }

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
  const grade = computeGrade(dimensionResults, projectType);

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
    const output = { repo: slug, ...grade, ...(ai ? { ai } : {}) };
    console.log(JSON.stringify(output, null, 2));
  } else {
    renderTerminal(slug, grade, ai);
  }

  // Explain scoring breakdown
  if (explainEnabled && !jsonOutput) {
    console.log(explainScore(grade, projectType));
  }

  // Write markdown
  if (writeMarkdown) {
    const md = generateMarkdown(slug, grade, ai);
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
