import type { DimensionResult } from "./dimensions/security.js";
import type { ProjectType, RepoSizeTier } from "./analyze.js";

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
  mirror: { Security: 0.3, Testing: 0.5, Documentation: 1.5, Architecture: 0.5, DevOps: 0.2, Maintenance: 1.5 },
};

/**
 * Apply a size-based score adjustment for small repos.
 *
 * Small repos (< 50 files) naturally miss enterprise-scale checks like
 * release automation, SAST, and Docker configs. To avoid unfairly penalising
 * them, each dimension score above 40 receives up to +10 bonus points.
 * Medium and large repos receive no adjustment (baseline).
 */
function applySizeAdjustment(score: number, sizeTier: RepoSizeTier): number {
  if (sizeTier !== "small") return score;
  // Only boost if the repo has some passing basics (score > 40)
  if (score <= 40) return score;
  const bonus = Math.min(10, 100 - score);
  return score + bonus;
}

export function computeGrade(
  dimensions: DimensionResult[],
  projectType?: ProjectType,
  sizeTier?: RepoSizeTier
): GradeResult {
  const weights = DIMENSION_WEIGHTS[projectType ?? "application"] ?? DIMENSION_WEIGHTS.application;
  const tier = sizeTier ?? "medium";
  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of dimensions) {
    const w = weights[dim.name] ?? 1;
    const adjustedScore = applySizeAdjustment(dim.score, tier);
    weightedSum += adjustedScore * w;
    totalWeight += w;
  }
  const overall = Math.round(weightedSum / totalWeight);
  const totalDurationMs = dimensions.reduce((sum, d) => sum + d.durationMs, 0);

  // Documentation and mirror repos are not graded on code metrics
  if (projectType === "documentation" || projectType === "mirror") {
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
