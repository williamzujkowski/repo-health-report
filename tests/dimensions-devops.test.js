import { describe, it } from "node:test";
import assert from "node:assert/strict";

// DevOps dimension does NOT use fetchFileContent — no mocking needed.
// It uses treeHasFile, treeHasPattern (pure tree ops) and detectAllCI (also tree-only).

const { analyzeDevOpsDimension } = await import(
  "../dist/dimensions/devops.js"
);

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

// ── Application DevOps ─────────────────────────────────────────────────────

describe("analyzeDevOpsDimension — application", () => {
  it("scores high with full DevOps setup", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      "Dockerfile",
      "docker-compose.yml",
      ".releaserc.json",
      ".github/ISSUE_TEMPLATE/bug.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      "Makefile",
    ]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    assert.equal(result.name, "DevOps");
    assert.equal(result.score, 100);
    assert.ok(result.durationMs >= 0);
    for (const f of result.findings) {
      assert.equal(f.passed, true, `Expected "${f.name}" to pass`);
    }
  });

  it("scores low with no CI at all", async () => {
    const tree = mockTree(["src/index.ts", "package.json"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    assert.ok(result.score < 20, `Expected low score, got ${result.score}`);

    const ciFinding = result.findings.find((f) =>
      f.name.includes("CI/CD")
    );
    assert.equal(ciFinding.passed, false);
  });

  it("detects Docker via Dockerfile", async () => {
    const tree = mockTree(["Dockerfile"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const dockerFinding = result.findings.find((f) =>
      f.name.includes("Container")
    );
    assert.equal(dockerFinding.passed, true);
    assert.match(dockerFinding.detail, /Dockerfile/);
  });

  it("detects Docker via compose.yml", async () => {
    const tree = mockTree(["compose.yml"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const dockerFinding = result.findings.find((f) =>
      f.name.includes("Container")
    );
    assert.equal(dockerFinding.passed, true);
    assert.match(dockerFinding.detail, /Compose/);
  });

  it("detects release automation via changesets", async () => {
    const tree = mockTree([".changeset/config.json"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const releaseFinding = result.findings.find((f) =>
      f.name.includes("Release")
    );
    assert.equal(releaseFinding.passed, true);
  });

  it("detects deployment config via Makefile", async () => {
    const tree = mockTree(["Makefile"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const deployFinding = result.findings.find((f) =>
      f.name.includes("Deployment")
    );
    assert.equal(deployFinding.passed, true);
  });

  it("detects multiple CI systems", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      "Jenkinsfile",
    ]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    const ciFinding = result.findings.find((f) => f.name.includes("CI/CD"));
    assert.equal(ciFinding.passed, true);
  });
});

// ── IaC DevOps ─────────────────────────────────────────────────────────────

describe("analyzeDevOpsDimension — IaC", () => {
  it("scores high with full IaC DevOps setup", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      "Makefile",
      ".github/ISSUE_TEMPLATE/bug.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      "terraform.tfvars",
      "CHANGELOG.md",
    ]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "iac"
    );

    assert.equal(result.score, 100);
  });

  it("checks for environment/workspace config", async () => {
    const tree = mockTree(["environments/prod/main.tf"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "iac"
    );

    const envFinding = result.findings.find((f) =>
      f.name.includes("Environment")
    );
    assert.equal(envFinding.passed, true);
  });

  it("checks for task runner (Makefile/scripts)", async () => {
    const tree = mockTree(["scripts/deploy.sh"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "iac"
    );

    const taskFinding = result.findings.find((f) =>
      f.name.includes("Task runner")
    );
    assert.equal(taskFinding.passed, true);
  });
});

// ── Documentation DevOps ───────────────────────────────────────────────────

describe("analyzeDevOpsDimension — documentation", () => {
  it("uses documentation-specific checks", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      ".github/ISSUE_TEMPLATE/new-entry.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      "scripts/validate.sh",
    ]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "documentation"
    );

    assert.equal(result.score, 100);

    // Should have doc-specific findings
    const issueFinding = result.findings.find((f) =>
      f.name.includes("contribution requests")
    );
    assert.ok(issueFinding, "Expected issue template finding for docs project");
  });

  it("checks for automation tools like awesome-lint", async () => {
    const tree = mockTree(["Makefile"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "documentation"
    );

    const automationFinding = result.findings.find((f) =>
      f.name.includes("Automation")
    );
    assert.equal(automationFinding.passed, true);
  });
});

// ── Hybrid DevOps ──────────────────────────────────────────────────────────

describe("analyzeDevOpsDimension — hybrid", () => {
  it("includes both application and IaC findings", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      "Dockerfile",
      "Makefile",
    ]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "hybrid"
    );

    const iacFindings = result.findings.filter((f) =>
      f.name.startsWith("[IaC]")
    );
    assert.ok(iacFindings.length > 0, "Expected IaC findings in hybrid mode");

    // IaC findings should have halved weights
    for (const f of iacFindings) {
      assert.ok(f.weight <= 15, `IaC weight should be halved, got ${f.weight}`);
    }
  });
});

// ── Score calculation ──────────────────────────────────────────────────────

describe("analyzeDevOpsDimension — score calculation", () => {
  it("calculates score as weighted percentage", async () => {
    // Only CI passes (weight 30 out of total 90 for application)
    const tree = mockTree([".github/workflows/ci.yml"]);
    const result = await analyzeDevOpsDimension(
      tree,
      mockMeta(),
      "owner/repo",
      "application"
    );

    // CI=30, Docker=20, Release=20, Templates=15, Deploy=5 → total 90
    // Only CI passes → 30/90 ≈ 33
    const expected = Math.round((30 / 90) * 100);
    assert.equal(result.score, expected);
  });

  it("returns proper DimensionResult shape", async () => {
    const tree = mockTree(["README.md"]);
    const result = await analyzeDevOpsDimension(
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
