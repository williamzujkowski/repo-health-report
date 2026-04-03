import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { explainScore } = await import("../dist/explain.js");

function makeGrade(dims, letter, overall) {
  return {
    letter,
    overall,
    graded: letter !== "N/A",
    dimensions: dims,
    totalDurationMs: 100,
  };
}

describe("explainScore", () => {
  it("includes project type in output", () => {
    const grade = makeGrade(
      [{ name: "Security", score: 80, findings: [], durationMs: 10 }],
      "B",
      80
    );
    const output = explainScore(grade, "library");
    assert.ok(output.includes("library"), "should mention project type");
  });

  it("includes per-dimension contribution lines", () => {
    const dims = [
      { name: "Security", score: 90, findings: [], durationMs: 10 },
      { name: "Testing", score: 70, findings: [], durationMs: 10 },
    ];
    const grade = makeGrade(dims, "B", 80);
    const output = explainScore(grade, "application");
    assert.ok(output.includes("Security"), "should list Security dimension");
    assert.ok(output.includes("Testing"), "should list Testing dimension");
  });

  it("shows grade scale with marker on current grade", () => {
    const grade = makeGrade(
      [{ name: "Test", score: 85, findings: [], durationMs: 10 }],
      "B",
      85
    );
    const output = explainScore(grade, "application");
    assert.ok(output.includes("<--"), "should mark current grade");
  });

  it("shows overall score in output", () => {
    const grade = makeGrade(
      [{ name: "Test", score: 75, findings: [], durationMs: 10 }],
      "C",
      75
    );
    const output = explainScore(grade, "application");
    assert.ok(output.includes("75"), "should include overall score");
  });

  it("includes weight profile", () => {
    const grade = makeGrade(
      [{ name: "Test", score: 50, findings: [], durationMs: 10 }],
      "F",
      50
    );
    const output = explainScore(grade, "iac");
    assert.ok(output.includes("Weight profile"), "should show weight profile header");
    assert.ok(output.includes("1.5"), "should include iac-specific weight");
  });

  it("adds note for ungraded documentation repos", () => {
    const grade = makeGrade(
      [{ name: "Test", score: 50, findings: [], durationMs: 10 }],
      "N/A",
      50
    );
    const output = explainScore(grade, "documentation");
    assert.ok(
      output.includes("not assigned letter grades"),
      "should note documentation repos are not graded"
    );
  });
});
