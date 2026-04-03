import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeSupplyChain } from "../dist/supply-chain.js";

/** Minimal TreeAnalytics stub with supply-chain fields. */
function makeAnalytics(overrides = {}) {
  return {
    fileCount: 10,
    directoryCount: 2,
    maxDepth: 3,
    avgFilesPerDir: 5,
    testFileCount: 0,
    sourceFileCount: 5,
    testToSourceRatio: 0,
    markdownFileCount: 1,
    docFileCount: 0,
    dependencyFiles: ["package.json"],
    dependencyFileCount: 1,
    isMonorepo: false,
    hasLockfile: true,
    lockfileCount: 1,
    manifestCount: 1,
    estimatedDependencyCount: 25,
    configFiles: [],
    configScore: 0,
    hasVendorCommitted: false,
    hasDistCommitted: false,
    hasMinifiedFiles: false,
    hasDotEnvCommitted: false,
    antiPatternCount: 0,
    sizeCategory: "small",
    ...overrides,
  };
}

/** Minimal RepoMeta stub. */
function makeMeta(overrides = {}) {
  return {
    default_branch: "main",
    language: "JavaScript",
    has_issues: true,
    has_wiki: false,
    has_pages: false,
    license: { spdx_id: "MIT" },
    open_issues_count: 0,
    archived: false,
    description: "Test repo",
    dependabotAlerts: null,
    ...overrides,
  };
}

describe("analyzeSupplyChain", () => {
  // ── Risk tier computation ──────────────────────────────────────────────

  it("returns critical risk when 1+ critical alert", () => {
    const result = analyzeSupplyChain(
      makeAnalytics(),
      makeMeta({
        dependabotAlerts: {
          totalCount: 1,
          critical: 1,
          high: 0,
          medium: 0,
          low: 0,
          packages: ["lodash"],
        },
      }),
    );
    assert.equal(result.risk, "critical");
    assert.ok(result.summary.includes("1 critical"));
  });

  it("returns critical risk when critical+high >= 5", () => {
    const result = analyzeSupplyChain(
      makeAnalytics(),
      makeMeta({
        dependabotAlerts: {
          totalCount: 5,
          critical: 0,
          high: 5,
          medium: 0,
          low: 0,
          packages: ["a", "b", "c", "d", "e"],
        },
      }),
    );
    assert.equal(result.risk, "critical");
  });

  it("returns high risk when 1+ high alert", () => {
    const result = analyzeSupplyChain(
      makeAnalytics(),
      makeMeta({
        dependabotAlerts: {
          totalCount: 1,
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
          packages: ["express"],
        },
      }),
    );
    assert.equal(result.risk, "high");
  });

  it("returns high risk when total >= 10", () => {
    const result = analyzeSupplyChain(
      makeAnalytics(),
      makeMeta({
        dependabotAlerts: {
          totalCount: 10,
          critical: 0,
          high: 0,
          medium: 0,
          low: 10,
          packages: ["a"],
        },
      }),
    );
    assert.equal(result.risk, "high");
  });

  it("returns medium risk when 1+ medium alert", () => {
    const result = analyzeSupplyChain(
      makeAnalytics(),
      makeMeta({
        dependabotAlerts: {
          totalCount: 1,
          critical: 0,
          high: 0,
          medium: 1,
          low: 0,
          packages: ["foo"],
        },
      }),
    );
    assert.equal(result.risk, "medium");
  });

  it("returns medium risk when no lockfile and alerts available", () => {
    const result = analyzeSupplyChain(
      makeAnalytics({ hasLockfile: false }),
      makeMeta({
        dependabotAlerts: {
          totalCount: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          packages: [],
        },
      }),
    );
    assert.equal(result.risk, "medium");
  });

  it("returns low risk when lockfile present and no alerts", () => {
    const result = analyzeSupplyChain(
      makeAnalytics({ hasLockfile: true }),
      makeMeta({
        dependabotAlerts: {
          totalCount: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          packages: [],
        },
      }),
    );
    assert.equal(result.risk, "low");
    assert.equal(result.summary, "No known vulnerabilities");
  });

  // ── Graceful handling of null Dependabot data ──────────────────────────

  it("returns low risk when alerts null and lockfile present", () => {
    const result = analyzeSupplyChain(
      makeAnalytics({ hasLockfile: true }),
      makeMeta({ dependabotAlerts: null }),
    );
    assert.equal(result.risk, "low");
    assert.equal(result.dependabotAlerts, null);
    assert.ok(result.summary.includes("unavailable"));
    assert.ok(result.summary.includes("lockfile present"));
  });

  it("returns medium risk when alerts null and no lockfile", () => {
    const result = analyzeSupplyChain(
      makeAnalytics({ hasLockfile: false }),
      makeMeta({ dependabotAlerts: null }),
    );
    assert.equal(result.risk, "medium");
    assert.ok(result.summary.includes("no lockfile"));
  });

  it("returns undefined dependabotAlerts when meta has no alerts", () => {
    const result = analyzeSupplyChain(
      makeAnalytics(),
      makeMeta({}), // dependabotAlerts defaults to null via makeMeta
    );
    assert.equal(result.dependabotAlerts, null);
  });

  // ── Manifest/lockfile detection ────────────────────────────────────────

  it("reports correct manifest count", () => {
    const result = analyzeSupplyChain(
      makeAnalytics({ manifestCount: 3 }),
      makeMeta(),
    );
    assert.equal(result.manifestCount, 3);
  });

  it("reports lockfilePresent from analytics", () => {
    const withLock = analyzeSupplyChain(
      makeAnalytics({ hasLockfile: true }),
      makeMeta(),
    );
    assert.equal(withLock.lockfilePresent, true);

    const withoutLock = analyzeSupplyChain(
      makeAnalytics({ hasLockfile: false }),
      makeMeta(),
    );
    assert.equal(withoutLock.lockfilePresent, false);
  });

  // ── Summary string format ──────────────────────────────────────────────

  it("formats summary with mixed severity counts", () => {
    const result = analyzeSupplyChain(
      makeAnalytics(),
      makeMeta({
        dependabotAlerts: {
          totalCount: 6,
          critical: 1,
          high: 2,
          medium: 3,
          low: 0,
          packages: ["a", "b"],
        },
      }),
    );
    assert.ok(result.summary.includes("6 open vulnerabilities"));
    assert.ok(result.summary.includes("1 critical"));
    assert.ok(result.summary.includes("2 high"));
    assert.ok(result.summary.includes("3 medium"));
  });
});
