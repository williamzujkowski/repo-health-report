/**
 * GitLab and Codeberg/Gitea REST API clients.
 * Issue #19: Multi-platform support (Phase 1 & 2).
 *
 * Uses native fetch() — no CLI dependency like GitHub's `gh`.
 */

import type { RepoTree, RepoMeta } from "./analyze.js";

const API_TIMEOUT_MS = 15_000;

// ── GitLab API ──────────────────────────────────────────────────────────

interface GitLabProject {
  default_branch?: string;
  issues_enabled?: boolean;
  wiki_enabled?: boolean;
  archived?: boolean;
  description?: string;
  star_count?: number;
  open_issues_count?: number;
  license?: { key?: string } | null;
}

interface GitLabTreeEntry {
  path: string;
  type: string; // "blob" | "tree"
}

export async function fetchGitLabMeta(
  apiBase: string,
  slug: string
): Promise<RepoMeta> {
  const encoded = encodeURIComponent(slug);
  const resp = await fetch(`${apiBase}/projects/${encoded}`, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`GitLab API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as GitLabProject;
  return {
    default_branch: data.default_branch ?? "main",
    language: null, // GitLab stores languages separately; we fall back to tree detection
    has_issues: data.issues_enabled ?? true,
    has_wiki: data.wiki_enabled ?? false,
    has_pages: false,
    license: data.license?.key ? { spdx_id: data.license.key } : null,
    open_issues_count: data.open_issues_count ?? 0,
    archived: data.archived ?? false,
    description: data.description ?? null,
    stargazers_count: data.star_count ?? 0,
  };
}

export async function fetchGitLabTree(
  apiBase: string,
  slug: string,
  branch: string
): Promise<RepoTree> {
  const encoded = encodeURIComponent(slug);
  const allEntries: Array<{ path: string; type: string }> = [];
  let page = 1;
  const maxPages = 20; // cap at 2000 files

  while (page <= maxPages) {
    const url =
      `${apiBase}/projects/${encoded}/repository/tree` +
      `?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100&page=${page}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!resp.ok) break;

    const items = (await resp.json()) as GitLabTreeEntry[];
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      allEntries.push({
        path: item.path,
        type: item.type === "blob" ? "blob" : "tree",
      });
    }
    page++;
  }

  return { tree: allEntries };
}

/**
 * Fetch raw file content from GitLab.
 * Returns null if the file doesn't exist or fetch fails.
 */
export async function fetchGitLabFileContent(
  apiBase: string,
  slug: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  const encoded = encodeURIComponent(slug);
  const encodedPath = encodeURIComponent(filePath);
  try {
    const resp = await fetch(
      `${apiBase}/projects/${encoded}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(branch)}`,
      { signal: AbortSignal.timeout(API_TIMEOUT_MS) }
    );
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// ── Codeberg / Gitea API ────────────────────────────────────────────────

interface CodebergRepo {
  default_branch?: string;
  language?: string;
  has_issues?: boolean;
  has_wiki?: boolean;
  archived?: boolean;
  description?: string;
  stars_count?: number;
  open_issues_count?: number;
}

interface GiteaTreeEntry {
  path: string;
  type: string; // "blob" | "tree"
}

interface GiteaTreeResponse {
  tree?: GiteaTreeEntry[];
}

export async function fetchCodebergMeta(
  apiBase: string,
  slug: string
): Promise<RepoMeta> {
  const resp = await fetch(`${apiBase}/repos/${slug}`, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`Codeberg API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as CodebergRepo;
  return {
    default_branch: data.default_branch ?? "main",
    language: data.language ?? null,
    has_issues: data.has_issues ?? true,
    has_wiki: data.has_wiki ?? false,
    has_pages: false,
    license: null, // Gitea API returns license in a different structure
    open_issues_count: data.open_issues_count ?? 0,
    archived: data.archived ?? false,
    description: data.description ?? null,
    stargazers_count: data.stars_count ?? 0,
  };
}

export async function fetchCodebergTree(
  apiBase: string,
  slug: string,
  branch: string
): Promise<RepoTree> {
  const resp = await fetch(
    `${apiBase}/repos/${slug}/git/trees/${encodeURIComponent(branch)}?recursive=true`,
    { signal: AbortSignal.timeout(API_TIMEOUT_MS) }
  );
  if (!resp.ok) {
    throw new Error(`Codeberg tree API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as GiteaTreeResponse;
  return {
    tree: (data.tree ?? []).map((e) => ({ path: e.path, type: e.type })),
  };
}

/**
 * Fetch raw file content from Codeberg/Gitea.
 * Returns null if the file doesn't exist or fetch fails.
 */
export async function fetchCodebergFileContent(
  apiBase: string,
  slug: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  try {
    const resp = await fetch(
      `${apiBase}/repos/${slug}/raw/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`,
      { signal: AbortSignal.timeout(API_TIMEOUT_MS) }
    );
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}
