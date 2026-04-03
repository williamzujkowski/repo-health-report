import type { DimensionResult } from "./dimensions/security.js";
import type { ProjectType } from "./analyze.js";

export interface GradeResult {
  letter: string;
  overall: number;
  graded: boolean;
  dimensions: DimensionResult[];
  totalDurationMs: number;
}

export function computeGrade(
  dimensions: DimensionResult[],
  projectType?: ProjectType
): GradeResult {
  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);
  const overall = Math.round(totalScore / dimensions.length);
  const totalDurationMs = dimensions.reduce((sum, d) => sum + d.durationMs, 0);

  if (projectType === "documentation") {
    return { letter: "N/A", overall, graded: false, dimensions, totalDurationMs };
  }

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

  return { letter, overall, graded: true, dimensions, totalDurationMs };
}
