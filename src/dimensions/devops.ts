import {
  type RepoTree,
  type RepoMeta,
  treeHasFile,
  treeHasPattern,
  treeCountPattern,
} from "../analyze.js";
import type { DimensionResult, Finding } from "./security.js";

export async function analyzeDevOpsDimension(
  tree: RepoTree,
  _meta: RepoMeta,
  _slug: string
): Promise<DimensionResult> {
  const start = performance.now();
  const findings: Finding[] = [];

  // CI/CD workflows
  const workflowCount = treeCountPattern(
    tree,
    /^\.github\/workflows\/.*\.ya?ml$/
  );
  const hasCi = workflowCount > 0;
  // Also check for other CI systems
  const hasTravis = treeHasFile(tree, ".travis.yml");
  const hasCircle = treeHasFile(tree, ".circleci/config.yml");
  const hasJenkins = treeHasFile(tree, "Jenkinsfile");
  const hasGitlabCi = treeHasFile(tree, ".gitlab-ci.yml");
  const hasAnyCi = hasCi || hasTravis || hasCircle || hasJenkins || hasGitlabCi;
  findings.push({
    name: "CI/CD pipeline",
    passed: hasAnyCi,
    detail: hasAnyCi
      ? `CI found: ${hasCi ? `${workflowCount} GitHub Actions workflow(s)` : ""}${hasTravis ? " Travis" : ""}${hasCircle ? " CircleCI" : ""}${hasJenkins ? " Jenkins" : ""}${hasGitlabCi ? " GitLab CI" : ""}`.trim()
      : "No CI/CD pipeline detected",
    weight: 30,
  });

  // Docker support
  const hasDockerfile =
    treeHasFile(tree, "Dockerfile") ||
    treeHasPattern(tree, /Dockerfile/);
  const hasCompose =
    treeHasFile(tree, "docker-compose.yml") ||
    treeHasFile(tree, "docker-compose.yaml") ||
    treeHasFile(tree, "compose.yml") ||
    treeHasFile(tree, "compose.yaml");
  const hasDocker = hasDockerfile || hasCompose;
  findings.push({
    name: "Container support (Docker)",
    passed: hasDocker,
    detail: hasDocker
      ? `Docker config found${hasDockerfile ? " (Dockerfile)" : ""}${hasCompose ? " (Compose)" : ""}`
      : "No Docker configuration",
    weight: 20,
  });

  // Release automation
  const hasReleaseWorkflow = treeHasPattern(
    tree,
    /^\.github\/workflows\/.*release.*\.ya?ml$/i
  );
  const hasReleaseConfig =
    treeHasFile(tree, ".releaserc") ||
    treeHasFile(tree, ".releaserc.json") ||
    treeHasFile(tree, ".releaserc.yml") ||
    treeHasFile(tree, "release.config.js") ||
    treeHasFile(tree, ".changeset/config.json");
  const hasRelease = hasReleaseWorkflow || hasReleaseConfig;
  findings.push({
    name: "Release automation",
    passed: hasRelease,
    detail: hasRelease
      ? "Release automation configured"
      : "No release automation (semantic-release, changesets, etc.)",
    weight: 20,
  });

  // Issue/PR templates
  const hasTemplates =
    treeHasPattern(tree, /^\.github\/ISSUE_TEMPLATE/) ||
    treeHasFile(tree, ".github/PULL_REQUEST_TEMPLATE.md") ||
    treeHasFile(tree, ".github/pull_request_template.md");
  findings.push({
    name: "Issue/PR templates",
    passed: hasTemplates,
    detail: hasTemplates
      ? "Issue/PR templates found"
      : "No issue or PR templates",
    weight: 15,
  });

  // Environment config (infrastructure as code)
  const hasIaC =
    treeHasPattern(tree, /\.tf$/) ||
    treeHasPattern(tree, /^k8s\//) ||
    treeHasPattern(tree, /^kubernetes\//) ||
    treeHasPattern(tree, /^helm\//) ||
    treeHasPattern(tree, /^deploy\//) ||
    treeHasFile(tree, "serverless.yml") ||
    treeHasFile(tree, "app.yaml") ||
    treeHasFile(tree, "fly.toml") ||
    treeHasFile(tree, "vercel.json") ||
    treeHasFile(tree, "netlify.toml");
  findings.push({
    name: "Deployment/Infrastructure config",
    passed: hasIaC,
    detail: hasIaC
      ? "Deployment or IaC config found"
      : "No deployment configuration detected",
    weight: 15,
  });

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const earnedWeight = findings
    .filter((f) => f.passed)
    .reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return {
    name: "DevOps",
    score,
    findings,
    durationMs: performance.now() - start,
  };
}
