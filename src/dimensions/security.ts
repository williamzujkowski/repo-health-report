import {
  type RepoTree,
  type RepoMeta,
  treeHasFile,
  treeHasPattern,
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

export async function analyzeSecurityDimension(
  tree: RepoTree,
  meta: RepoMeta,
  _slug: string
): Promise<DimensionResult> {
  const start = performance.now();
  const findings: Finding[] = [];

  // SECURITY.md
  const hasSecurityMd =
    treeHasFile(tree, "SECURITY.md") ||
    treeHasFile(tree, ".github/SECURITY.md");
  findings.push({
    name: "Security policy (SECURITY.md)",
    passed: hasSecurityMd,
    detail: hasSecurityMd
      ? "Security policy found"
      : "No SECURITY.md — add a vulnerability disclosure policy",
    weight: 20,
  });

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
    weight: 20,
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
    weight: 20,
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
  // We can't check branch protection rules without admin access, so check for CI as proxy
  const hasCi = treeHasPattern(tree, /^\.github\/workflows\/.*\.ya?ml$/);
  findings.push({
    name: "CI workflows (branch protection proxy)",
    passed: hasCi,
    detail: hasCi
      ? "CI workflows found (likely branch protection in place)"
      : "No CI workflows — branch protection is unlikely",
    weight: 15,
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
