import type { TreeAnalytics } from "./tree-analytics.js";
import type { RepoMeta } from "./analyze.js";

export type SupplyChainRisk = "critical" | "high" | "medium" | "low" | "unknown";

export interface SupplyChainAnalysis {
  risk: SupplyChainRisk;
  manifestCount: number;
  lockfilePresent: boolean;
  dependabotAlerts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  summary: string;
}

/**
 * Analyze supply chain risk from tree analytics and repo metadata.
 *
 * Risk tiers:
 * - critical: any critical Dependabot alert, or 5+ critical+high combined
 * - high: any high alert, or 10+ total alerts
 * - medium: any medium alert, or no lockfile present
 * - low: lockfile present and no/low alerts
 * - unknown: no alerts data and no lockfile info
 */
export function analyzeSupplyChain(
  analytics: TreeAnalytics,
  meta: RepoMeta,
): SupplyChainAnalysis {
  const alerts = meta.dependabotAlerts;
  const lockfilePresent = analytics.hasLockfile;

  let risk: SupplyChainRisk = "unknown";
  let summary: string;

  if (alerts) {
    const { critical, high, medium } = alerts;
    const total = alerts.totalCount;

    if (critical >= 1 || critical + high >= 5) {
      risk = "critical";
    } else if (high >= 1 || total >= 10) {
      risk = "high";
    } else if (medium >= 1 || !lockfilePresent) {
      risk = "medium";
    } else {
      risk = "low";
    }

    if (total > 0) {
      const parts: string[] = [];
      if (critical > 0) parts.push(`${critical} critical`);
      if (high > 0) parts.push(`${high} high`);
      if (medium > 0) parts.push(`${medium} medium`);
      summary = `${total} open vulnerabilities (${parts.join(", ")})`;
    } else {
      summary = "No known vulnerabilities";
    }

    return {
      risk,
      manifestCount: analytics.manifestCount,
      lockfilePresent,
      dependabotAlerts: { total, critical, high, medium, low: alerts.low },
      summary,
    };
  }

  // No Dependabot data available
  risk = lockfilePresent ? "low" : "medium";
  summary =
    "Dependabot alerts unavailable" +
    (lockfilePresent ? " — lockfile present" : " — no lockfile");

  return {
    risk,
    manifestCount: analytics.manifestCount,
    lockfilePresent,
    dependabotAlerts: null,
    summary,
  };
}
