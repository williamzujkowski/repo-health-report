import {
  type RepoTree,
  type RepoMeta,
  type ProjectType,
  treeHasFile,
  treeHasPattern,
} from "../analyze.js";
import { detectAllCI } from "../detectors.js";
import type { DimensionResult, Finding } from "./security.js";
import { buildDimensionResult } from "../scoring.js";

function analyzeIacDevOps(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // CI/CD pipeline detection (all ecosystems)
  const ci = detectAllCI(tree);
  findings.push({
    name: "CI/CD pipeline",
    passed: ci.detected,
    detail: ci.detected
      ? ci.detail
      : "No CI/CD pipeline detected",
    weight: 30,
  });

  // Makefile or scripts/ for task automation
  const hasMakefile = treeHasFile(tree, "Makefile");
  const hasScripts = treeHasPattern(tree, /^scripts\/.*\.sh$/);
  const hasTaskRunner = hasMakefile || hasScripts;
  findings.push({
    name: "Task runner (Makefile / scripts)",
    passed: hasTaskRunner,
    detail: hasTaskRunner
      ? hasMakefile
        ? "Makefile found"
        : "Shell scripts in scripts/ found"
      : "No Makefile or scripts/ — consider adding task automation",
    weight: 25,
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

  // Deployment config: environment variable files, .envrc, workspaces
  const hasWorkspaceConfig =
    treeHasPattern(tree, /terraform\.tfvars$/) ||
    treeHasPattern(tree, /\.tfvars\.example$/) ||
    treeHasFile(tree, ".envrc") ||
    treeHasPattern(tree, /^envs\//) ||
    treeHasPattern(tree, /^environments\//);
  findings.push({
    name: "Environment / workspace config",
    passed: hasWorkspaceConfig,
    detail: hasWorkspaceConfig
      ? "Environment or workspace config found"
      : "No environment config detected (tfvars, envs/, environments/)",
    weight: 20,
  });

  // Release / changelog (IaC repos often use CHANGELOG.md or GitHub releases)
  const hasChangelog =
    treeHasFile(tree, "CHANGELOG.md") ||
    treeHasFile(tree, "CHANGELOG") ||
    treeHasPattern(tree, /^\.github\/workflows\/.*release.*\.ya?ml$/i);
  findings.push({
    name: "Changelog / release tracking",
    passed: hasChangelog,
    detail: hasChangelog
      ? "Changelog or release workflow found"
      : "No CHANGELOG.md or release workflow",
    weight: 10,
  });

  return findings;
}

function analyzeApplicationDevOps(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // CI/CD pipeline detection (all ecosystems)
  const ci = detectAllCI(tree);
  findings.push({
    name: "CI/CD pipeline",
    passed: ci.detected,
    detail: ci.detected
      ? ci.detail
      : "No CI/CD pipeline detected",
    weight: 30,
  });

  // Docker support
  const hasDockerfile =
    treeHasFile(tree, "Dockerfile") || treeHasPattern(tree, /Dockerfile/);
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
  const hasReleaseWorkflow =
    treeHasPattern(tree, /^\.github\/workflows\/.*release.*\.ya?ml$/i) ||
    treeHasFile(tree, ".github/release.yml");
  const hasReleaseConfig =
    treeHasFile(tree, ".releaserc") ||
    treeHasFile(tree, ".releaserc.json") ||
    treeHasFile(tree, ".releaserc.yml") ||
    treeHasFile(tree, "release.config.js") ||
    treeHasFile(tree, "release.config.cjs") ||
    treeHasFile(tree, ".changeset/config.json") ||
    treeHasPattern(tree, /^\.changeset\//);
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

  // Deployment/IaC config — low weight since most repos are libraries/tools
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
    treeHasFile(tree, "netlify.toml") ||
    treeHasFile(tree, "Makefile"); // Makefile serves as "run" interface for most OSS
  findings.push({
    name: "Deployment/Infrastructure config",
    passed: hasIaC,
    detail: hasIaC
      ? "Deployment or build config found"
      : "No deployment configuration detected",
    weight: 5,
  });

  return findings;
}

function analyzeDocumentationDevOps(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // CI/CD pipeline for automated checks (all ecosystems)
  const ci = detectAllCI(tree);
  findings.push({
    name: "CI/CD pipeline (automated checks)",
    passed: ci.detected,
    detail: ci.detected
      ? ci.detail
      : "No CI pipeline — consider automating link checks and linting",
    weight: 30,
  });

  // Issue templates (for new entry contributions)
  const hasIssueTemplates = treeHasPattern(
    tree,
    /^\.github\/ISSUE_TEMPLATE/
  );
  findings.push({
    name: "Issue templates (for contribution requests)",
    passed: hasIssueTemplates,
    detail: hasIssueTemplates
      ? "Issue templates found"
      : "No issue templates — contributors lack guidance for submitting new entries",
    weight: 25,
  });

  // PR templates (for new additions)
  const hasPrTemplate =
    treeHasFile(tree, ".github/PULL_REQUEST_TEMPLATE.md") ||
    treeHasFile(tree, ".github/pull_request_template.md") ||
    treeHasPattern(tree, /^\.github\/PULL_REQUEST_TEMPLATE\//);
  findings.push({
    name: "PR template (for new additions)",
    passed: hasPrTemplate,
    detail: hasPrTemplate
      ? "PR template found"
      : "No PR template — contributors lack a checklist for new entries",
    weight: 25,
  });

  // Automated categorization/sorting tools or scripts
  const hasAutomation =
    treeHasPattern(tree, /^scripts\//) ||
    treeHasFile(tree, "Makefile") ||
    treeHasPattern(tree, /awesome-lint/) ||
    treeHasPattern(tree, /^\.github\/workflows\/.*lint.*\.ya?ml$/i) ||
    treeHasPattern(tree, /^\.github\/workflows\/.*awesome.*\.ya?ml$/i);
  findings.push({
    name: "Automation tools (awesome-lint / scripts / Makefile)",
    passed: hasAutomation,
    detail: hasAutomation
      ? "Automation tooling found"
      : "No automation scripts or awesome-lint — consider adding for quality control",
    weight: 20,
  });

  return findings;
}

export async function analyzeDevOpsDimension(
  tree: RepoTree,
  _meta: RepoMeta,
  _slug: string,
  projectType: ProjectType = "application"
): Promise<DimensionResult> {
  const start = performance.now();

  let findings: Finding[];
  if (projectType === "documentation") {
    findings = analyzeDocumentationDevOps(tree);
  } else if (projectType === "iac") {
    findings = analyzeIacDevOps(tree);
  } else if (projectType === "hybrid") {
    findings = analyzeApplicationDevOps(tree);
    const iacFindings = analyzeIacDevOps(tree).map((f) => ({
      ...f,
      name: `[IaC] ${f.name}`,
      weight: Math.round(f.weight * 0.5),
    }));
    findings.push(...iacFindings);
  } else {
    findings = analyzeApplicationDevOps(tree);
  }

  return buildDimensionResult("DevOps", findings, start);
}
