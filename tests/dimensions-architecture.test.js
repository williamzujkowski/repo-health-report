import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Architecture dimension does NOT use fetchFileContent — no mocking needed.
// It only uses treeHasFile and treeHasPattern which are pure tree operations.

const { analyzeArchitectureDimension } = await import(
  "../dist/dimensions/architecture.js"
);

// ── Helpers ────────────────────────────────────────────────────────────────

function mockTree(paths, opts = {}) {
  return {
    tree: paths.map((p) => ({
      path: p,
      type: opts.treeEntries?.[p] ?? "blob",
    })),
  };
}

function mockTreeWithDirs(paths) {
  // Paths ending with / are treated as tree entries (directories)
  return {
    tree: paths.map((p) => ({
      path: p.replace(/\/$/, ""),
      type: p.endsWith("/") ? "tree" : "blob",
    })),
  };
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

// ── TypeScript project ─────────────────────────────────────────────────────

describe("analyzeArchitectureDimension — TypeScript", () => {
  it("scores high with full TypeScript setup", async () => {
    const tree = mockTree([
      "tsconfig.json",
      "eslint.config.js",
      ".prettierrc",
      "src/index.ts",
      "vite.config.ts",
    ]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "typescript"
    );

    assert.equal(result.name, "Architecture");
    assert.equal(result.score, 100);
    for (const f of result.findings) {
      assert.equal(f.passed, true, `Expected "${f.name}" to pass`);
    }
  });

  it("scores low with no config files", async () => {
    const tree = mockTree(["index.ts"]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "typescript"
    );

    assert.ok(result.score < 20, `Expected low score, got ${result.score}`);
  });

  it("detects biome as both linter and formatter", async () => {
    const tree = mockTree(["biome.json", "src/main.ts"]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "typescript"
    );

    const lintFinding = result.findings.find((f) => f.name.includes("Linter"));
    const fmtFinding = result.findings.find((f) =>
      f.name.includes("formatter")
    );
    assert.equal(lintFinding.passed, true);
    assert.equal(fmtFinding.passed, true);
  });
});

// ── Python project ─────────────────────────────────────────────────────────

describe("analyzeArchitectureDimension — Python", () => {
  it("scores high with pyproject.toml and ruff", async () => {
    const tree = mockTree([
      "pyproject.toml",
      "ruff.toml",
      "src/main.py",
      "mypy.ini",
    ]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "python"
    );

    assert.ok(result.score >= 90, `Expected high score, got ${result.score}`);
  });

  it("gives credit for pyproject.toml as build config", async () => {
    const tree = mockTree(["pyproject.toml", "src/app.py"]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "python"
    );

    const buildFinding = result.findings.find((f) =>
      f.name.includes("Build configuration")
    );
    assert.equal(buildFinding.passed, true);
  });
});

// ── Go project ─────────────────────────────────────────────────────────────

describe("analyzeArchitectureDimension — Go", () => {
  it("scores high with standard Go layout", async () => {
    const tree = mockTree([
      "go.mod",
      ".golangci.yml",
      "cmd/server/main.go",
      "Makefile",
      ".go-version",
    ]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "go"
    );

    assert.equal(result.score, 100);
  });

  it("gives credit for built-in gofmt when go.mod exists", async () => {
    const tree = mockTree(["go.mod"]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "go"
    );

    const fmtFinding = result.findings.find((f) =>
      f.name.includes("gofmt")
    );
    assert.equal(fmtFinding.passed, true);
    assert.match(fmtFinding.detail, /built into Go/);
  });

  it("checks for Go version pinning", async () => {
    const tree = mockTree(["go.mod", ".tool-versions"]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "go"
    );

    const versionFinding = result.findings.find((f) =>
      f.name.includes("version pinning")
    );
    assert.equal(versionFinding.passed, true);
  });
});

// ── Bare project ───────────────────────────────────────────────────────────

describe("analyzeArchitectureDimension — bare project", () => {
  it("scores low with no config files using generic checks", async () => {
    const tree = mockTree(["main.py"]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "other"
    );

    assert.ok(result.score < 20, `Expected low score, got ${result.score}`);
  });
});

// ── IaC project type ───────────────────────────────────────────────────────

describe("analyzeArchitectureDimension — IaC", () => {
  it("dispatches to IaC checks for iac projectType", async () => {
    const tree = mockTree([
      ".tflint.hcl",
      ".pre-commit-config.yaml",
      "modules/vpc/main.tf",
      "variables.tf",
      "outputs.tf",
      ".terraform-version",
      "Makefile",
    ]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "iac"
    );

    assert.equal(result.score, 100);

    // Should have IaC-specific findings
    const tflintFinding = result.findings.find((f) =>
      f.name.includes("tflint")
    );
    assert.ok(tflintFinding, "Expected tflint finding for IaC project");
    assert.equal(tflintFinding.passed, true);
  });

  it("scores low for IaC project with no config", async () => {
    const tree = mockTree(["main.tf"]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "iac"
    );

    assert.ok(result.score < 20, `Expected low score, got ${result.score}`);
  });
});

// ── Documentation project type ─────────────────────────────────────────────

describe("analyzeArchitectureDimension — documentation", () => {
  it("dispatches to documentation checks for documentation projectType", async () => {
    const tree = mockTreeWithDirs([
      "README.md",
      "CONTRIBUTING.md",
      "LICENSE",
      ".editorconfig",
      "guides/",
    ]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "documentation"
    );

    assert.ok(result.score >= 80, `Expected high score, got ${result.score}`);

    // Should have doc-specific findings
    const contribFinding = result.findings.find((f) =>
      f.name.includes("Contributing")
    );
    assert.ok(contribFinding, "Expected contributing finding for doc project");
  });
});

// ── Hybrid project type ────────────────────────────────────────────────────

describe("analyzeArchitectureDimension — hybrid", () => {
  it("includes both application and IaC findings for hybrid", async () => {
    const tree = mockTree([
      "tsconfig.json",
      "eslint.config.js",
      ".prettierrc",
      "src/index.ts",
      ".tflint.hcl",
      "modules/main.tf",
    ]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "hybrid",
      "typescript"
    );

    // Should have findings from both app and IaC checks
    const iacFindings = result.findings.filter((f) =>
      f.name.startsWith("[IaC]")
    );
    assert.ok(iacFindings.length > 0, "Expected IaC findings in hybrid mode");

    // IaC findings should have halved weights
    for (const f of iacFindings) {
      assert.ok(f.weight <= 10, `IaC weight should be halved, got ${f.weight}`);
    }
  });
});

// ── Score calculation ──────────────────────────────────────────────────────

describe("analyzeArchitectureDimension — score calculation", () => {
  it("returns 0 when no findings pass", async () => {
    const tree = mockTree(["random-file.txt"]);
    const result = await analyzeArchitectureDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application",
      "other"
    );

    assert.equal(result.score, 0);
  });

  it("returns proper DimensionResult shape", async () => {
    const tree = mockTree(["tsconfig.json"]);
    const result = await analyzeArchitectureDimension(
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
});
