import { describe, it } from "node:test";
import assert from "node:assert/strict";

const {
  validateOrgName,
  classifyRiskSeverity,
  buildRisks,
  generateOrgMarkdown,
} = await import("../dist/org-audit.js");

// ── Org name validation ──────────────────────────────────────────────────────

describe("validateOrgName", () => {
  it("accepts a simple org name", () => {
    assert.equal(validateOrgName("cloud-gov"), "cloud-gov");
  });

  it("accepts a single-char org name", () => {
    assert.equal(validateOrgName("x"), "x");
  });

  it("accepts a two-char org name", () => {
    assert.equal(validateOrgName("ab"), "ab");
  });

  it("accepts a 39-char org name (max length)", () => {
    const name = "a" + "b".repeat(37) + "c";
    assert.equal(validateOrgName(name), name);
  });

  it("accepts alphanumeric with hyphens", () => {
    assert.equal(validateOrgName("my-org-123"), "my-org-123");
  });

  it("rejects empty string", () => {
    assert.throws(() => validateOrgName(""), /Invalid org name/);
  });

  it("rejects name starting with hyphen", () => {
    assert.throws(() => validateOrgName("-badorg"), /Invalid org name/);
  });

  it("rejects name ending with hyphen", () => {
    assert.throws(() => validateOrgName("badorg-"), /Invalid org name/);
  });

  it("rejects name with spaces", () => {
    assert.throws(() => validateOrgName("bad org"), /Invalid org name/);
  });

  it("rejects name with special characters", () => {
    assert.throws(() => validateOrgName("org!@#$"), /Invalid org name/);
  });

  it("rejects name longer than 39 chars", () => {
    const name = "a".repeat(40);
    assert.throws(() => validateOrgName(name), /Invalid org name/);
  });

  it("rejects shell injection attempt", () => {
    assert.throws(() => validateOrgName("org; rm -rf /"), /Invalid org name/);
  });

  it("rejects URL injection attempt", () => {
    assert.throws(() => validateOrgName("org/../../etc"), /Invalid org name/);
  });

  it("rejects name with underscores", () => {
    assert.throws(() => validateOrgName("my_org"), /Invalid org name/);
  });

  it("rejects name with dots", () => {
    assert.throws(() => validateOrgName("my.org"), /Invalid org name/);
  });
});

// ── Risk severity classification ─────────────────────────────────────────────

describe("classifyRiskSeverity", () => {
  it("classifies security finding >50% as critical", () => {
    const result = classifyRiskSeverity("Security policy (SECURITY.md)", 55, "security-policy");
    assert.equal(result, "critical");
  });

  it("classifies Pinned dependencies >50% as critical", () => {
    const result = classifyRiskSeverity("Pinned dependencies (Actions SHA)", 92, "supply-chain");
    assert.equal(result, "critical");
  });

  it("does not classify security finding at 50% as critical", () => {
    const result = classifyRiskSeverity("Security policy (SECURITY.md)", 50, "security-policy");
    assert.notEqual(result, "critical");
  });

  it("classifies ci-testing finding >60% as high", () => {
    const result = classifyRiskSeverity("CI workflows", 65, "ci-testing");
    assert.equal(result, "high");
  });

  it("classifies documentation finding >40% as medium", () => {
    const result = classifyRiskSeverity("README quality", 45, "documentation");
    assert.equal(result, "medium");
  });

  it("classifies architecture finding >40% as medium", () => {
    const result = classifyRiskSeverity("Linter configuration", 50, "architecture");
    assert.equal(result, "medium");
  });

  it("classifies maintenance finding as low", () => {
    const result = classifyRiskSeverity("Bus factor", 80, "maintenance");
    assert.equal(result, "low");
  });

  it("classifies unknown finding with low fail rate as low", () => {
    const result = classifyRiskSeverity("Unknown finding", 20, "other");
    assert.equal(result, "low");
  });

  it("classifies unknown finding with >40% fail rate as medium", () => {
    const result = classifyRiskSeverity("Unknown finding", 45, "other");
    assert.equal(result, "medium");
  });
});

// ── Risk report generation ───────────────────────────────────────────────────

/**
 * Helper: build a mock BatchReport with specified findings.
 */
function makeMockReport(repo, findings) {
  return {
    repo,
    letter: "C",
    overall: 70,
    graded: true,
    dimensions: [
      {
        name: "Security",
        score: 70,
        findings: findings.map((f) => ({
          name: f.name,
          passed: f.passed,
          detail: "",
          weight: 1,
        })),
        durationMs: 100,
      },
    ],
    totalDurationMs: 100,
    projectType: "application",
    sizeTier: "medium",
    language: "TypeScript",
    analyzedAt: "2026-04-01T00:00:00Z",
    toolVersion: "1.0.0",
    detectorVersion: "abc123",
    checkCounts: [{ name: "Security", checkCount: findings.length }],
  };
}

