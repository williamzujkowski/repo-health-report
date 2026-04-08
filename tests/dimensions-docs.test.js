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
    description: "A well-documented project",
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

const { analyzeDocsDimension } = await import("../dist/dimensions/docs.js");

// ── Tests ──────────────────────────────────────────────────────────────────

describe("analyzeDocsDimension", () => {
  beforeEach(() => {
    // Default: fetchFileContent returns null (file not found)
    mockFetchFileContent = async () => null;
  });

  it("scores high for a well-documented repo", async () => {
    mockFetchFileContent = async (_slug, path) => {
      if (path === "README.md") return "A".repeat(600);
      return null;
    };

    const tree = mockTree([
      "README.md",
      "LICENSE",
      "CONTRIBUTING.md",
      "CHANGELOG.md",
      "docs/guide.md",
      "CODE_OF_CONDUCT.md",
    ]);
    const meta = mockMeta();
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    assert.equal(result.name, "Documentation");
    assert.equal(result.score, 100);
    assert.ok(result.durationMs >= 0);
    assert.equal(result.findings.length, 7);
    for (const f of result.findings) {
      assert.equal(f.passed, true, `Expected "${f.name}" to pass`);
    }
  });

  it("scores low for a minimal repo with short README", async () => {
    mockFetchFileContent = async (_slug, path) => {
      if (path === "README.md") return "# Hello\nShort readme.";
      return null;
    };

    const tree = mockTree(["README.md"]);
    const meta = mockMeta({ description: null, license: null });
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    assert.ok(result.score < 30, `Expected low score, got ${result.score}`);

    const readmeFinding = result.findings.find(
      (f) => f.name === "README quality"
    );
    assert.equal(readmeFinding.passed, false);
    assert.match(readmeFinding.detail, /too short/);
  });

  it("scores very low when no README exists", async () => {
    const tree = mockTree(["src/index.ts"]);
    const meta = mockMeta({ description: null, license: null });
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    assert.ok(result.score < 10, `Expected very low score, got ${result.score}`);

    const readmeFinding = result.findings.find(
      (f) => f.name === "README quality"
    );
    assert.equal(readmeFinding.passed, false);
    assert.match(readmeFinding.detail, /No README/);
  });

  it("falls back to README.rst then README (no extension)", async () => {
    let fetchedPaths = [];
    mockFetchFileContent = async (_slug, path) => {
      fetchedPaths.push(path);
      if (path === "README") return "A".repeat(600);
      return null;
    };

    const tree = mockTree(["README"]);
    const meta = mockMeta();
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    // Should try README.md, README.rst, then README
    assert.deepEqual(fetchedPaths, ["README.md", "README.rst", "README"]);

    const readmeFinding = result.findings.find(
      (f) => f.name === "README quality"
    );
    assert.equal(readmeFinding.passed, true);
    assert.match(readmeFinding.detail, /README is 600 chars/);
  });

  it("detects LICENSE via meta.license when no file present", async () => {
    const tree = mockTree(["README.md"]);
    const meta = mockMeta({ license: { spdx_id: "Apache-2.0" } });
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    const licenseFinding = result.findings.find(
      (f) => f.name === "LICENSE file"
    );
    assert.equal(licenseFinding.passed, true);
    assert.match(licenseFinding.detail, /Apache-2.0/);
  });

  it("detects alternative LICENSE names (COPYING, LICENCE)", async () => {
    const tree = mockTree(["COPYING", "README.md"]);
    const meta = mockMeta({ license: null });
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    const licenseFinding = result.findings.find(
      (f) => f.name === "LICENSE file"
    );
    assert.equal(licenseFinding.passed, true);
  });

  it("detects .github/CONTRIBUTING.md", async () => {
    const tree = mockTree([".github/CONTRIBUTING.md"]);
    const meta = mockMeta();
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    const contribFinding = result.findings.find(
      (f) => f.name === "CONTRIBUTING guide"
    );
    assert.equal(contribFinding.passed, true);
  });

  it("detects changelogs in docs/ subdirectories", async () => {
    const tree = mockTree(["docs/releases/v1.0.md"]);
    const meta = mockMeta();
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    const changelogFinding = result.findings.find(
      (f) => f.name === "CHANGELOG"
    );
    assert.equal(changelogFinding.passed, true);
  });

  it("calculates score as weighted percentage", async () => {
    // Only README (good, 600+ chars) and description pass
    // Weights: README=30, LICENSE=20, CONTRIBUTING=15, CHANGELOG=15, docs=10, CoC=5, description=10
    // Passed: README=30, description=10 → 40/105 ≈ 38
    mockFetchFileContent = async (_slug, path) => {
      if (path === "README.md") return "A".repeat(600);
      return null;
    };

    const tree = mockTree(["README.md"]);
    const meta = mockMeta({ license: null });
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    // README (30) + description (10) = 40 out of 105 total weight
    const expected = Math.round((40 / 105) * 100);
    assert.equal(result.score, expected);
  });

  it("returns proper DimensionResult shape", async () => {
    const tree = mockTree(["README.md"]);
    const meta = mockMeta();
    const result = await analyzeDocsDimension(tree, meta, "owner/repo");

    assert.equal(typeof result.name, "string");
    assert.equal(typeof result.score, "number");
    assert.ok(Array.isArray(result.findings));
    assert.equal(typeof result.durationMs, "number");

    for (const f of result.findings) {
      assert.equal(typeof f.name, "string");
      assert.equal(typeof f.passed, "boolean");
      assert.equal(typeof f.detail, "string");
      assert.equal(typeof f.weight, "number");
    }
  });
});
