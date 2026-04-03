/**
 * Platform detection and configuration for multi-forge support.
 * Issue #19: GitLab and Codeberg/Gitea API support.
 */

export type Platform = "github" | "gitlab" | "codeberg";

export interface PlatformConfig {
  platform: Platform;
  slug: string; // owner/repo
  apiBase: string; // e.g., https://gitlab.com/api/v4
  webBase: string; // e.g., https://gitlab.com
}

/**
 * Strip trailing slashes, .git suffix, and GitLab's /-/... paths from a slug.
 */
function cleanSlug(raw: string): string {
  return raw
    .replace(/\/-\/.*$/, "") // GitLab /-/tree/main etc.
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

/**
 * Parse a GitHub slug from a URL or plain "owner/repo" string.
 * Re-uses the logic from analyze.ts but without throwing on non-GitHub inputs.
 */
function parseGitHubSlug(input: string): string {
  // URL form: https://github.com/owner/repo
  const urlMatch = input.match(
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/
  );
  if (urlMatch) {
    return cleanSlug(urlMatch[1]);
  }

  // Plain slug form: owner/repo
  const slugMatch = input.match(/^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/);
  if (slugMatch) {
    return cleanSlug(slugMatch[0]);
  }

  throw new Error(
    `Invalid repo format: "${input}". Use "owner/repo" or a full URL.`
  );
}

/**
 * Detect the hosting platform from user input (URL or slug).
 *
 * Supported:
 * - gitlab.com/owner/repo  → GitLab
 * - codeberg.org/owner/repo → Codeberg (Gitea)
 * - github.com/owner/repo  → GitHub
 * - owner/repo (plain)     → GitHub (default)
 */
export function detectPlatform(input: string): PlatformConfig {
  // GitLab
  if (input.includes("gitlab.com")) {
    const match = input.match(
      /gitlab\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/
    );
    if (!match) {
      throw new Error(
        `Could not parse GitLab repo from "${input}". Use "https://gitlab.com/owner/repo".`
      );
    }
    return {
      platform: "gitlab",
      slug: cleanSlug(match[1]),
      apiBase: "https://gitlab.com/api/v4",
      webBase: "https://gitlab.com",
    };
  }

  // Codeberg
  if (input.includes("codeberg.org")) {
    const match = input.match(
      /codeberg\.org\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/
    );
    if (!match) {
      throw new Error(
        `Could not parse Codeberg repo from "${input}". Use "https://codeberg.org/owner/repo".`
      );
    }
    return {
      platform: "codeberg",
      slug: cleanSlug(match[1]),
      apiBase: "https://codeberg.org/api/v1",
      webBase: "https://codeberg.org",
    };
  }

  // Default: GitHub
  return {
    platform: "github",
    slug: parseGitHubSlug(input),
    apiBase: "https://api.github.com",
    webBase: "https://github.com",
  };
}
