import type { Finding, DimensionResult } from "./dimensions/security.js";

/**
 * Compute a dimension score from an array of weighted findings.
 * Score = round(earnedWeight / totalWeight * 100).
 * Returns 0 if totalWeight is 0.
 */
export function computeDimensionScore(findings: Finding[]): number {
  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight === 0) return 0;
  const earnedWeight = findings
    .filter((f) => f.passed)
    .reduce((sum, f) => sum + f.weight, 0);
  return Math.round((earnedWeight / totalWeight) * 100);
}

/**
 * Build a DimensionResult from a name, findings array, and start timestamp.
 */
export function buildDimensionResult(
  name: string,
  findings: Finding[],
  startMs: number,
): DimensionResult {
  return {
    name,
    score: computeDimensionScore(findings),
    findings,
    durationMs: performance.now() - startMs,
  };
}
