/**
 * File-based cache for batch analysis.
 *
 * Tracks:
 * 1. Documentation repos — skip list for repos identified as documentation/mirror type
 * 2. Repo metadata — pushed_at timestamps for incremental change detection
 *
 * Cache files live in data/cache/ (gitignored).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), "data", "cache");
const DOC_SKIP_PATH = join(CACHE_DIR, "doc-repos.json");
const META_CACHE_PATH = join(CACHE_DIR, "repo-meta.json");

export interface MetaCacheEntry {
  pushedAt: string;      // last pushed_at from GitHub
  analyzedAt: string;    // when we last analyzed it
  projectType: string;   // cached project type
  score: number;         // cached score
}

export class RepoCache {
  private docRepos: Set<string> = new Set();
  private metaCache: Map<string, MetaCacheEntry> = new Map();

  async load(): Promise<void> {
    try {
      const docData = await readFile(DOC_SKIP_PATH, "utf-8");
      this.docRepos = new Set(JSON.parse(docData) as string[]);
    } catch {
      /* no cache yet */
    }
    try {
      const metaData = await readFile(META_CACHE_PATH, "utf-8");
      const entries = JSON.parse(metaData) as Record<string, MetaCacheEntry>;
      this.metaCache = new Map(Object.entries(entries));
    } catch {
      /* no cache yet */
    }
  }

  async save(): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(DOC_SKIP_PATH, JSON.stringify([...this.docRepos], null, 2));
    const metaObj = Object.fromEntries(this.metaCache);
    await writeFile(META_CACHE_PATH, JSON.stringify(metaObj, null, 2));
  }

  isDocRepo(slug: string): boolean {
    return this.docRepos.has(slug);
  }

  addDocRepo(slug: string): void {
    this.docRepos.add(slug);
  }

  getMeta(slug: string): MetaCacheEntry | undefined {
    return this.metaCache.get(slug);
  }

  setMeta(slug: string, entry: MetaCacheEntry): void {
    this.metaCache.set(slug, entry);
  }

  /**
   * Check if repo needs re-analysis.
   * Returns true when: never analyzed, pushed_at unknown, or pushed_at changed.
   */
  needsReanalysis(slug: string, currentPushedAt: string | undefined): boolean {
    const cached = this.metaCache.get(slug);
    if (!cached) return true;
    if (!currentPushedAt) return true;
    return cached.pushedAt !== currentPushedAt;
  }

  /** Number of repos in the doc skip list. */
  get docRepoCount(): number {
    return this.docRepos.size;
  }

  /** Number of repos in the metadata cache. */
  get metaCacheCount(): number {
    return this.metaCache.size;
  }
}