describe("buildRisks", () => {
  it("returns empty risks for reports with all passing findings", () => {
    const reports = [
      makeMockReport("org/repo1", [
        { name: "Security policy (SECURITY.md)", passed: true },
      ]),
    ];
    const result = buildRisks(reports);
    assert.equal(result.risks.length, 0);
  });

  it("counts failures across multiple repos", () => {
    const reports = [
      makeMockReport("org/repo1", [
        { name: "Security policy (SECURITY.md)", passed: false },
      ]),
      makeMockReport("org/repo2", [
        { name: "Security policy (SECURITY.md)", passed: false },
      ]),
      makeMockReport("org/repo3", [
        { name: "Security policy (SECURITY.md)", passed: true },
      ]),
    ];
    const result = buildRisks(reports);
    assert.equal(result.risks.length, 1);
    assert.equal(result.risks[0].failCount, 2);
    assert.equal(result.risks[0].failRate, 67);
  });

  it("sorts by severity then fail count", () => {
    const reports = [
      makeMockReport("org/repo1", [
        { name: "Security policy (SECURITY.md)", passed: false },
        { name: "Bus factor", passed: false },
      ]),
      makeMockReport("org/repo2", [
        { name: "Security policy (SECURITY.md)", passed: false },
        { name: "Bus factor", passed: false },
      ]),
    ];
    const result = buildRisks(reports);
    // Security (critical at 100%) should come before Bus factor (low/maintenance)
    assert.equal(result.risks[0].finding, "Security policy (SECURITY.md)");
    assert.equal(result.risks[0].severity, "critical");
  });

  it("calculates fail rate as a percentage", () => {
    const reports = [
      makeMockReport("org/repo1", [{ name: "CI workflows", passed: false }]),
      makeMockReport("org/repo2", [{ name: "CI workflows", passed: true }]),
      makeMockReport("org/repo3", [{ name: "CI workflows", passed: false }]),
      makeMockReport("org/repo4", [{ name: "CI workflows", passed: false }]),
    ];
    const result = buildRisks(reports);
    assert.equal(result.risks[0].failRate, 75);
  });
});

// ── Markdown report generation ───────────────────────────────────────────────

describe("generateOrgMarkdown", () => {
  const summary = {
    org: "test-org",
    analyzedAt: "2026-04-01T00:00:00Z",
    totalRepos: 3,
    gradedRepos: 2,
    averageScore: 65,
    gradeDistribution: { A: 0, B: 0, C: 1, D: 1, F: 0 },
    dimensionAverages: { Security: 70, Testing: 60 },
    languageBreakdown: { TypeScript: 2, Python: 1 },
    typeBreakdown: { application: 2, library: 1 },
  };

  const risks = {
    risks: [
      {
        finding: "Security policy (SECURITY.md)",
        failCount: 2,
        failRate: 67,
        severity: "critical",
        category: "security-policy",
        recommendation: "Add a SECURITY.md",
      },
      {
        finding: "Pre-commit hooks",
        failCount: 3,
        failRate: 100,
        severity: "high",
        category: "ci-testing",
        recommendation: "Add pre-commit hooks",
      },
    ],
  };

  const reports = [
    makeMockReport("test-org/repo-a", []),
    makeMockReport("test-org/repo-b", []),
  ];

  it("includes org name in heading", () => {
    const md = generateOrgMarkdown(summary, risks, reports);
    assert.ok(md.includes("# Org Audit: test-org"));
  });

  it("includes executive summary table", () => {
    const md = generateOrgMarkdown(summary, risks, reports);
    assert.ok(md.includes("| Total repos | 3 |"));
    assert.ok(md.includes("| Average score | 65/100 |"));
  });

  it("includes dimension averages", () => {
    const md = generateOrgMarkdown(summary, risks, reports);
    assert.ok(md.includes("| Security | 70/100 |"));
    assert.ok(md.includes("| Testing | 60/100 |"));
  });

  it("includes risk sections by severity", () => {
    const md = generateOrgMarkdown(summary, risks, reports);
    assert.ok(md.includes("### Critical"));
    assert.ok(md.includes("### High"));
  });

  it("includes quick wins section for >80% fail rate", () => {
    const md = generateOrgMarkdown(summary, risks, reports);
    assert.ok(md.includes("## Quick Wins"));
    assert.ok(md.includes("Pre-commit hooks"));
  });

  it("includes per-repo grades table", () => {
    const md = generateOrgMarkdown(summary, risks, reports);
    assert.ok(md.includes("## Per-Repo Grades"));
    assert.ok(md.includes("| Repo | Grade | Score | Language | Type |"));
  });

  it("includes recommendations section", () => {
    const md = generateOrgMarkdown(summary, risks, reports);
    assert.ok(md.includes("## Recommendations"));
  });
});
