import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ────────────────────────────────────────────────────────────────

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
    description: "A test repo",
    stargazers_count: 100,
    oldestOpenIssues: [],
    oldestOpenPrs: [],
    ...overrides,
  };
}

function mockTree(paths) {
  return { tree: paths.map((p) => ({ path: p, type: "blob" })) };
}

// ── Mock ghApi before importing the module under test ────────────────────

let mockGhApi;

mock.module("../dist/analyze.js", {
  namedExports: {
    treeHasFile: (await import("../dist/analyze.js")).treeHasFile,
    treeHasPattern: (await import("../dist/analyze.js")).treeHasPattern,
    treeCountPattern: (await import("../dist/analyze.js")).treeCountPattern,
    fetchFileContent: async () => null,
    fetchWorkflows: async () => [],
    ghApi: (...args) => mockGhApi(...args),
  },
});

const { analyzeMaintenanceDimension } = await import(
  "../dist/dimensions/maintenance.js"
);

// ── Tests ──────────────────────────────────────────────────────────────────

describe("analyzeMaintenanceDimension", () => {
  beforeEach(() => {
    // Default mock: recent commit, recent release, multiple contributors
    const now = new Date().toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    mockGhApi = async (endpoint) => {
      if (endpoint.includes("/commits")) {
        return [{ commit: { committer: { date: weekAgo } } }];
      }
      if (endpoint.includes("/releases")) {
        return [{ published_at: weekAgo }];
      }
      if (endpoint.includes("/tags")) {
        return [];
      }
      if (endpoint.includes("/contributors")) {
        return [
          { login: "alice", contributions: 100 },
          { login: "bob", contributions: 80 },
          { login: "charlie", contributions: 60 },
          { login: "diana", contributions: 40 },
        ];
      }
      return [];
    };
  });

  it("scores high for an actively maintained repo", async () => {
    const tree = mockTree([".github/FUNDING.yml"]);
    const meta = mockMeta({
      stargazers_count: 500,
      oldestOpenIssues: [
        { createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
      ],
      oldestOpenPrs: [
        { createdAt: new Date(Date.now() - 15 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
      ],
    });

    const result = await analyzeMaintenanceDimension(tree, meta, "test/repo");
    assert.equal(result.name, "Maintenance");
    assert.ok(result.score >= 70, `Expected score >= 70, got ${result.score}`);
  });

  it("scores low for an abandoned repo", async () => {
    const yearAgo = new Date(Date.now() - 400 * 86400000).toISOString();

    mockGhApi = async (endpoint) => {
      if (endpoint.includes("/commits")) {
        return [{ commit: { committer: { date: yearAgo } } }];
      }
      if (endpoint.includes("/releases")) {
        return [];
      }
      if (endpoint.includes("/tags")) {
        return [];
      }
      if (endpoint.includes("/contributors")) {
        return [{ login: "solo", contributions: 100 }];
      }
      return [];
    };

    const tree = mockTree([]);
    const meta = mockMeta({
      stargazers_count: 2,
      oldestOpenIssues: [
        { createdAt: yearAgo, updatedAt: yearAgo },
      ],
      oldestOpenPrs: [
        { createdAt: yearAgo, updatedAt: yearAgo },
      ],
    });

    const result = await analyzeMaintenanceDimension(tree, meta, "test/repo");
    assert.ok(result.score <= 30, `Expected score <= 30, got ${result.score}`);
  });

  it("detects bus factor 1 (single contributor)", async () => {
    mockGhApi = async (endpoint) => {
      if (endpoint.includes("/commits")) {
        return [{ commit: { committer: { date: new Date().toISOString() } } }];
      }
      if (endpoint.includes("/releases")) {
        return [{ published_at: new Date().toISOString() }];
      }
      if (endpoint.includes("/contributors")) {
        return [{ login: "solo-dev", contributions: 100 }];
      }
      return [];
    };

    const tree = mockTree([]);
    const meta = mockMeta({ stargazers_count: 50 });
    const result = await analyzeMaintenanceDimension(tree, meta, "test/repo");

    const busFactor = result.findings.find((f) => f.name.includes("Bus factor"));
    assert.ok(busFactor);
    assert.equal(busFactor.passed, false);
    assert.ok(busFactor.detail.includes("single point"));
  });

  it("detects stale open issues", async () => {
    const tree = mockTree([]);
    const longAgo = new Date(Date.now() - 200 * 86400000).toISOString();
    const meta = mockMeta({
      oldestOpenIssues: [
        { createdAt: longAgo, updatedAt: longAgo },
        { createdAt: longAgo, updatedAt: longAgo },
        { createdAt: longAgo, updatedAt: longAgo },
      ],
    });

    const result = await analyzeMaintenanceDimension(tree, meta, "test/repo");
    const issueFinding = result.findings.find((f) =>
      f.name.includes("issue freshness")
    );
    assert.ok(issueFinding);
    assert.equal(issueFinding.passed, false);
    assert.ok(issueFinding.detail.includes("stale"));
  });

  it("detects PR review bottleneck", async () => {
    const tree = mockTree([]);
    const longAgo = new Date(Date.now() - 120 * 86400000).toISOString();
    const meta = mockMeta({
      oldestOpenPrs: [
        { createdAt: longAgo, updatedAt: longAgo },
      ],
    });

    const result = await analyzeMaintenanceDimension(tree, meta, "test/repo");
    const prFinding = result.findings.find((f) =>
      f.name.includes("PR responsiveness")
    );
    assert.ok(prFinding);
    assert.equal(prFinding.passed, false);
    assert.ok(prFinding.detail.includes("bottleneck"));
  });

  it("detects funding file as sustainability signal", async () => {
    const tree = mockTree([".github/FUNDING.yml"]);
    const meta = mockMeta();

    const result = await analyzeMaintenanceDimension(tree, meta, "test/repo");
    const fundingFinding = result.findings.find((f) =>
      f.name.includes("funding")
    );
    assert.ok(fundingFinding);
    assert.equal(fundingFinding.passed, true);
    assert.ok(fundingFinding.weight > 0);
  });

  it("does not penalize absence of funding file", async () => {
    const tree = mockTree([]);
    const meta = mockMeta();

    const result = await analyzeMaintenanceDimension(tree, meta, "test/repo");
    const fundingFinding = result.findings.find((f) =>
      f.name.includes("funding")
    );
    assert.ok(fundingFinding);
    assert.equal(fundingFinding.passed, false);
    assert.equal(fundingFinding.weight, 0); // zero weight when absent
  });

  it("returns proper DimensionResult shape", async () => {
    const tree = mockTree([]);
    const result = await analyzeMaintenanceDimension(tree, mockMeta(), "test/repo");

    assert.equal(typeof result.name, "string");
    assert.equal(typeof result.score, "number");
    assert.ok(Array.isArray(result.findings));
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0);

    for (const f of result.findings) {
      assert.equal(typeof f.name, "string");
      assert.equal(typeof f.passed, "boolean");
      assert.equal(typeof f.detail, "string");
      assert.equal(typeof f.weight, "number");
    }
  });

  it("calculates score as weighted percentage", async () => {
    const tree = mockTree([]);
    const result = await analyzeMaintenanceDimension(tree, mockMeta(), "test/repo");

    const totalWeight = result.findings.reduce((sum, f) => sum + f.weight, 0);
    const earnedWeight = result.findings
      .filter((f) => f.passed)
      .reduce((sum, f) => sum + f.weight, 0);
    const expectedScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
    assert.equal(result.score, expectedScore);
  });
});
