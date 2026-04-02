#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import chalk from "chalk";
import {
  parseRepoSlug,
  fetchRepoMeta,
  fetchRepoTree,
} from "./analyze.js";
import { analyzeSecurityDimension } from "./dimensions/security.js";
import { analyzeTestingDimension } from "./dimensions/testing.js";
import { analyzeDocsDimension } from "./dimensions/docs.js";
import { analyzeArchitectureDimension } from "./dimensions/architecture.js";
import { analyzeDevOpsDimension } from "./dimensions/devops.js";
import { computeGrade } from "./grader.js";
import { renderTerminal } from "./render.js";
import { generateMarkdown } from "./report.js";

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
  --help, -h            Show this help

${chalk.bold("Examples:")}
  repo-health-report williamzujkowski/nexus-agents
  repo-health-report https://github.com/facebook/react --output react-report.md
`);
    process.exit(0);
  }

  // Parse flags
  let outputFile = "health-report.md";
  let writeMarkdown = true;
  let jsonOutput = false;
  let repoArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      outputFile = args[++i] ?? "health-report.md";
    } else if (arg === "--no-file") {
      writeMarkdown = false;
    } else if (arg === "--json") {
      jsonOutput = true;
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

  // Run all 5 dimensions in parallel
  const dimensionResults = await Promise.all([
    analyzeSecurityDimension(tree, meta, slug),
    analyzeTestingDimension(tree, meta, slug),
    analyzeDocsDimension(tree, meta, slug),
    analyzeArchitectureDimension(tree, meta, slug),
    analyzeDevOpsDimension(tree, meta, slug),
  ]);

  // Compute grade
  const grade = computeGrade(dimensionResults);

  // Output
  if (jsonOutput) {
    console.log(JSON.stringify({ repo: slug, ...grade }, null, 2));
  } else {
    renderTerminal(slug, grade);
  }

  // Write markdown
  if (writeMarkdown) {
    const md = generateMarkdown(slug, grade);
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
