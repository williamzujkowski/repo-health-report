import {
  type RepoTree,
  type RepoMeta,
  treeHasFile,
  treeHasPattern,
  fetchFileContent,
} from "../analyze.js";
import type { DimensionResult, Finding } from "./security.js";

export async function analyzeDocsDimension(
  tree: RepoTree,
  meta: RepoMeta,
  slug: string
): Promise<DimensionResult> {
  const start = performance.now();
  const findings: Finding[] = [];

  // README.md exists and has meaningful content
  const readmeContent = await fetchFileContent(slug, "README.md");
  const readmeLength = readmeContent?.length ?? 0;
  const hasGoodReadme = readmeLength > 500;
  findings.push({
    name: "README.md quality",
    passed: hasGoodReadme,
    detail: readmeContent
      ? `README.md is ${readmeLength} chars${readmeLength < 500 ? " (too short — aim for 500+)" : ""}`
      : "No README.md found",
    weight: 30,
  });

  // LICENSE
  const hasLicense =
    treeHasFile(tree, "LICENSE") ||
    treeHasFile(tree, "LICENSE.md") ||
    treeHasFile(tree, "LICENSE.txt") ||
    meta.license !== null;
  findings.push({
    name: "LICENSE file",
    passed: hasLicense,
    detail: hasLicense
      ? `License: ${meta.license?.spdx_id ?? "found"}`
      : "No LICENSE file — projects without a license are not legally usable",
    weight: 20,
  });

  // CONTRIBUTING.md
  const hasContributing =
    treeHasFile(tree, "CONTRIBUTING.md") ||
    treeHasFile(tree, ".github/CONTRIBUTING.md");
  findings.push({
    name: "CONTRIBUTING.md",
    passed: hasContributing,
    detail: hasContributing
      ? "Contributing guide found"
      : "No CONTRIBUTING.md — makes it harder for contributors to get started",
    weight: 15,
  });

  // CHANGELOG
  const hasChangelog =
    treeHasFile(tree, "CHANGELOG.md") ||
    treeHasFile(tree, "CHANGELOG") ||
    treeHasFile(tree, "HISTORY.md") ||
    treeHasFile(tree, "CHANGES.md");
  findings.push({
    name: "CHANGELOG",
    passed: hasChangelog,
    detail: hasChangelog
      ? "Changelog found"
      : "No CHANGELOG — users can't see what changed between versions",
    weight: 15,
  });

  // API docs or docs directory
  const hasDocs =
    treeHasPattern(tree, /^docs\//) ||
    treeHasPattern(tree, /^doc\//) ||
    treeHasFile(tree, "API.md");
  findings.push({
    name: "Documentation directory or API docs",
    passed: hasDocs,
    detail: hasDocs
      ? "Documentation directory or API docs found"
      : "No docs/ directory or API.md",
    weight: 10,
  });

  // Description set
  const hasDescription = Boolean(meta.description);
  findings.push({
    name: "Repository description",
    passed: hasDescription,
    detail: hasDescription
      ? `Description: "${meta.description}"`
      : "No repo description set on GitHub",
    weight: 10,
  });

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const earnedWeight = findings
    .filter((f) => f.passed)
    .reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return {
    name: "Documentation",
    score,
    findings,
    durationMs: performance.now() - start,
  };
}
