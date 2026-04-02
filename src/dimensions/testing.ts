import {
  type RepoTree,
  type RepoMeta,
  treeHasPattern,
  treeCountPattern,
  treeHasFile,
  fetchFileContent,
} from "../analyze.js";
import type { DimensionResult, Finding } from "./security.js";

export async function analyzeTestingDimension(
  tree: RepoTree,
  _meta: RepoMeta,
  slug: string
): Promise<DimensionResult> {
  const start = performance.now();
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
    treeHasFile(tree, "tox.ini");
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
  const hasPytest = treeHasFile(tree, "pyproject.toml") || treeHasFile(tree, "pytest.ini");
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
    weight: 15,
  });

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
