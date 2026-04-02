import {
  type RepoTree,
  type RepoMeta,
  treeHasFile,
  treeHasPattern,
  fetchFileContent,
} from "../analyze.js";

export interface Finding {
  name: string;
  passed: boolean;
  detail: string;
  weight: number;
}

export interface DimensionResult {
  name: string;
  score: number;
  findings: Finding[];
  durationMs: number;
}

/** Match GitHub Actions `uses:` lines and extract the ref after `@`. */
const USES_PATTERN = /uses:\s*[\w.\-]+\/[\w.\-]+@([a-zA-Z0-9._\-]+)/g;

/** A SHA ref is exactly 40 hex characters. */
function isShaRef(ref: string): boolean {
  return /^[0-9a-f]{40}$/i.test(ref);
}

/**
 * Collect workflow file paths from the tree (up to `limit`).
 */
function getWorkflowPaths(tree: RepoTree, limit: number): string[] {
  return tree.tree
    .filter((e) => /^\.github\/workflows\/.*\.ya?ml$/.test(e.path))
    .slice(0, limit)
    .map((e) => e.path);
}

/**
 * Fetch up to `limit` workflow file contents.
 * Returns an array of { path, content } for files that were successfully fetched.
 */
async function fetchWorkflowContents(
  slug: string,
  tree: RepoTree,
  limit: number = 3
): Promise<Array<{ path: string; content: string }>> {
  const paths = getWorkflowPaths(tree, limit);
  const results: Array<{ path: string; content: string }> = [];
  for (const p of paths) {
    const content = await fetchFileContent(slug, p);
    if (content) {
      results.push({ path: p, content });
    }
  }
  return results;
}

/**
 * Check #1: Pinned Dependencies (OpenSSF Scorecard inspired).
 * Checks whether GitHub Actions in workflow files are pinned to SHA refs.
 */
function checkPinnedDeps(
  workflows: Array<{ path: string; content: string }>
): Finding {
  if (workflows.length === 0) {
    return {
      name: "Pinned dependencies (Actions SHA)",
      passed: false,
      detail: "No workflow files found to check",
      weight: 15,
    };
  }

  let totalRefs = 0;
  let shaRefs = 0;

  for (const wf of workflows) {
    let match: RegExpExecArray | null;
    const re = new RegExp(USES_PATTERN.source, "g");
    while ((match = re.exec(wf.content)) !== null) {
      totalRefs++;
      if (isShaRef(match[1])) {
        shaRefs++;
      }
    }
  }

  if (totalRefs === 0) {
    return {
      name: "Pinned dependencies (Actions SHA)",
      passed: true,
      detail: "No third-party action references found in workflows",
      weight: 15,
    };
  }

  const pct = Math.round((shaRefs / totalRefs) * 100);
  const passed = pct > 50;
  return {
    name: "Pinned dependencies (Actions SHA)",
    passed,
    detail: `${shaRefs}/${totalRefs} action refs pinned to SHA (${pct}%)${passed ? "" : " — pin actions to full commit SHA for supply-chain safety"}`,
    weight: 15,
  };
}

/**
 * Check #2: Token Permissions (OpenSSF Scorecard inspired).
 * Checks whether workflows use minimal (explicit) permissions.
 */
function checkTokenPermissions(
  workflows: Array<{ path: string; content: string }>
): Finding {
  if (workflows.length === 0) {
    return {
      name: "Token permissions",
      passed: false,
      detail: "No workflow files found to check",
      weight: 10,
    };
  }

  let hasExplicitRestrictive = false;
  let hasWriteAll = false;

  for (const wf of workflows) {
    // Check for top-level permissions block
    // Match `permissions:` that is NOT indented (top-level)
    const permMatch = wf.content.match(/^permissions:\s*(.*)$/m);
    if (permMatch) {
      const value = permMatch[1].trim();
      if (value === "write-all" || value === "{}") {
        // write-all is bad, {} is empty but explicit (actually means none)
        if (value === "write-all") {
          hasWriteAll = true;
        } else {
          hasExplicitRestrictive = true;
        }
      } else if (value === "read-all") {
        hasExplicitRestrictive = true;
      } else if (value === "") {
        // Multi-line permissions block — explicit restrictive
        hasExplicitRestrictive = true;
      } else {
        // Single-line like `permissions: contents: read` — restrictive
        hasExplicitRestrictive = true;
      }
    }
    // No permissions block at all defaults to write-all — not flagged as writeAll
    // but not counted as restrictive either
  }

  if (hasExplicitRestrictive) {
    return {
      name: "Token permissions",
      passed: true,
      detail: "At least one workflow uses explicit restrictive permissions",
      weight: 10,
    };
  }

  return {
    name: "Token permissions",
    passed: false,
    detail: hasWriteAll
      ? "Workflow uses `permissions: write-all` — restrict to minimal scopes"
      : "No workflow has an explicit `permissions:` block — defaults to write-all",
    weight: 10,
  };
}

/**
 * Check #5: Enhanced SECURITY.md quality check.
 * Checks existence, content length, contact info, and disclosure timeline.
 */
