import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { computeTrendSummary } = await import("../dist/trend-view.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSnapshot(month, repos) {
  return {
    meta: {
      month,
      generated: new Date().toISOString(),
      totalRepos: repos.length,
      successCount: repos.filter((r) => !r.error).length,
      failCount: repos.filter((r) => r.error).length,
    },
    repos,
  };
}

function makeRepo(slug, score, letter, dimensions = {}) {
  return { slug, score, letter, dimensions };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("computeTrendSummary", () => {
  it("computes correct deltas between two snapshots", () => {
    const prev = makeSnapshot("2026-03", [
      makeRepo("owner/repo1", 70, "C", { Security: 60, Testing: 80 }),
      makeRepo("owner/repo2", 85, "B", { Security: 90, Testing: 80 }),
    ]);
    const curr = makeSnapshot("2026-04", [
      makeRepo("owner/repo1", 80, "B", { Security: 75, Testing: 85 }),
      makeRepo("owner/repo2", 82, "B", { Security: 85, Testing: 80 }),
    ]);

    const summary = computeTrendSummary(prev, curr);
    assert.equal(summary.previousMonth, "2026-03");
    assert.equal(summary.currentMonth, "2026-04");
    assert.equal(summary.totalRepos, 2);
    assert.equal(summary.improved, 1);
    assert.equal(summary.regressed, 1);
    assert.equal(summary.unchanged, 0);
  });

  it("identifies biggest gainers correctly", () => {
    const prev = makeSnapshot("2026-03", [
      makeRepo("small-gain", 70, "C", {}),
      makeRepo("big-gain", 50, "F", {}),
      makeRepo("no-change", 80, "B", {}),
    ]);
    const curr = makeSnapshot("2026-04", [
      makeRepo("small-gain", 75, "C", {}),
      makeRepo("big-gain", 80, "B", {}),
      makeRepo("no-change", 80, "B", {}),
    ]);

    const summary = computeTrendSummary(prev, curr);
    assert.equal(summary.biggestGainers.length, 2);
    assert.equal(summary.biggestGainers[0].slug, "big-gain");
    assert.equal(summary.biggestGainers[0].delta, 30);
    assert.equal(summary.biggestGainers[1].slug, "small-gain");
    assert.equal(summary.biggestGainers[1].delta, 5);
  });

  it("identifies biggest losers correctly", () => {
    const prev = makeSnapshot("2026-03", [
      makeRepo("regression", 90, "A", {}),
      makeRepo("stable", 70, "C", {}),
    ]);
    const curr = makeSnapshot("2026-04", [
      makeRepo("regression", 60, "D", {}),
      makeRepo("stable", 70, "C", {}),
    ]);

    const summary = computeTrendSummary(prev, curr);
    assert.equal(summary.biggestLosers.length, 1);
    assert.equal(summary.biggestLosers[0].slug, "regression");
    assert.equal(summary.biggestLosers[0].delta, -30);
  });

  it("detects new repos added to tracking", () => {
    const prev = makeSnapshot("2026-03", [
      makeRepo("existing", 80, "B", {}),
    ]);
    const curr = makeSnapshot("2026-04", [
      makeRepo("existing", 80, "B", {}),
      makeRepo("new-repo", 75, "C", {}),
    ]);

    const summary = computeTrendSummary(prev, curr);
    assert.equal(summary.newRepos.length, 1);
    assert.equal(summary.newRepos[0].slug, "new-repo");
    assert.equal(summary.totalRepos, 1); // only repos in both are counted
  });

  it("detects dropped repos", () => {
    const prev = makeSnapshot("2026-03", [
      makeRepo("staying", 80, "B", {}),
      makeRepo("leaving", 60, "D", {}),
    ]);
    const curr = makeSnapshot("2026-04", [
      makeRepo("staying", 80, "B", {}),
    ]);

    const summary = computeTrendSummary(prev, curr);
    assert.equal(summary.droppedRepos.length, 1);
    assert.equal(summary.droppedRepos[0], "leaving");
  });

  it("computes correct average delta", () => {
    const prev = makeSnapshot("2026-03", [
      makeRepo("repo1", 60, "D", {}),
      makeRepo("repo2", 70, "C", {}),
      makeRepo("repo3", 80, "B", {}),
    ]);
    const curr = makeSnapshot("2026-04", [
      makeRepo("repo1", 70, "C", {}), // +10
      makeRepo("repo2", 75, "C", {}), // +5
      makeRepo("repo3", 75, "C", {}), // -5
    ]);

    const summary = computeTrendSummary(prev, curr);
    // Average delta: (10 + 5 + -5) / 3 = 3.3
    assert.equal(summary.averageDelta, 3.3);
  });

  it("handles empty snapshots gracefully", () => {
    const prev = makeSnapshot("2026-03", []);
    const curr = makeSnapshot("2026-04", []);

    const summary = computeTrendSummary(prev, curr);
    assert.equal(summary.totalRepos, 0);
    assert.equal(summary.averageDelta, 0);
    assert.equal(summary.improved, 0);
    assert.equal(summary.regressed, 0);
  });

  it("skips repos with errors in snapshots", () => {
    const prev = makeSnapshot("2026-03", [
      makeRepo("good", 80, "B", {}),
      { slug: "broken", score: 0, letter: "F", dimensions: {}, error: "404" },
    ]);
    const curr = makeSnapshot("2026-04", [
      makeRepo("good", 85, "B", {}),
      { slug: "broken", score: 0, letter: "F", dimensions: {}, error: "timeout" },
    ]);

    const summary = computeTrendSummary(prev, curr);
    assert.equal(summary.totalRepos, 1); // only "good" counted
    assert.equal(summary.improved, 1);
  });

  it("computes per-dimension deltas", () => {
    const prev = makeSnapshot("2026-03", [
      makeRepo("repo", 70, "C", { Security: 60, Testing: 80, Documentation: 70 }),
    ]);
    const curr = makeSnapshot("2026-04", [
      makeRepo("repo", 75, "C", { Security: 80, Testing: 70, Documentation: 75 }),
    ]);

    const summary = computeTrendSummary(prev, curr);
    const delta = summary.biggestGainers[0];
    assert.equal(delta.dimensionDeltas.Security, 20);
    assert.equal(delta.dimensionDeltas.Testing, -10);
    assert.equal(delta.dimensionDeltas.Documentation, 5);
  });

  it("handles single identical snapshot (all unchanged)", () => {
    const repos = [
      makeRepo("repo1", 80, "B", {}),
      makeRepo("repo2", 70, "C", {}),
    ];
    const prev = makeSnapshot("2026-03", repos);
    const curr = makeSnapshot("2026-04", repos);

    const summary = computeTrendSummary(prev, curr);
    assert.equal(summary.unchanged, 2);
    assert.equal(summary.improved, 0);
    assert.equal(summary.regressed, 0);
    assert.equal(summary.averageDelta, 0);
    assert.equal(summary.biggestGainers.length, 0);
    assert.equal(summary.biggestLosers.length, 0);
  });
});
