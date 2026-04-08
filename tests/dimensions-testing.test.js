import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockTree(paths) {
  return { tree: paths.map((p) => ({ path: p, type: "blob" })) };
}

function mockMeta(overrides = {}) {
  return {
    default_branch: "main",
    language: "TypeScript",
    has_issues: true,
    has_wiki: false,
    has_pages: false,
    license: { spdx_id: "MIT" },
    open_issues_count: 5,
    archived: false,
    description: "A project",
    ...overrides,
  };
}

// ── Mock fetchFileContent before importing the module under test ────────

let mockFetchFileContent;

mock.module("../dist/analyze.js", {
  namedExports: {
    treeHasFile: (await import("../dist/analyze.js")).treeHasFile,
    treeHasPattern: (await import("../dist/analyze.js")).treeHasPattern,
    treeCountPattern: (await import("../dist/analyze.js")).treeCountPattern,
    fetchFileContent: (...args) => mockFetchFileContent(...args),
    fetchWorkflows: async () => [],
  },
});

// Also re-export detectors (they import from analyze.js internally but use tree-only functions)
const { analyzeTestingDimension } = await import(
  "../dist/dimensions/testing.js"
);

// ── Application Testing ────────────────────────────────────────────────────

describe("analyzeTestingDimension — application", () => {
  beforeEach(() => {
    mockFetchFileContent = async () => null;
  });

  it("scores high for a well-tested repo", async () => {
    mockFetchFileContent = async (_slug, path) => {
      if (path === "package.json") {
        return JSON.stringify({
          scripts: { test: "vitest run" },
        });
      }
      return null;
    };

    const tree = mockTree([
      ".github/workflows/ci.yml",
      "src/index.test.ts",
      "src/utils.spec.ts",
      "tests/integration.test.ts",
      "vitest.config.ts",
      ".husky/pre-commit",
    ]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    assert.equal(result.name, "Testing");
    assert.equal(result.score, 100);
    assert.ok(result.durationMs >= 0);
    for (const f of result.findings) {
      assert.equal(f.passed, true, `Expected "${f.name}" to pass`);
    }
  });

  it("scores low when no tests at all", async () => {
    const tree = mockTree(["src/index.ts", "package.json"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    assert.ok(result.score < 20, `Expected low score, got ${result.score}`);

    const testFilesFinding = result.findings.find((f) =>
      f.name.includes("Test files")
    );
    assert.equal(testFilesFinding.passed, false);
  });

  it("counts multiple test file patterns", async () => {
    const tree = mockTree([
      "src/__tests__/foo.test.js",
      "src/bar.spec.js",
      "tests/integration.js",
    ]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const testFilesFinding = result.findings.find((f) =>
      f.name.includes("Test files")
    );
    assert.equal(testFilesFinding.passed, true);
    assert.match(testFilesFinding.detail, /3 test-related/);
  });

  it("detects test script in package.json", async () => {
    mockFetchFileContent = async (_slug, path) => {
      if (path === "package.json") {
        return JSON.stringify({
          scripts: { test: "jest --coverage" },
        });
      }
      return null;
    };

    const tree = mockTree(["package.json"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const testRunnerFinding = result.findings.find((f) =>
      f.name.includes("Test runner")
    );
    assert.equal(testRunnerFinding.passed, true);
  });

  it("rejects default npm test script", async () => {
    mockFetchFileContent = async (_slug, path) => {
      if (path === "package.json") {
        return JSON.stringify({
          scripts: { test: 'echo "Error: no test specified" && exit 1' },
        });
      }
      return null;
    };

    const tree = mockTree(["package.json"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const testRunnerFinding = result.findings.find((f) =>
      f.name.includes("Test runner")
    );
    assert.equal(testRunnerFinding.passed, false);
  });

  it("detects pytest via pyproject.toml", async () => {
    const tree = mockTree(["pyproject.toml", "tests/test_main.py"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const testRunnerFinding = result.findings.find((f) =>
      f.name.includes("Test runner")
    );
    assert.equal(testRunnerFinding.passed, true);
  });

  it("detects Go test runner via go.mod", async () => {
    const tree = mockTree(["go.mod", "main_test.go"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const testRunnerFinding = result.findings.find((f) =>
      f.name.includes("Test runner")
    );
    assert.equal(testRunnerFinding.passed, true);
  });

  it("detects Husky pre-commit hooks", async () => {
    const tree = mockTree([".husky/pre-commit"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const hooksFinding = result.findings.find((f) =>
      f.name.includes("Pre-commit")
    );
    assert.equal(hooksFinding.passed, true);
    assert.match(hooksFinding.detail, /Husky/);
  });

  it("detects pre-commit-config.yaml hooks", async () => {
    const tree = mockTree([".pre-commit-config.yaml"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const hooksFinding = result.findings.find((f) =>
      f.name.includes("Pre-commit")
    );
    assert.equal(hooksFinding.passed, true);
    assert.match(hooksFinding.detail, /pre-commit/);
  });
});

// ── IaC Testing ────────────────────────────────────────────────────────────

describe("analyzeTestingDimension — IaC", () => {
  beforeEach(() => {
    mockFetchFileContent = async () => null;
  });

  it("checks for terratest (Go test files)", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      "go.mod",
      "test/main_test.go",
      "Makefile",
      ".pre-commit-config.yaml",
    ]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "iac"
    );

    assert.ok(result.score >= 80, `Expected high score, got ${result.score}`);

    const terratestFinding = result.findings.find((f) =>
      f.name.includes("Terratest")
    );
    assert.equal(terratestFinding.passed, true);
    assert.match(terratestFinding.detail, /Go test files/);
  });

  it("checks for validation script", async () => {
    const tree = mockTree(["scripts/validate.sh"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "iac"
    );

    const validateFinding = result.findings.find((f) =>
      f.name.includes("Validation")
    );
    assert.equal(validateFinding.passed, true);
  });

  it("checks for kitchen-terraform", async () => {
    const tree = mockTree([".kitchen.yml"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "iac"
    );

    const complianceFinding = result.findings.find((f) =>
      f.name.includes("Compliance")
    );
    assert.equal(complianceFinding.passed, true);
  });
});

// ── Documentation Testing ──────────────────────────────────────────────────

describe("analyzeTestingDimension — documentation", () => {
  beforeEach(() => {
    mockFetchFileContent = async () => null;
  });

  it("checks for markdownlint", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      ".markdownlint.json",
      ".lycheeignore",
    ]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "documentation"
    );

    const lintFinding = result.findings.find((f) =>
      f.name.includes("Markdown linting")
    );
    assert.equal(lintFinding.passed, true);
  });

  it("checks for link checking (lychee)", async () => {
    const tree = mockTree([".lycheeignore"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "documentation"
    );

    const linkFinding = result.findings.find((f) =>
      f.name.includes("Link checking")
    );
    assert.equal(linkFinding.passed, true);
  });

  it("checks for spell checking", async () => {
    const tree = mockTree([".cspell.json"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "documentation"
    );

    const spellFinding = result.findings.find((f) =>
      f.name.includes("Spell check")
    );
    assert.equal(spellFinding.passed, true);
  });

  it("scores low for documentation project with no checks", async () => {
    const tree = mockTree(["README.md"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "documentation"
    );

    assert.equal(result.score, 0);
  });
});

// ── Hybrid Testing ─────────────────────────────────────────────────────────

describe("analyzeTestingDimension — hybrid", () => {
  beforeEach(() => {
    mockFetchFileContent = async () => null;
  });

  it("includes both application and IaC findings", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      "src/index.test.ts",
      "go.mod",
    ]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "hybrid"
    );

    const iacFindings = result.findings.filter((f) =>
      f.name.startsWith("[IaC]")
    );
    assert.ok(iacFindings.length > 0, "Expected IaC findings in hybrid mode");
  });
});

// ── Score calculation ──────────────────────────────────────────────────────

describe("analyzeTestingDimension — score calculation", () => {
  beforeEach(() => {
    mockFetchFileContent = async () => null;
  });

  it("calculates score as weighted percentage", async () => {
    // Only CI passes (weight 25 out of total)
    // Application: CI=25, TestFiles=25, Coverage=20, TestRunner=15, Hooks=5 → total 90
    // Not counting test runner from non-JS (no go.mod, cargo, pyproject)
    const tree = mockTree([".github/workflows/ci.yml"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    // 25 earned / 90 total (app findings remain consistent)
    // But we must trust the implementation — just verify it rounds correctly
    const totalWeight = result.findings.reduce((sum, f) => sum + f.weight, 0);
    const earnedWeight = result.findings
      .filter((f) => f.passed)
      .reduce((sum, f) => sum + f.weight, 0);
    const expected = Math.round((earnedWeight / totalWeight) * 100);
    assert.equal(result.score, expected);
  });

  it("returns proper DimensionResult shape", async () => {
    const tree = mockTree(["README.md"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo"
    );

    assert.equal(typeof result.name, "string");
    assert.equal(typeof result.score, "number");
    assert.ok(Array.isArray(result.findings));
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.score >= 0 && result.score <= 100);
  });

  it("handles malformed package.json gracefully", async () => {
    mockFetchFileContent = async (_slug, path) => {
      if (path === "package.json") return "not valid json{{{";
      return null;
    };

    const tree = mockTree(["package.json"]);
    const result = await analyzeTestingDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    // Should not throw — test runner finding should be false
    const testRunnerFinding = result.findings.find((f) =>
      f.name.includes("Test runner")
    );
    assert.equal(testRunnerFinding.passed, false);
  });
});