async function checkSecurityMdQuality(
  tree: RepoTree,
  slug: string
): Promise<Finding> {
  const hasSecurityMd =
    treeHasFile(tree, "SECURITY.md") ||
    treeHasFile(tree, ".github/SECURITY.md");

  if (!hasSecurityMd) {
    return {
      name: "Security policy (SECURITY.md)",
      passed: false,
      detail: "No SECURITY.md — add a vulnerability disclosure policy",
      weight: 25,
    };
  }

  // Try to fetch content for quality assessment
  const secPath = treeHasFile(tree, "SECURITY.md")
    ? "SECURITY.md"
    : ".github/SECURITY.md";
  const content = await fetchFileContent(slug, secPath);

  if (!content || content.length < 200) {
    return {
      name: "Security policy (SECURITY.md)",
      passed: false,
      detail:
        "SECURITY.md exists but appears to be a placeholder (< 200 chars) — add contact info and disclosure process",
      weight: 25,
    };
  }

  const lower = content.toLowerCase();
  const hasContactInfo =
    /[\w.-]+@[\w.-]+\.\w{2,}/.test(content) || lower.includes("report");
  const hasDisclosureTimeline =
    lower.includes("90 day") ||
    lower.includes("90-day") ||
    lower.includes("responsible disclosure") ||
    lower.includes("disclosure") ||
    lower.includes("coordinated");

  const qualities: string[] = [];
  if (hasContactInfo) qualities.push("contact info");
  if (hasDisclosureTimeline) qualities.push("disclosure process");

  if (qualities.length >= 1) {
    return {
      name: "Security policy (SECURITY.md)",
      passed: true,
      detail: `Security policy found with ${qualities.join(" and ")} (${content.length} chars)`,
      weight: 25,
    };
  }

  return {
    name: "Security policy (SECURITY.md)",
    passed: false,
    detail:
      "SECURITY.md exists but lacks contact info or disclosure timeline — improve the policy",
    weight: 25,
  };
}

export async function analyzeSecurityDimension(
  tree: RepoTree,
  meta: RepoMeta,
  slug: string
): Promise<DimensionResult> {
  const start = performance.now();
  const findings: Finding[] = [];

  // Fetch workflow contents once, reused by pinned-deps and token-permissions
  const workflows = await fetchWorkflowContents(slug, tree, 3);

  // Enhanced SECURITY.md quality check (#5)
  findings.push(await checkSecurityMdQuality(tree, slug));

  // Pinned Dependencies (#1)
  findings.push(checkPinnedDeps(workflows));

  // Token Permissions (#2)
  findings.push(checkTokenPermissions(workflows));

  // Dependabot or Renovate
  const hasDependabot =
    treeHasFile(tree, ".github/dependabot.yml") ||
    treeHasFile(tree, ".github/dependabot.yaml");
  const hasRenovate =
    treeHasFile(tree, "renovate.json") ||
    treeHasFile(tree, ".github/renovate.json") ||
    treeHasFile(tree, "renovate.json5");
  const hasDepUpdater = hasDependabot || hasRenovate;
  findings.push({
    name: "Dependency update automation",
    passed: hasDepUpdater,
    detail: hasDepUpdater
      ? `Using ${hasDependabot ? "Dependabot" : "Renovate"}`
      : "No Dependabot or Renovate config found",
    weight: 15,
  });

  // CODEOWNERS
  const hasCodeowners =
    treeHasFile(tree, "CODEOWNERS") ||
    treeHasFile(tree, ".github/CODEOWNERS") ||
    treeHasFile(tree, "docs/CODEOWNERS");
  findings.push({
    name: "CODEOWNERS file",
    passed: hasCodeowners,
    detail: hasCodeowners
      ? "CODEOWNERS file found"
      : "No CODEOWNERS — add ownership for review enforcement",
    weight: 5,
  });

  // No committed secrets patterns (check for .env files in tree)
  const hasEnvFiles = treeHasPattern(
    tree,
    /(?:^|\/)\.env(?:\.local|\.production|\.staging)?$/
  );
  findings.push({
    name: "No committed .env files",
    passed: !hasEnvFiles,
    detail: hasEnvFiles
      ? "Found .env files in repo — these may contain secrets"
      : "No .env files committed",
    weight: 10,
  });

  // .gitignore exists
  const hasGitignore = treeHasFile(tree, ".gitignore");
  findings.push({
    name: ".gitignore present",
    passed: hasGitignore,
    detail: hasGitignore
      ? ".gitignore found"
      : "No .gitignore — secrets and build artifacts may be committed",
    weight: 10,
  });

  // Branch protection (heuristic: repo has required status checks visible via default branch)
  const hasCi = treeHasPattern(tree, /^\.github\/workflows\/.*\.ya?ml$/);
  findings.push({
    name: "CI workflows (branch protection proxy)",
    passed: hasCi,
    detail: hasCi
      ? "CI workflows found (likely branch protection in place)"
      : "No CI workflows — branch protection is unlikely",
    weight: 10,
  });

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const earnedWeight = findings
    .filter((f) => f.passed)
    .reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return {
    name: "Security",
    score,
    findings,
    durationMs: performance.now() - start,
  };
}
