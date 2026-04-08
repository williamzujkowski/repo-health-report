import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ─��───────────────────────��──────────────────────────────────────

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
    description: "A test repo",
    ciStatus: "SUCCESS",
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

const { analyzeSecurityDimension } = await import(
  "../dist/dimensions/security.js"
);

// ── Tests ──────────────────────────────────────────────────────────────────

describe("analyzeSecurityDimension", () => {
  beforeEach(() => {
    mockFetchFileContent = async () => null;
  });

  it("scores high for a well-secured repo", async () => {
    const tree = mockTree([
      "SECURITY.md",
      ".github/workflows/ci.yml",
      ".github/dependabot.yml",
      "CODEOWNERS",
      ".gitignore",
      ".gitattributes",
      "sbom.json",
      ".github/workflows/codeql-analysis.yml",
      ".gitleaks.toml",
    ]);

    // Mock SECURITY.md with rich content
    mockFetchFileContent = async (_slug, path) => {
      if (path === "SECURITY.md") {
        return "# Security Policy\n\nPlease report vulnerabilities to security@example.com.\n\nWe follow responsible disclosure with a 90-day timeline.\n\n" +
          "Additional details about our security process and contact information.".padEnd(300, ".");
      }
      // Mock workflow content with SHA-pinned actions and explicit permissions
      if (path === ".github/workflows/ci.yml") {
        return [
          "permissions:",
          "  contents: read",
          "jobs:",
          "  build:",
          "    steps:",
          "      - uses: actions/checkout@a81bbbf8298c0fa03ea29cdc473d45769f953675",
          "      - uses: actions/setup-node@b39b52d1213e96004bfcb1c61a8a6fa8ab84f3e8",
        ].join("\n");
      }
      return null;
    };

    const result = await analyzeSecurityDimension(tree, mockMeta(), "test/repo");
    assert.equal(result.name, "Security");
    assert.ok(result.score >= 80, `Expected score >= 80, got ${result.score}`);
    assert.ok(result.findings.length > 0);
  });

  it("scores low for a bare repo with no security features", async () => {
    const tree = mockTree(["README.md", "src/index.ts"]);
    const meta = mockMeta({ ciStatus: null });

    const result = await analyzeSecurityDimension(tree, meta, "test/repo");
    assert.equal(result.name, "Security");
    assert.ok(result.score <= 30, `Expected score <= 30, got ${result.score}`);
  });

  it("detects SECURITY.md placeholder (< 200 chars)", async () => {
    const tree = mockTree(["SECURITY.md", ".gitignore"]);
    mockFetchFileContent = async () => "# Security\nTODO";

    const result = await analyzeSecurityDimension(tree, mockMeta(), "test/repo");
    const secFinding = result.findings.find((f) =>
      f.name.includes("Security policy")
    );
    assert.ok(secFinding);
    assert.equal(secFinding.passed, false);
    assert.ok(secFinding.detail.includes("placeholder"));
  });

  it("passes SECURITY.md with contact info", async () => {
    const tree = mockTree(["SECURITY.md", ".gitignore"]);
    mockFetchFileContent = async () =>
      "# Security Policy\n\nPlease report vulnerabilities to security@example.com.\n\nWe follow responsible disclosure.\n" +
      "Details about our process and timeline for handling reports.".padEnd(250, ".");

    const result = await analyzeSecurityDimension(tree, mockMeta(), "test/repo");
    const secFinding = result.findings.find((f) =>
      f.name.includes("Security policy")
    );
    assert.ok(secFinding);
    assert.equal(secFinding.passed, true);
  });

  it("detects committed .env files", async () => {
    const tree = mockTree([
      "README.md",
      ".gitignore",
      ".env",
      ".env.local",
    ]);

    const result = await analyzeSecurityDimension(tree, mockMeta(), "test/repo");
    const envFinding = result.findings.find((f) =>
      f.name.includes(".env")
    );
    assert.ok(envFinding);
    assert.equal(envFinding.passed, false);
    assert.ok(envFinding.detail.includes("secrets"));
  });

  it("checks CI status from meta (SUCCESS)", async () => {
    const tree = mockTree([".github/workflows/ci.yml", ".gitignore"]);
    const meta = mockMeta({ ciStatus: "SUCCESS" });

    const result = await analyzeSecurityDimension(tree, meta, "test/repo");
    const ciFinding = result.findings.find((f) =>
      f.name.includes("CI status")
    );
    assert.ok(ciFinding);
    assert.equal(ciFinding.passed, true);
    assert.ok(ciFinding.detail.includes("passing"));
  });

  it("checks CI status from meta (FAILURE)", async () => {
    const tree = mockTree([".github/workflows/ci.yml", ".gitignore"]);
    const meta = mockMeta({ ciStatus: "FAILURE" });

    const result = await analyzeSecurityDimension(tree, meta, "test/repo");
    const ciFinding = result.findings.find((f) =>
      f.name.includes("CI status")
    );
    assert.ok(ciFinding);
    assert.equal(ciFinding.passed, false);
    assert.ok(ciFinding.detail.includes("FAILING"));
  });

  it("calculates score as weighted percentage of passing findings", async () => {
    const tree = mockTree(["README.md"]);
    const meta = mockMeta({ ciStatus: null });

    const result = await analyzeSecurityDimension(tree, meta, "test/repo");
    const totalWeight = result.findings.reduce((sum, f) => sum + f.weight, 0);
    const earnedWeight = result.findings
      .filter((f) => f.passed)
      .reduce((sum, f) => sum + f.weight, 0);
    const expectedScore = Math.round((earnedWeight / totalWeight) * 100);
    assert.equal(result.score, expectedScore);
  });

  it("returns proper DimensionResult shape", async () => {
    const tree = mockTree(["README.md", ".gitignore"]);
    const result = await analyzeSecurityDimension(tree, mockMeta(), "test/repo");

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

  it("detects code scanning and secret scanning tools", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      ".github/workflows/codeql-analysis.yml",
      ".gitleaks.toml",
      ".gitignore",
    ]);

    const result = await analyzeSecurityDimension(tree, mockMeta(), "test/repo");
    const codeScan = result.findings.find((f) =>
      f.name.includes("Code scanning")
    );
    const secretScan = result.findings.find((f) =>
      f.name.includes("Secret scanning")
    );
    assert.ok(codeScan);
    assert.equal(codeScan.passed, true);
    assert.ok(secretScan);
    assert.equal(secretScan.passed, true);
  });
});

describe("analyzeSecurityDimension — maintenance dimension", () => {
  beforeEach(() => {
    mockFetchFileContent = async () => null;
  });

  it("detects SBOM in workflow content", async () => {
    const tree = mockTree([
      ".github/workflows/ci.yml",
      ".gitignore",
    ]);

    mockFetchFileContent = async (_slug, path) => {
      if (path === ".github/workflows/ci.yml") {
        return [
          "jobs:",
          "  sbom:",
          "    steps:",
          "      - uses: anchore/sbom-action@v0",
          "        with:",
          "          syft-version: latest",
        ].join("\n");
      }
      return null;
    };

    const result = await analyzeSecurityDimension(tree, mockMeta(), "test/repo");
    const sbomFinding = result.findings.find((f) =>
      f.name.includes("SBOM")
    );
    assert.ok(sbomFinding);
    assert.equal(sbomFinding.passed, true);
  });
});
