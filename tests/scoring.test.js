import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDimensionScore, buildDimensionResult } from "../dist/scoring.js";

function makeFinding(passed, weight) {
  return { name: "test", passed, detail: "test detail", weight };
}

describe("computeDimensionScore", () => {
  it("returns 100 when all findings pass", () => {
    const findings = [makeFinding(true, 10), makeFinding(true, 20)];
    assert.equal(computeDimensionScore(findings), 100);
  });

  it("returns 0 when no findings pass", () => {
    const findings = [makeFinding(false, 10), makeFinding(false, 20)];
    assert.equal(computeDimensionScore(findings), 0);
  });

  it("returns 0 for empty findings array", () => {
    assert.equal(computeDimensionScore([]), 0);
  });

  it("returns 0 when all weights are 0", () => {
    const findings = [makeFinding(true, 0), makeFinding(false, 0)];
    assert.equal(computeDimensionScore(findings), 0);
  });

  it("calculates weighted percentage correctly", () => {
    // 10 earned out of 30 total = 33%
    const findings = [
      makeFinding(true, 10),
      makeFinding(false, 20),
    ];
    assert.equal(computeDimensionScore(findings), 33);
  });

  it("rounds to nearest integer", () => {
    // 15 earned out of 20 total = 75%
    const findings = [
      makeFinding(true, 15),
      makeFinding(false, 5),
    ];
    assert.equal(computeDimensionScore(findings), 75);
  });

  it("handles zero-weight findings correctly", () => {
    // Zero-weight passed findings don't affect score
    const findings = [
      makeFinding(true, 0),
      makeFinding(true, 10),
      makeFinding(false, 10),
    ];
    assert.equal(computeDimensionScore(findings), 50);
  });
});

describe("buildDimensionResult", () => {
  it("returns a proper DimensionResult", () => {
    const start = performance.now();
    const findings = [makeFinding(true, 10), makeFinding(false, 10)];
    const result = buildDimensionResult("Test", findings, start);

    assert.equal(result.name, "Test");
    assert.equal(result.score, 50);
    assert.equal(result.findings, findings);
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0);
  });

  it("computes score using computeDimensionScore", () => {
    const findings = [
      makeFinding(true, 25),
      makeFinding(true, 25),
      makeFinding(false, 50),
    ];
    const result = buildDimensionResult("Mixed", findings, performance.now());
    assert.equal(result.score, 50);
  });
});
