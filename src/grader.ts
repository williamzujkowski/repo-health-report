import type { DimensionResult } from "./dimensions/security.js";
import type { ProjectType } from "./analyze.js";

export interface GradeResult {
  letter: string;
  overall: number;
  graded: boolean;
  dimensions: DimensionResult[];
  totalDurationMs: number;
}

const DIMENSION_WEIGHTS: Record<ProjectType, Record<string, number>> = {
  application: { Security: 1, Testing: 1, Documentation: 1, Architecture: 1, DevOps: 1, Maintenance: 1 },
  iac: { Security: 1.5, Testing: 0.8, Documentation: 1, Architecture: 1.5, DevOps: 0.8, Maintenance: 0.8 },
  hybrid: { Security: 1.2, Testing: 1, Documentation: 1, Architecture: 1.2, DevOps: 1, Maintenance: 0.8 },
  library: { Security: 0.8, Testing: 1.2, Documentation: 1.5, Architecture: 1, DevOps: 0.5, Maintenance: 1 },
  documentation: { Security: 0.3, Testing: 0.5, Documentation: 2, Architecture: 1.5, DevOps: 0.5, Maintenance: 0.5 },
  runtime: { Security: 0.5, Testing: 0.8, Documentation: 1.5, Architecture: 0.5, DevOps: 0.5, Maintenance: 1.5 },
};

export function computeGrade(
  dimensions: DimensionResult[],
  projectType?: ProjectType
): GradeResult {
  const weights = DIMENSION_WEIGHTS[projectType ?? "application"] ?? DIMENSION_WEIGHTS.application;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of dimensions) {
    const w = weights[dim.name] ?? 1;
    weightedSum += dim.score * w;
    totalWeight += w;
  }
  const overall = Math.round(weightedSum / totalWeight);
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
