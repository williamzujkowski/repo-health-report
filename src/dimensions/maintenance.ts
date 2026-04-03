import { type RepoTree, type RepoMeta, ghApi, treeHasFile } from "../analyze.js";
import type { DimensionResult, Finding } from "./security.js";

interface CommitInfo {
  commit: {
    committer: {
      date: string;
    };
  };
}

interface ReleaseInfo {
  published_at: string;
}

interface TagInfo {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

interface TagCommitInfo {
  commit: {
    committer: {
      date: string;
    };
  };
}

interface ContributorInfo {
  contributions: number;
  login: string;
}

const MS_PER_DAY = 86_400_000;

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY);
}

/**
 * Check #3a: Last commit recency.
 */
async function checkLastCommit(slug: string): Promise<Finding> {
  try {
    const commits = await ghApi<CommitInfo[]>(
      `/repos/${slug}/commits?per_page=1`,
      { paginate: false }
    );
    if (!commits || commits.length === 0) {
      return {
        name: "Last commit recency",
        passed: false,
        detail: "No commits found",
        weight: 30,
      };
    }
    const days = daysSince(commits[0].commit.committer.date);
    if (days <= 30) {
      return {
        name: "Last commit recency",
        passed: true,
        detail: `Last commit ${days} day(s) ago — actively maintained`,
        weight: 30,
      };
    }
    if (days <= 90) {
      return {
        name: "Last commit recency",
        passed: true,
        detail: `Last commit ${days} day(s) ago — moderately active`,
        weight: 15, // partial weight
      };
    }
    return {
      name: "Last commit recency",
      passed: false,
      detail: `Last commit ${days} day(s) ago — may be unmaintained`,
      weight: 30,
    };
  } catch {
    return {
      name: "Last commit recency",
      passed: false,
      detail: "Failed to fetch commit data",
      weight: 30,
    };
  }
}

/**
 * Check #3b: Open issue staleness.
 * Uses GraphQL data from meta.oldestOpenIssues (saves 1 REST call).
 */
function checkIssueStaleness(meta: RepoMeta): Finding {
  const issues = meta.oldestOpenIssues;
  if (!issues || issues.length === 0) {
    return {
      name: "Open issue freshness",
      passed: true,
      detail: "No open issues — good or very small project",
      weight: 15,
    };
  }

  const ages = issues.map((i) => daysSince(i.createdAt));
  const sorted = [...ages].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const oldest = Math.max(...ages);

  if (median < 90) {
    return {
      name: "Open issue freshness",
      passed: true,
      detail: `Median open issue age: ${median} day(s) (oldest sampled: ${oldest} days)`,
      weight: 15,
    };
  }
  return {
    name: "Open issue freshness",
    passed: false,
    detail: `Median open issue age: ${median} day(s) — stale issues accumulating (oldest sampled: ${oldest} days)`,
    weight: 15,
  };
}

/**
 * Check #3e: PR responsiveness (#28).
 * Uses GraphQL data from meta.oldestOpenPrs (no extra API call).
 */
function checkPrResponsiveness(meta: RepoMeta): Finding {
  const prs = meta.oldestOpenPrs;
  if (!prs || prs.length === 0) {
    return {
      name: "PR responsiveness",
      passed: true,
      detail: "No open PRs",
      weight: 10,
    };
  }

  const ages = prs.map((p) => daysSince(p.createdAt));
  const oldest = Math.max(...ages);

  if (oldest > 90) {
    return {
      name: "PR responsiveness",
      passed: false,
      detail: `Review bottleneck detected — oldest open PR is ${oldest} day(s) old`,
      weight: 10,
    };
  }
  return {
    name: "PR responsiveness",
    passed: true,
    detail: `Oldest open PR is ${oldest} day(s) old — PR review is timely`,
    weight: 10,
  };
}

