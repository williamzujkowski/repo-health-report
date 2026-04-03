/**
 * External API clients for supplementary data sources.
 * Issue #13: OpenSSF Scorecard API
 * Issue #15: deps.dev dependent count API
 */

export interface ScorecardCheck {
  name: string;
  score: number;
  reason: string;
}

export interface ScorecardResult {
  score: number;
  checks: ScorecardCheck[];
  date: string | null;
}

export interface DepsDevResult {
  dependentCount: number;
  latestVersion: string | null;
}

interface RawScorecardCheck {
  name?: unknown;
  score?: unknown;
  reason?: unknown;
}

interface RawScorecardData {
  score?: unknown;
  checks?: unknown;
  date?: unknown;
}

interface RawDepsDevVersion {
  versionKey?: { version?: unknown };
}

interface RawDepsDevData {
  dependentCount?: unknown;
  versions?: unknown;
}

/**
 * Fetch OpenSSF Scorecard data for a GitHub repo.
 * API: https://api.securityscorecards.dev/projects/github.com/{owner}/{repo}
 *
 * Returns null if the repo is not indexed or the request fails.
 */
export async function fetchScorecard(slug: string): Promise<ScorecardResult | null> {
  try {
    const url = `https://api.securityscorecards.dev/projects/github.com/${slug}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return null;
    const data = await resp.json() as RawScorecardData;
    const score = typeof data.score === "number" ? data.score : 0;
    const rawChecks = Array.isArray(data.checks) ? data.checks as RawScorecardCheck[] : [];
    const checks: ScorecardCheck[] = rawChecks.map((c) => ({
      name: typeof c.name === "string" ? c.name : "unknown",
      score: typeof c.score === "number" ? c.score : -1,
      reason: typeof c.reason === "string" ? c.reason : "",
    }));
    const date = typeof data.date === "string" ? data.date : null;
    return { score, checks, date };
  } catch {
    return null;
  }
}

/**
 * Detect the package ecosystem and name from a repo tree path list.
 * Returns { system, packageName } or null if not determinable.
 *
 * Supported systems: npm, pypi, cargo, go
 */
export function detectPackageInfo(
  treePaths: string[],
  packageJsonName?: string
): { system: string; packageName: string } | null {
  // npm: package.json at root with a name field
  if (treePaths.includes("package.json") && packageJsonName) {
    return { system: "npm", packageName: packageJsonName };
  }
  // pypi: pyproject.toml or setup.py
  if (treePaths.includes("pyproject.toml") || treePaths.includes("setup.py")) {
    return null; // name requires file content parsing; skip for now
  }
  // cargo: Cargo.toml
  if (treePaths.includes("Cargo.toml")) {
    return null; // name requires file content parsing; skip for now
  }
  // go: go.mod
  if (treePaths.includes("go.mod")) {
    return null; // name requires file content parsing; skip for now
  }
  return null;
}

/**
 * Fetch deps.dev package info for a given package name and ecosystem.
 * API: https://api.deps.dev/v3alpha/systems/{system}/packages/{package}
 *
 * Returns null if the package is not found or the request fails.
 */
export async function fetchDepsDevInfo(
  packageName: string,
  system: string
): Promise<DepsDevResult | null> {
  try {
    const url = `https://api.deps.dev/v3alpha/systems/${system}/packages/${encodeURIComponent(packageName)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return null;
    const data = await resp.json() as RawDepsDevData;
    const dependentCount = typeof data.dependentCount === "number" ? data.dependentCount : 0;
    const versions = Array.isArray(data.versions) ? data.versions as RawDepsDevVersion[] : [];
    const lastVersion = versions[versions.length - 1];
    const latestVersion =
      lastVersion?.versionKey?.version != null
        ? String(lastVersion.versionKey.version)
        : null;
    return { dependentCount, latestVersion };
  } catch {
    return null;
  }
}
