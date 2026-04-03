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

  // README exists and has meaningful content (support .md, .rst, or no extension)
  let readmeContent = await fetchFileContent(slug, "README.md");
  let readmeFile = "README.md";
  if (!readmeContent) {
    readmeContent = await fetchFileContent(slug, "README.rst");
    readmeFile = "README.rst";
  }
  if (!readmeContent) {
    readmeContent = await fetchFileContent(slug, "README");
    readmeFile = "README";
  }
  const readmeLength = readmeContent?.length ?? 0;
  const hasGoodReadme = readmeLength > 500;
  findings.push({
    name: "README quality",
    passed: hasGoodReadme,
    detail: readmeContent
      ? `${readmeFile} is ${readmeLength} chars${readmeLength < 500 ? " (too short — aim for 500+)" : ""}`
      : "No README found (.md, .rst, or plain)",
    weight: 30,
  });

  // LICENSE (many naming conventions: COPYING for GPL, LICENCE for British spelling, licenses/ directory)
  const hasLicense =
    treeHasFile(tree, "LICENSE") ||
    treeHasFile(tree, "LICENSE.md") ||
    treeHasFile(tree, "LICENSE.txt") ||
    treeHasFile(tree, "LICENCE") ||
    treeHasFile(tree, "LICENCE.md") ||
    treeHasFile(tree, "COPYING") ||
    treeHasFile(tree, "COPYING.md") ||
    treeHasPattern(tree, /^licenses\//) ||
    meta.license !== null;
  findings.push({
    name: "LICENSE file",
    passed: hasLicense,
    detail: hasLicense
      ? `License: ${meta.license?.spdx_id ?? "found"}`
      : "No LICENSE file — projects without a license are not legally usable",
    weight: 20,
  });

  // CONTRIBUTING guide (.md or .rst)
  const hasContributing =
    treeHasFile(tree, "CONTRIBUTING.md") ||
    treeHasFile(tree, "CONTRIBUTING.rst") ||
    treeHasFile(tree, ".github/CONTRIBUTING.md");
  findings.push({
    name: "CONTRIBUTING guide",
    passed: hasContributing,
    detail: hasContributing
      ? "Contributing guide found"
      : "No CONTRIBUTING guide — makes it harder for contributors to get started",
    weight: 15,
  });

  // CHANGELOG (many naming conventions across ecosystems; ansible uses changelogs/ directory)
  const hasChangelog =
    treeHasFile(tree, "CHANGELOG.md") ||
    treeHasFile(tree, "CHANGELOG.rst") ||
    treeHasFile(tree, "CHANGELOG") ||
    treeHasFile(tree, "CHANGES.md") ||
    treeHasFile(tree, "CHANGES.rst") ||
    treeHasFile(tree, "CHANGES") ||
    treeHasFile(tree, "HISTORY.md") ||
    treeHasFile(tree, "HISTORY.rst") ||
    treeHasFile(tree, "NEWS") ||
    treeHasFile(tree, "NEWS.md") ||
    treeHasFile(tree, "NEWS.rst") ||
    treeHasFile(tree, "release-notes.md") ||
    treeHasPattern(tree, /^docs\/releases\//) ||
    treeHasPattern(tree, /^docs\/changelog/i) ||
    treeHasPattern(tree, /^changelogs\//);
  findings.push({
    name: "CHANGELOG",
    passed: hasChangelog,
    detail: hasChangelog
      ? "Changelog or release notes found"
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