/**
 * Check #3c: Recent releases.
 * Enhanced with version outdatedness gap detection (#17):
 * - If latest release/tag is >1 year old AND there are recent commits: "release hygiene gap"
 * - If commits exist but zero releases/tags ever: "no release process"
 */
async function checkRecentReleases(slug: string): Promise<Finding> {
  try {
    // Fetch last commit date for gap detection
    let hasRecentCommits = false;
    try {
      const commits = await ghApi<CommitInfo[]>(
        `/repos/${slug}/commits?per_page=1`,
        { paginate: false }
      );
      if (commits && commits.length > 0) {
        hasRecentCommits = daysSince(commits[0].commit.committer.date) <= 90;
      }
    } catch {
      // If commit fetch fails, proceed without gap detection
    }

    const releases = await ghApi<ReleaseInfo[]>(
      `/repos/${slug}/releases?per_page=5`,
      { paginate: false }
    );

    // If GitHub Releases exist, use them
    if (releases && releases.length > 0) {
      const latestDays = daysSince(releases[0].published_at);
      if (latestDays <= 180) {
        return {
          name: "Recent releases",
          passed: true,
          detail: `Latest release ${latestDays} day(s) ago (${releases.length} recent releases)`,
          weight: 20,
        };
      }
      // Release hygiene gap: old release but active commits
      if (latestDays > 365 && hasRecentCommits) {
        return {
          name: "Recent releases",
          passed: false,
          detail: `Latest release ${latestDays} day(s) ago but repo has recent commits — release hygiene gap`,
          weight: 20,
        };
      }
      return {
        name: "Recent releases",
        passed: false,
        detail: `Latest release ${latestDays} day(s) ago — no release in 6 months`,
        weight: 20,
      };
    }

    // Fallback: check tags (many projects like Django use tags instead of GitHub Releases)
    const tags = await ghApi<TagInfo[]>(
      `/repos/${slug}/tags?per_page=5`,
      { paginate: false }
    );
    if (tags && tags.length > 0) {
      // Get the date of the latest tag's commit
      const tagCommit = await ghApi<TagCommitInfo>(
        `/repos/${slug}/commits/${tags[0].commit.sha}`,
        { paginate: false }
      );
      if (tagCommit) {
        const latestDays = daysSince(tagCommit.commit.committer.date);
        if (latestDays <= 180) {
          return {
            name: "Recent releases",
            passed: true,
            detail: `Latest tag "${tags[0].name}" ${latestDays} day(s) ago (${tags.length} recent tags)`,
            weight: 20,
          };
        }
        // Release hygiene gap: old tag but active commits
        if (latestDays > 365 && hasRecentCommits) {
          return {
            name: "Recent releases",
            passed: false,
            detail: `Latest tag "${tags[0].name}" ${latestDays} day(s) ago but repo has recent commits — release hygiene gap`,
            weight: 20,
          };
        }
        return {
          name: "Recent releases",
          passed: false,
          detail: `Latest tag "${tags[0].name}" ${latestDays} day(s) ago — no release in 6 months`,
          weight: 20,
        };
      }
    }

    // No releases or tags at all
    if (hasRecentCommits) {
      return {
        name: "Recent releases",
        passed: false,
        detail: "No GitHub releases or tags found but repo has recent commits — no release process",
        weight: 20,
      };
    }

    return {
      name: "Recent releases",
      passed: false,
      detail: "No GitHub releases or tags found — consider publishing releases",
      weight: 20,
    };
  } catch {
    return {
      name: "Recent releases",
      passed: false,
      detail: "Failed to fetch release data",
      weight: 20,
    };
  }
}

/**
 * Check #3d: Stars (adoption signal, informational).
 */
function checkStars(meta: RepoMeta): Finding {
  const stars = meta.stargazers_count ?? 0;
  return {
    name: "Community adoption (stars)",
    passed: stars >= 10,
    detail:
      stars >= 1000
        ? `${stars.toLocaleString()} stars — strong community adoption`
        : stars >= 100
          ? `${stars.toLocaleString()} stars — growing community`
          : stars >= 10
            ? `${stars} stars — small but active community`
            : `${stars} stars — early stage or niche project`,
    weight: 5,
  };
}

