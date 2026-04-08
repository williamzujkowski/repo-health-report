import { type RepoTree, treeHasFile, treeHasPattern } from "./analyze.js";

export interface DetectorResult {
  detected: boolean;
  detail: string;
}

// --- CI Detectors ---

/**
 * Shared CI system registry. Single source of truth for all CI detection.
 */
function getCIChecks(tree: RepoTree): Array<[() => boolean, string]> {
  return [
    [() => treeHasPattern(tree, /^\.github\/workflows\/.*\.ya?ml$/), "GitHub Actions"],
    [() => treeHasFile(tree, "Jenkinsfile"), "Jenkins"],
    [() => treeHasPattern(tree, /^\.circleci\//), "CircleCI"],
    [() => treeHasFile(tree, ".travis.yml"), "Travis CI"],
    [() => treeHasFile(tree, "azure-pipelines.yml") || treeHasPattern(tree, /^\.azure-pipelines\//), "Azure Pipelines"],
    [() => treeHasPattern(tree, /^\.buildkite\//), "Buildkite"],
    [() => treeHasPattern(tree, /^ci\/pipeline\.ya?ml$/) || treeHasFile(tree, "pipeline.yml") || treeHasFile(tree, "ci/pipeline.yml"), "Concourse"],
    [() => treeHasFile(tree, ".zuul.yaml") || treeHasFile(tree, "zuul.yaml"), "Zuul"],
    [() => treeHasFile(tree, ".gitlab-ci.yml"), "GitLab CI"],
    [() => treeHasFile(tree, "Makefile") && treeHasFile(tree, "OWNERS"), "Prow (inferred)"],
    [() => treeHasFile(tree, "appveyor.yml"), "AppVeyor"],
    [() => treeHasFile(tree, "Taskfile.yml") || treeHasFile(tree, "Taskfile.yaml"), "Task"],
    [() => treeHasPattern(tree, /^ci\//), "CI directory"],
  ];
}

/**
 * Detect the first CI system found (returns on first match).
 */
export function detectCI(tree: RepoTree): DetectorResult {
  for (const [check, name] of getCIChecks(tree)) {
    if (check()) return { detected: true, detail: name };
  }
  return { detected: false, detail: "No CI system detected" };
}

/**
 * Detect all CI systems present (returns combined detail string).
 * Used by devops dimension which wants to list all found systems.
 */
export function detectAllCI(tree: RepoTree): DetectorResult {
  const found: string[] = [];
  for (const [check, name] of getCIChecks(tree)) {
    if (check()) found.push(name);
  }
  if (found.length > 0) {
    return { detected: true, detail: found.join(", ") };
  }
  return { detected: false, detail: "No CI system detected" };
}

// --- Dependency Update Detectors ---
export function detectDependencyUpdates(tree: RepoTree): DetectorResult {
  const checks: Array<[() => boolean, string]> = [
    [() => treeHasPattern(tree, /^\.github\/dependabot\.ya?ml$/), "Dependabot"],
    [() => treeHasFile(tree, "renovate.json") || treeHasFile(tree, "renovate.json5") || treeHasFile(tree, ".renovaterc") || treeHasFile(tree, ".renovaterc.json"), "Renovate"],
    [() => treeHasFile(tree, ".github/renovate.json"), "Renovate"],
  ];
  for (const [check, name] of checks) {
    if (check()) return { detected: true, detail: `Using ${name}` };
  }
  return { detected: false, detail: "No Dependabot or Renovate config found" };
}

// --- Code Ownership Detectors ---
export function detectCodeOwnership(tree: RepoTree): DetectorResult {
  const checks: Array<[() => boolean, string]> = [
    [() => treeHasFile(tree, "CODEOWNERS") || treeHasFile(tree, ".github/CODEOWNERS") || treeHasFile(tree, "docs/CODEOWNERS"), "CODEOWNERS"],
    [() => treeHasFile(tree, "OWNERS"), "OWNERS (Kubernetes-style)"],
    [() => treeHasFile(tree, "OWNERS_ALIASES"), "OWNERS_ALIASES"],
    [() => treeHasFile(tree, "MAINTAINERS") || treeHasFile(tree, "MAINTAINERS.md"), "MAINTAINERS"],
  ];
  for (const [check, name] of checks) {
    if (check()) return { detected: true, detail: `${name} file found` };
  }
  return { detected: false, detail: "No code ownership file (CODEOWNERS, OWNERS, MAINTAINERS)" };
}

// --- Security Policy Detectors ---
export function detectSecurityPolicy(tree: RepoTree): DetectorResult {
  const checks: Array<[() => boolean, string]> = [
    [() => treeHasFile(tree, "SECURITY.md"), "SECURITY.md"],
    [() => treeHasFile(tree, "SECURITY.rst"), "SECURITY.rst"],
    [() => treeHasFile(tree, ".github/SECURITY.md"), ".github/SECURITY.md"],
    [() => treeHasFile(tree, "SECURITY_CONTACTS"), "SECURITY_CONTACTS"],
    [() => treeHasFile(tree, "SECURITY_CONTACTS.md"), "SECURITY_CONTACTS.md"],
  ];
  for (const [check, name] of checks) {
    if (check()) return { detected: true, detail: name };
  }
  return { detected: false, detail: "No security policy" };
}

// --- SBOM Detectors ---
export function detectSBOM(tree: RepoTree): DetectorResult {
  const checks: Array<[() => boolean, string]> = [
    [() => treeHasFile(tree, "sbom.json"), "sbom.json"],
    [() => treeHasFile(tree, "bom.xml"), "CycloneDX BOM (bom.xml)"],
    [() => treeHasPattern(tree, /sbom\.spdx/), "SPDX SBOM"],
    [() => treeHasPattern(tree, /\.cdx\.json$/), "CycloneDX JSON"],
    [() => treeHasPattern(tree, /^\.github\/sbom/), ".github/sbom"],
  ];
  for (const [check, name] of checks) {
    if (check()) return { detected: true, detail: name };
  }
  return { detected: false, detail: "No SBOM artifact detected" };
}

// --- Code Scanning / SAST Detectors ---
export function detectCodeScanning(tree: RepoTree): DetectorResult {
  const checks: Array<[() => boolean, string]> = [
    [() => treeHasFile(tree, ".github/codeql/codeql-config.yml"), "CodeQL config"],
    [() => treeHasPattern(tree, /\.github\/workflows\/.*codeql.*\.ya?ml$/), "CodeQL in workflows"],
    [() => treeHasPattern(tree, /code-scanning.*\.ya?ml$/), "Code scanning workflow"],
    [() => treeHasPattern(tree, /codeql.*\.ya?ml$/), "CodeQL workflow"],
  ];
  for (const [check, name] of checks) {
    if (check()) return { detected: true, detail: name };
  }
  return { detected: false, detail: "No SAST/code scanning configuration detected" };
}

// --- Secret Scanning Detectors ---
export function detectSecretScanning(tree: RepoTree): DetectorResult {
  const checks: Array<[() => boolean, string]> = [
    [() => treeHasFile(tree, ".github/secret-scanning.yml"), "Secret scanning config"],
    [() => treeHasFile(tree, ".gitleaks.toml"), "Gitleaks config"],
    [() => treeHasFile(tree, ".secrets.baseline"), "detect-secrets baseline"],
    [() => treeHasFile(tree, ".trufflehogignore"), "TruffleHog config"],
  ];
  for (const [check, name] of checks) {
    if (check()) return { detected: true, detail: name };
  }
  return { detected: false, detail: "No secret scanning configuration detected" };
}

// --- License Detectors ---
export function detectLicense(tree: RepoTree): DetectorResult {
  const checks: Array<[() => boolean, string]> = [
    [() => treeHasFile(tree, "LICENSE") || treeHasFile(tree, "LICENSE.md") || treeHasFile(tree, "LICENSE.txt"), "LICENSE"],
    [() => treeHasFile(tree, "LICENCE") || treeHasFile(tree, "LICENCE.md"), "LICENCE"],
    [() => treeHasFile(tree, "COPYING") || treeHasFile(tree, "COPYING.md"), "COPYING"],
    [() => treeHasPattern(tree, /^licenses\//), "licenses/ directory"],
  ];
  for (const [check, name] of checks) {
    if (check()) return { detected: true, detail: name };
  }
  return { detected: false, detail: "No license file" };
}
