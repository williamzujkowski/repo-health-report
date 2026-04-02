import type { DimensionResult } from "./dimensions/security.js";

export interface GradeResult {
  letter: string;
  overall: number;
  dimensions: DimensionResult[];
  totalDurationMs: number;
}

export function computeGrade(dimensions: DimensionResult[]): GradeResult {
  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);
  const overall = Math.round(totalScore / dimensions.length);
  const totalDurationMs = dimensions.reduce((sum, d) => sum + d.durationMs, 0);

  let letter: string;
  if (overall >= 90) {
    letter = "A";
  } else if (overall >= 80) {
    letter = "B";
  } else if (overall >= 70) {
    letter = "C";
  } else if (overall >= 60) {
    letter = "D";
  } else {
    letter = "F";
  }

  return { letter, overall, dimensions, totalDurationMs };
}