/**
 * Check #4: Bus Factor (CHAOSS inspired).
 * Count contributors with >5% of total contributions.
 */
async function checkBusFactor(slug: string): Promise<Finding> {
  try {
    const contributors = await ghApi<ContributorInfo[]>(
      `/repos/${slug}/contributors?per_page=30`,
      { paginate: false }
    );
    if (!contributors || contributors.length === 0) {
      return {
        name: "Bus factor",
        passed: false,
        detail: "No contributor data available",
        weight: 20,
      };
    }

    const totalContribs = contributors.reduce(
      (sum, c) => sum + c.contributions,
      0
    );
    const threshold = totalContribs * 0.05;
    const significantContributors = contributors.filter(
      (c) => c.contributions >= threshold
    );
    const busFactor = significantContributors.length;
    const topNames = significantContributors
      .slice(0, 5)
      .map((c) => c.login)
      .join(", ");

    if (busFactor >= 4) {
      return {
        name: "Bus factor",
        passed: true,
        detail: `Bus factor ${busFactor} — healthy contributor distribution (${topNames})`,
        weight: 20,
      };
    }
    if (busFactor >= 2) {
      return {
        name: "Bus factor",
        passed: true,
        detail: `Bus factor ${busFactor} — moderate (${topNames}). More contributors would reduce risk.`,
        weight: 10, // partial weight for bus factor 2-3
      };
    }
    return {
      name: "Bus factor",
      passed: false,
      detail: `Bus factor ${busFactor} — single point of failure risk (${topNames})`,
      weight: 20,
    };
  } catch {
    return {
      name: "Bus factor",
      passed: false,
      detail: "Failed to fetch contributor data",
      weight: 20,
    };
  }
}

/**
 * Check: Maintainer funding/sustainability signal (#16).
 * Checks for .github/FUNDING.yml or FUNDING.yml.
 * Does not penalize absence — weight is 0 when not found.
 */
function checkFunding(tree: RepoTree): Finding {
  const hasFundingGithub = treeHasFile(tree, ".github/FUNDING.yml");
  const hasFundingRoot = treeHasFile(tree, "FUNDING.yml");
  const found = hasFundingGithub || hasFundingRoot;
  const location = hasFundingGithub ? ".github/FUNDING.yml" : "FUNDING.yml";

  return {
    name: "Maintainer funding",
    passed: found,
    detail: found
      ? `Funding file found (${location}) — sustainability signal`
      : "No FUNDING.yml found (not penalized)",
    weight: found ? 10 : 0,
  };
}

export async function analyzeMaintenanceDimension(
  tree: RepoTree,
  meta: RepoMeta,
  slug: string,
): Promise<DimensionResult> {
  const start = performance.now();

  // Run API-dependent checks in parallel
  // Note: issueStaleness now uses GraphQL data from meta — no REST call needed
  const [lastCommit, recentReleases, busFactor] =
    await Promise.all([
      checkLastCommit(slug),
      checkRecentReleases(slug),
      checkBusFactor(slug),
    ]);

  const issueStaleness = checkIssueStaleness(meta);
  const prResponsiveness = checkPrResponsiveness(meta);
  const stars = checkStars(meta);
  const funding = checkFunding(tree);

  const findings: Finding[] = [
    lastCommit,
    issueStaleness,
    prResponsiveness,
    recentReleases,
    busFactor,
    stars,
    funding,
  ];

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const earnedWeight = findings
    .filter((f) => f.passed)
    .reduce((sum, f) => sum + f.weight, 0);
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  return {
    name: "Maintenance",
    score,
    findings,
    durationMs: performance.now() - start,
  };
}
