import {
  type RepoTree,
  type RepoMeta,
  treeHasFile,
  treeHasPattern,
  fetchFileContent,
} from "../analyze.js";
import { detectCI, detectDependencyUpdates, detectCodeOwnership, detectSBOM, detectCodeScanning, detectSecretScanning } from "../detectors.js";
import { buildDimensionResult } from "../scoring.js";

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
      passed: true,
      detail: "No GitHub Actions workflows (check not applicable)",
      weight: 0,
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
      passed: true,
      detail: "No GitHub Actions workflows (check not applicable)",
      weight: 0,
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
    treeHasFile(tree, "SECURITY.rst") ||
    treeHasFile(tree, ".github/SECURITY.md") ||
    treeHasFile(tree, "SECURITY_CONTACTS") ||
    treeHasFile(tree, "SECURITY_CONTACTS.md");

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
    : treeHasFile(tree, "SECURITY.rst")
      ? "SECURITY.rst"
      : treeHasFile(tree, ".github/SECURITY.md")
        ? ".github/SECURITY.md"
        : treeHasFile(tree, "SECURITY_CONTACTS")
          ? "SECURITY_CONTACTS"
          : "SECURITY_CONTACTS.md";
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
  const depUpdates = detectDependencyUpdates(tree);
  findings.push({
    name: "Dependency update automation",
    passed: depUpdates.detected,
    detail: depUpdates.detail,
    weight: 15,
  });

  // Code ownership (CODEOWNERS, OWNERS, MAINTAINERS)
  const ownership = detectCodeOwnership(tree);
  findings.push({
    name: "Code ownership",
    passed: ownership.detected,
    detail: ownership.detected
      ? ownership.detail
      : "No code ownership file — add CODEOWNERS or OWNERS for review enforcement",
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

  // .gitattributes (LFS, export-ignore, line ending normalization)
  const hasGitattributes = treeHasFile(tree, ".gitattributes");
  findings.push({
    name: ".gitattributes present",
    passed: hasGitattributes,
    detail: hasGitattributes
      ? ".gitattributes found (LFS/export-ignore configured)"
      : "No .gitattributes",
    weight: 3,
  });

  // SBOM presence (emerging best practice)
  const sbom = detectSBOM(tree);
  const hasWorkflowSBOM =
    workflows.length > 0 &&
    workflows.some(
      (wf) =>
        /syft|cdxgen|sbom/i.test(wf.content)
    );
  const hasSBOM = sbom.detected || hasWorkflowSBOM;
  findings.push({
    name: "SBOM (Software Bill of Materials)",
    passed: hasSBOM,
    detail: hasSBOM
      ? sbom.detected
        ? `SBOM artifact or generator detected (${sbom.detail})`
        : "SBOM generator detected in CI workflow (syft/cdxgen)"
      : "No SBOM — consider generating Software Bill of Materials",
    weight: 5,
  });

  // Code scanning / SAST — tree detection + GitHub security features API (#40)
  const codeScanning = detectCodeScanning(tree);
  const codeScanningAPI = meta.security_and_analysis?.advanced_security?.status === "enabled";
  const codeScanningDetected = codeScanning.detected || codeScanningAPI;
  findings.push({
    name: "Code scanning / SAST",
    passed: codeScanningDetected,
    detail: codeScanningDetected
      ? codeScanningAPI && !codeScanning.detected
        ? "GitHub Advanced Security enabled (API)"
        : `CodeQL or code scanning detected (${codeScanning.detail})`
      : "No SAST/code scanning — consider adding CodeQL or Semgrep",
    weight: 8,
  });

  // Secret scanning — tree detection + GitHub security features API (#40)
  const secretScanning = detectSecretScanning(tree);
  const secretScanningAPI = meta.security_and_analysis?.secret_scanning?.status === "enabled";
  const secretScanningDetected = secretScanning.detected || secretScanningAPI;
  findings.push({
    name: "Secret scanning",
    passed: secretScanningDetected,
    detail: secretScanningDetected
      ? secretScanningAPI && !secretScanning.detected
        ? "GitHub secret scanning enabled (API)"
        : `Secret scanning config found (${secretScanning.detail})`
      : "No secret scanning configuration",
    weight: 8,
  });

  // Push protection — blocks commits containing secrets (#40)
  const pushProtection = meta.security_and_analysis?.secret_scanning_push_protection?.status === "enabled";
  findings.push({
    name: "Push protection",
    passed: pushProtection,
    detail: pushProtection
      ? "Secret scanning push protection enabled — blocks commits with secrets"
      : "Push protection not enabled — secrets can be committed without warning",
    weight: 5,
  });

  // Dependabot security updates — auto-PRs for vulnerable deps (#40)
  const depSecUpdates = meta.security_and_analysis?.dependabot_security_updates?.status === "enabled";
  findings.push({
    name: "Dependabot security updates",
    passed: depSecUpdates,
    detail: depSecUpdates
      ? "Dependabot security updates enabled — auto-PRs for vulnerable dependencies"
      : "Dependabot security updates not enabled",
    weight: 5,
  });

  // GitHub Security Policy enabled (org-level, from GraphQL — #40)
  if (meta.is_security_policy_enabled !== undefined) {
    findings.push({
      name: "GitHub security policy (org-level)",
      passed: meta.is_security_policy_enabled,
      detail: meta.is_security_policy_enabled
        ? "Organization-level security policy enabled via GitHub settings"
        : "No org-level security policy enabled — configure in repository Security tab",
      weight: 5,
    });
  }

  // Dependabot vulnerability alerts enabled (from GraphQL — #40)
  if (meta.dependabotAlerts !== undefined) {
    const alertsEnabled = meta.dependabotAlerts !== null;
    findings.push({
      name: "Dependabot vulnerability alerts",
      passed: alertsEnabled,
      detail: alertsEnabled
        ? `Dependabot alerts enabled (${meta.dependabotAlerts?.totalCount ?? 0} open)`
        : "Dependabot alerts not available — enable in repository Security tab",
      weight: 5,
    });
  }

  // Branch protection (heuristic: repo has CI — any provider)
  const ci = detectCI(tree);
  findings.push({
    name: "CI workflows (branch protection proxy)",
    passed: ci.detected,
    detail: ci.detected
      ? `${ci.detail} found (likely branch protection in place)`
      : "No CI system detected — branch protection is unlikely",
    weight: 10,
  });

  // CI status on default branch (#27)
  if (meta.ciStatus !== undefined) {
    if (meta.ciStatus === "SUCCESS") {
      findings.push({
        name: "CI status (default branch)",
        passed: true,
        detail: "CI passing on default branch",
        weight: 10,
      });
    } else if (meta.ciStatus === "FAILURE") {
      findings.push({
        name: "CI status (default branch)",
        passed: false,
        detail: "CI FAILING on default branch — needs attention",
        weight: 10,
      });
    } else if (meta.ciStatus === "PENDING") {
      findings.push({
        name: "CI status (default branch)",
        passed: true,
        detail: "CI pending on default branch",
        weight: 10,
      });
    } else if (meta.ciStatus === "EXPECTED") {
      findings.push({
        name: "CI status (default branch)",
        passed: true,
        detail: "CI expected on default branch",
        weight: 10,
      });
    }
    // null means no status check rollup — skip (weight 0 via omission)
  }

  return buildDimensionResult("Security", findings, start);
}
