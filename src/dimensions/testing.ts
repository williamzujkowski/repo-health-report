import {
  type RepoTree,
  type RepoMeta,
  type ProjectType,
  treeHasPattern,
  treeCountPattern,
  treeHasFile,
  fetchFileContent,
} from "../analyze.js";
import type { DimensionResult, Finding } from "./security.js";

async function analyzeIacTesting(
  tree: RepoTree,
  slug: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // CI: GitHub Actions or Concourse ci/ directory
  const ciWorkflowCount = treeCountPattern(
    tree,
    /^\.github\/workflows\/.*\.ya?ml$/
  );
  const hasCiDir = treeHasPattern(tree, /^ci\//);
  const hasAnyCi = ciWorkflowCount > 0 || hasCiDir;
  findings.push({
    name: "CI pipeline",
    passed: hasAnyCi,
    detail: hasAnyCi
      ? ciWorkflowCount > 0
        ? `${ciWorkflowCount} GitHub Actions workflow(s) found`
        : "ci/ directory found (Concourse or similar)"
      : "No CI pipeline detected (.github/workflows/ or ci/)",
    weight: 25,
  });

  // Terratest or Go test files
  const hasGoTestFiles = treeHasPattern(tree, /_test\.go$/);
  const hasTerratest =
    hasGoTestFiles ||
    treeHasFile(tree, "go.mod");
  findings.push({
    name: "Terratest / Go tests",
    passed: hasTerratest,
    detail: hasTerratest
      ? hasGoTestFiles
        ? "Go test files found (terratest)"
        : "go.mod found — Go test framework available"
      : "No terratest/Go tests found — consider adding infrastructure tests",
    weight: 30,
  });

  // terraform validate / validate script
  const hasValidateScript =
    treeHasFile(tree, "validate.sh") ||
    treeHasPattern(tree, /scripts\/validate/);
  // Also check Makefile for validate target (approximation: Makefile exists)
  const hasMakefile = treeHasFile(tree, "Makefile");
  const hasValidate = hasValidateScript || hasMakefile;
  findings.push({
    name: "Validation script (terraform validate)",
    passed: hasValidate,
    detail: hasValidate
      ? hasValidateScript
        ? "validate.sh or scripts/validate found"
        : "Makefile found — likely includes validate target"
      : "No validation script found (validate.sh or Makefile)",
    weight: 20,
  });

  // Kitchen-terraform or InSpec
  const hasKitchen =
    treeHasFile(tree, ".kitchen.yml") ||
    treeHasFile(tree, "kitchen.yml") ||
    treeHasPattern(tree, /^test\/integration\//);
  const hasInspec =
    treeHasPattern(tree, /\.rb$/) &&
    treeHasPattern(tree, /^test\//);
  const hasCompliance = hasKitchen || hasInspec;
  findings.push({
    name: "Compliance testing (kitchen-terraform / inspec)",
    passed: hasCompliance,
    detail: hasCompliance
      ? hasKitchen
        ? "kitchen-terraform config found"
        : "InSpec/Ruby test files found"
      : "No compliance testing detected (kitchen-terraform, inspec)",
    weight: 10,
  });

  // Pre-commit hooks
  const hasPreCommit = treeHasFile(tree, ".pre-commit-config.yaml");
  findings.push({
    name: "Pre-commit hooks",
    passed: hasPreCommit,
    detail: hasPreCommit
      ? "pre-commit config found"
      : "No pre-commit hooks — consider hooks for fmt/validate/lint",
    weight: 15,
  });

  // Suppress unused slug warning (slug not used in IaC path but kept for API symmetry)
  void slug;

  return findings;
}

async function analyzeApplicationTesting(
  tree: RepoTree,
  _meta: RepoMeta,
  slug: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // CI workflows
  const ciWorkflowCount = treeCountPattern(
    tree,
    /^\.github\/workflows\/.*\.ya?ml$/
  );
  findings.push({
    name: "CI workflows",
    passed: ciWorkflowCount > 0,
    detail:
      ciWorkflowCount > 0
        ? `${ciWorkflowCount} workflow file(s) found`
        : "No GitHub Actions workflows found",
    weight: 25,
  });

  // Test directories or test files
  const testFileCount = treeCountPattern(
    tree,
    /(?:__tests__|\.test\.|\.spec\.|test\/|tests\/|spec\/)/
  );
  findings.push({
    name: "Test files",
    passed: testFileCount > 0,
    detail:
      testFileCount > 0
        ? `${testFileCount} test-related file(s) found`
        : "No test files detected",
    weight: 25,
  });

  // Coverage config (check root and subdirectories for test runner configs)
  const hasCoverageConfig =
    treeHasFile(tree, ".nycrc") ||
    treeHasFile(tree, ".nycrc.json") ||
    treeHasFile(tree, ".c8rc.json") ||
    treeHasFile(tree, "jest.config.js") ||
    treeHasFile(tree, "jest.config.ts") ||
    treeHasFile(tree, "vitest.config.ts") ||
    treeHasFile(tree, "vitest.config.js") ||
    treeHasPattern(tree, /vitest\.config\.[tj]s$/) ||
    treeHasPattern(tree, /jest\.config\.[tj]s$/) ||
    treeHasFile(tree, ".coveragerc") ||
    treeHasFile(tree, "codecov.yml") ||
    treeHasFile(tree, ".codecov.yml") ||
    treeHasPattern(tree, /coveralls/) ||
    treeHasFile(tree, "setup.cfg") ||
    treeHasFile(tree, "tox.ini") ||
    treeHasFile(tree, "pyproject.toml") ||
    treeHasFile(tree, "pytest.ini");
  findings.push({
    name: "Coverage configuration",
    passed: hasCoverageConfig,
    detail: hasCoverageConfig
      ? "Coverage/test runner config found"
      : "No coverage configuration detected",
    weight: 20,
  });

  // Test script in package.json
  let hasTestScript = false;
  const pkgContent = await fetchFileContent(slug, "package.json");
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
      const scripts = pkg.scripts as Record<string, string> | undefined;
      hasTestScript = Boolean(
        scripts?.test && !scripts.test.includes("no test specified")
      );
    } catch {
      // not a JS project or malformed package.json
    }
  }

  // Also check for pyproject.toml, Cargo.toml, go.mod test conventions
  const hasPytest =
    treeHasFile(tree, "pyproject.toml") || treeHasFile(tree, "pytest.ini");
  const hasCargo = treeHasFile(tree, "Cargo.toml");
  const hasGo = treeHasFile(tree, "go.mod");
  const hasTestConfig = hasTestScript || hasPytest || hasCargo || hasGo;

  findings.push({
    name: "Test runner configured",
    passed: hasTestConfig,
    detail: hasTestConfig
      ? "Test runner configuration detected"
      : "No test runner found (no test script, pytest, cargo, or go.mod)",
    weight: 15,
  });

  // Pre-commit hooks
  const hasHusky = treeHasPattern(tree, /^\.husky\//);
  const hasPreCommit = treeHasFile(tree, ".pre-commit-config.yaml");
  const hasHooks = hasHusky || hasPreCommit;
  findings.push({
    name: "Pre-commit hooks",
    passed: hasHooks,
    detail: hasHooks
      ? `Using ${hasHusky ? "Husky" : "pre-commit"}`
      : "No pre-commit hooks found",
    weight: 5,
  });

  return findings;
}

async function analyzeDocumentationTesting(
  tree: RepoTree,
  slug: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // CI workflow for automated checks (link checking, markdown linting)
  const ciWorkflowCount = treeCountPattern(
    tree,
    /^\.github\/workflows\/.*\.ya?ml$/
  );
  findings.push({
    name: "CI workflow (for automated checks)",
    passed: ciWorkflowCount > 0,
    detail:
      ciWorkflowCount > 0
        ? `${ciWorkflowCount} GitHub Actions workflow(s) found`
        : "No CI workflows — consider adding link checking and markdown linting",
    weight: 30,
  });

  // Markdown linting config
  const hasMarkdownlint =
    treeHasFile(tree, ".markdownlint.json") ||
    treeHasFile(tree, ".markdownlint.yml") ||
    treeHasFile(tree, ".markdownlint.yaml") ||
    treeHasFile(tree, "markdownlint.json") ||
    treeHasFile(tree, ".markdownlintrc") ||
    treeHasPattern(tree, /pymarkdown/);
  findings.push({
    name: "Markdown linting (markdownlint / pymarkdown)",
    passed: hasMarkdownlint,
    detail: hasMarkdownlint
      ? "Markdown linting config found"
      : "No markdownlint config — consider adding for consistent formatting",
    weight: 25,
  });

  // Link checking (lychee, markdown-link-check)
  const hasLinkCheck =
    treeHasFile(tree, ".lycheeignore") ||
    treeHasFile(tree, "lychee.toml") ||
    treeHasFile(tree, ".lychee.toml") ||
    treeHasPattern(tree, /markdown-link-check/) ||
    treeHasPattern(tree, /lychee/) ||
    treeHasPattern(tree, /link.?check/i);
  findings.push({
    name: "Link checking (lychee / markdown-link-check)",
    passed: hasLinkCheck,
    detail: hasLinkCheck
      ? "Link checker config found"
      : "No link checking — broken links erode list quality",
    weight: 30,
  });

  // Spell check config
  const hasSpellcheck =
    treeHasFile(tree, ".cspell.json") ||
    treeHasFile(tree, "cspell.json") ||
    treeHasFile(tree, ".cspell.yaml") ||
    treeHasPattern(tree, /cspell/) ||
    treeHasPattern(tree, /aspell/) ||
    treeHasPattern(tree, /codespell/);
  findings.push({
    name: "Spell check (cspell / aspell / codespell)",
    passed: hasSpellcheck,
    detail: hasSpellcheck
      ? "Spell check config found"
      : "No spell checker configured",
    weight: 15,
  });

  // Suppress unused slug warning
  void slug;

  return findings;
}

export async function analyzeTestingDimension(
  tree: RepoTree,
  meta: RepoMeta,
  slug: string,
  projectType: ProjectType = "application"
): Promise<DimensionResult> {
  const start = performance.now();

  let findings: Finding[];
  if (projectType === "documentation") {
    findings = await analyzeDocumentationTesting(tree, slug);
  } else if (projectType === "iac") {
    findings = await analyzeIacTesting(tree, slug);
  } else if (projectType === "hybrid") {
    findings = await analyzeApplicationTesting(tree, meta, slug);
    const iacFindings = (await analyzeIacTesting(tree, slug)).map((f) => ({
      ...f,
      name: `[IaC] ${f.name}`,
      weight: Math.round(f.weight * 0.5),
    }));
    findings.push(...iacFindings);
  } else {
    findings = await analyzeApplicationTesting(tree, meta, slug);
  }

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const earnedWeight = findings
    .filter((f) => f.passed)
    .reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return {
    name: "Testing",
    score,
    findings,
    durationMs: performance.now() - start,
  };
}
