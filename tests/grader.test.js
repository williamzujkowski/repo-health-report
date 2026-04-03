import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import the compiled grader from dist
const { computeGrade } = await import("../dist/grader.js");

/**
 * Helper: build a minimal array of DimensionResult stubs with a given average score.
 * Using a single dimension keeps the math simple (average == the score itself).
 */
function makeDimensions(score) {
  return [{ name: "Test", score, findings: [], durationMs: 0 }];
}

/**
 * Helper: build multiple dimensions that average to the target score.
 */
function makeDimensionsAvg(...scores) {
  return scores.map((score, i) => ({
    name: `Dim${i}`,
    score,
    findings: [],
    durationMs: i * 10,
  }));
}

describe("computeGrade — letter grading", () => {
  // ── A grade: overall >= 90 ────────────────────────────────────────────
  it("gives A for score of 100", () => {
    const result = computeGrade(makeDimensions(100));
    assert.equal(result.letter, "A");
    assert.equal(result.overall, 100);
  });

  it("gives A for score of 90 (lower boundary)", () => {
    const result = computeGrade(makeDimensions(90));
    assert.equal(result.letter, "A");
  });

  it("gives A for score of 95 (mid-range A)", () => {
    const result = computeGrade(makeDimensions(95));
    assert.equal(result.letter, "A");
  });

  // ── B grade: 80 <= overall < 90 ───────────────────────────────────────
  it("gives B for score of 89 (upper boundary of B)", () => {
    const result = computeGrade(makeDimensions(89));
    assert.equal(result.letter, "B");
  });

  it("gives B for score of 85 (mid-range B)", () => {
    const result = computeGrade(makeDimensions(85));
    assert.equal(result.letter, "B");
  });

  it("gives B for score of 80 (lower boundary of B)", () => {
    const result = computeGrade(makeDimensions(80));
    assert.equal(result.letter, "B");
  });

  // ── C grade: 70 <= overall < 80 ───────────────────────────────────────
  it("gives C for score of 79 (upper boundary of C)", () => {
    const result = computeGrade(makeDimensions(79));
    assert.equal(result.letter, "C");
  });

  it("gives C for score of 75 (mid-range C)", () => {
    const result = computeGrade(makeDimensions(75));
    assert.equal(result.letter, "C");
  });

  it("gives C for score of 70 (lower boundary of C)", () => {
    const result = computeGrade(makeDimensions(70));
    assert.equal(result.letter, "C");
  });

  // ── D grade: 60 <= overall < 70 ───────────────────────────────────────
  it("gives D for score of 69 (upper boundary of D)", () => {
    const result = computeGrade(makeDimensions(69));
    assert.equal(result.letter, "D");
  });

  it("gives D for score of 65 (mid-range D)", () => {
    const result = computeGrade(makeDimensions(65));
    assert.equal(result.letter, "D");
  });

  it("gives D for score of 60 (lower boundary of D)", () => {
    const result = computeGrade(makeDimensions(60));
    assert.equal(result.letter, "D");
  });

  // ── F grade: overall < 60 ─────────────────────────────────────────────
  it("gives F for score of 59 (upper boundary of F)", () => {
    const result = computeGrade(makeDimensions(59));
    assert.equal(result.letter, "F");
  });

  it("gives F for score of 50 (mid-range F)", () => {
    const result = computeGrade(makeDimensions(50));
    assert.equal(result.letter, "F");
  });

  it("gives F for score of 0 (minimum possible)", () => {
    const result = computeGrade(makeDimensions(0));
    assert.equal(result.letter, "F");
    assert.equal(result.overall, 0);
  });
});

describe("computeGrade — overall score computation", () => {
  it("rounds the average to the nearest integer", () => {
    // (90 + 91) / 2 = 90.5 → rounds to 91
    const result = computeGrade(makeDimensionsAvg(90, 91));
    assert.equal(result.overall, 91);
  });

  it("averages five dimensions correctly", () => {
    // (100 + 80 + 60 + 90 + 70) / 5 = 80
    const result = computeGrade(makeDimensionsAvg(100, 80, 60, 90, 70));
    assert.equal(result.overall, 80);
    assert.equal(result.letter, "B");
  });
});

describe("computeGrade — totalDurationMs", () => {
  it("sums durationMs across all dimensions", () => {
    const dims = [
      { name: "A", score: 80, findings: [], durationMs: 100 },
      { name: "B", score: 80, findings: [], durationMs: 250 },
      { name: "C", score: 80, findings: [], durationMs: 50 },
    ];
    const result = computeGrade(dims);
    assert.equal(result.totalDurationMs, 400);
  });
});

describe("computeGrade — dimensions passthrough", () => {
  it("returns the original dimensions array in the result", () => {
    const dims = makeDimensions(90);
    const result = computeGrade(dims);
    assert.equal(result.dimensions, dims);
  });
});

describe("computeGrade — graded field", () => {
  it("sets graded: true for code repos (no projectType)", () => {
    const result = computeGrade(makeDimensions(80));
    assert.equal(result.graded, true);
  });

  it("sets graded: true for non-documentation projectType", () => {
    const result = computeGrade(makeDimensions(80), "library");
    assert.equal(result.graded, true);
    assert.equal(result.letter, "B");
  });

  it("sets graded: false and letter N/A for documentation projectType", () => {
    const result = computeGrade(makeDimensions(47), "documentation");
    assert.equal(result.graded, false);
    assert.equal(result.letter, "N/A");
    assert.equal(result.overall, 47);
  });

  it("still computes numeric overall score for documentation repos", () => {
    // Score should still be computed for documentation-specific analysis
    const result = computeGrade(makeDimensionsAvg(60, 40), "documentation");
    assert.equal(result.overall, 50);
    assert.equal(result.graded, false);
  });

  it("still returns all dimensions for documentation repos", () => {
    const dims = makeDimensions(50);
    const result = computeGrade(dims, "documentation");
    assert.equal(result.dimensions, dims);
  });
});
