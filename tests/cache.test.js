import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RepoCache } from "../dist/cache.js";

const TEST_CACHE_DIR = join(process.cwd(), "data", "cache");

describe("RepoCache", () => {
  beforeEach(async () => {
    // Ensure clean state — remove cache files if present
    try {
      await rm(join(TEST_CACHE_DIR, "doc-repos.json"), { force: true });
      await rm(join(TEST_CACHE_DIR, "repo-meta.json"), { force: true });
    } catch {
      /* ignore */
    }
  });

  afterEach(async () => {
    try {
      await rm(join(TEST_CACHE_DIR, "doc-repos.json"), { force: true });
      await rm(join(TEST_CACHE_DIR, "repo-meta.json"), { force: true });
    } catch {
      /* ignore */
    }
  });

  it("loads with empty state when no cache files exist", async () => {
    const cache = new RepoCache();
    await cache.load();
    assert.equal(cache.docRepoCount, 0);
    assert.equal(cache.metaCacheCount, 0);
  });

  it("round-trips doc repos through save/load", async () => {
    const cache = new RepoCache();
    await cache.load();
    cache.addDocRepo("owner/awesome-list");
    cache.addDocRepo("owner/docs-only");
    await cache.save();

    const cache2 = new RepoCache();
    await cache2.load();
    assert.equal(cache2.isDocRepo("owner/awesome-list"), true);
    assert.equal(cache2.isDocRepo("owner/docs-only"), true);
    assert.equal(cache2.isDocRepo("owner/real-project"), false);
    assert.equal(cache2.docRepoCount, 2);
  });

  it("round-trips metadata entries through save/load", async () => {
    const cache = new RepoCache();
    await cache.load();
    cache.setMeta("owner/repo", {
      pushedAt: "2026-01-01T00:00:00Z",
      analyzedAt: "2026-01-02T00:00:00Z",
      projectType: "application",
      score: 85,
    });
    await cache.save();

    const cache2 = new RepoCache();
    await cache2.load();
    const entry = cache2.getMeta("owner/repo");
    assert.ok(entry);
    assert.equal(entry.pushedAt, "2026-01-01T00:00:00Z");
    assert.equal(entry.analyzedAt, "2026-01-02T00:00:00Z");
    assert.equal(entry.projectType, "application");
    assert.equal(entry.score, 85);
    assert.equal(cache2.metaCacheCount, 1);
  });

  it("needsReanalysis returns true for unknown repos", () => {
    const cache = new RepoCache();
    assert.equal(cache.needsReanalysis("owner/new", "2026-01-01T00:00:00Z"), true);
  });

  it("needsReanalysis returns true when pushedAt is undefined", () => {
    const cache = new RepoCache();
    cache.setMeta("owner/repo", {
      pushedAt: "2026-01-01T00:00:00Z",
      analyzedAt: "2026-01-02T00:00:00Z",
      projectType: "application",
      score: 85,
    });
    assert.equal(cache.needsReanalysis("owner/repo", undefined), true);
  });

  it("needsReanalysis returns false when pushedAt matches", () => {
    const cache = new RepoCache();
    cache.setMeta("owner/repo", {
      pushedAt: "2026-01-01T00:00:00Z",
      analyzedAt: "2026-01-02T00:00:00Z",
      projectType: "application",
      score: 85,
    });
    assert.equal(cache.needsReanalysis("owner/repo", "2026-01-01T00:00:00Z"), false);
  });

  it("needsReanalysis returns true when pushedAt changed", () => {
    const cache = new RepoCache();
    cache.setMeta("owner/repo", {
      pushedAt: "2026-01-01T00:00:00Z",
      analyzedAt: "2026-01-02T00:00:00Z",
      projectType: "application",
      score: 85,
    });
    assert.equal(cache.needsReanalysis("owner/repo", "2026-03-15T00:00:00Z"), true);
  });

  it("isDocRepo returns false for non-doc repos", () => {
    const cache = new RepoCache();
    assert.equal(cache.isDocRepo("owner/real-project"), false);
  });

  it("deduplicates doc repos", () => {
    const cache = new RepoCache();
    cache.addDocRepo("owner/docs");
    cache.addDocRepo("owner/docs");
    assert.equal(cache.docRepoCount, 1);
  });
});
