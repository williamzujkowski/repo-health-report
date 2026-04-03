import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeTreeAnalytics } from "../dist/tree-analytics.js";

/** Helper to build a RepoTree from a list of path strings (all blobs by default). */
function makeTree(entries) {
  return {
    tree: entries.map((e) => {
      if (typeof e === "string") return { path: e, type: "blob" };
      return e; // { path, type } object
    }),
  };
}

describe("computeTreeAnalytics", () => {
  it("handles an empty tree", () => {
    const result = computeTreeAnalytics({ tree: [] });
    assert.equal(result.fileCount, 0);
    assert.equal(result.directoryCount, 0);
    assert.equal(result.maxDepth, 0);
    assert.equal(result.testFileCount, 0);
    assert.equal(result.sourceFileCount, 0);
    assert.equal(result.testToSourceRatio, 0);
    assert.equal(result.markdownFileCount, 0);
    assert.equal(result.docFileCount, 0);
    assert.equal(result.dependencyFileCount, 0);
    assert.equal(result.isMonorepo, false);
    assert.equal(result.hasLockfile, false);
    assert.equal(result.lockfileCount, 0);
    assert.equal(result.manifestCount, 0);
    assert.equal(result.estimatedDependencyCount, 0);
    assert.equal(result.configScore, 0);
    assert.equal(result.antiPatternCount, 0);
    assert.equal(result.sizeCategory, "tiny");
  });

  it("computes metrics for a simple repo", () => {
    const tree = makeTree([
      { path: "src", type: "tree" },
      "src/index.ts",
      "src/utils.ts",
      "src/api.ts",
      "src/models.ts",
      "src/routes.ts",
      "tests/index.test.ts",
      "tests/utils.test.ts",
      "package.json",
      "README.md",
      "tsconfig.json",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.fileCount, 10);
    assert.equal(result.directoryCount, 1); // "src" tree entry
    assert.equal(result.sourceFileCount, 5); // 5 .ts files in src/
    assert.equal(result.testFileCount, 2); // 2 .test.ts files in tests/
    assert.equal(result.testToSourceRatio, 0.4); // 2/5
    assert.equal(result.markdownFileCount, 1); // README.md
    assert.equal(result.dependencyFileCount, 1); // package.json
    assert.deepEqual(result.dependencyFiles, ["package.json"]);
    assert.equal(result.isMonorepo, false);
    assert.equal(result.configScore, 1); // tsconfig.json
    assert.equal(result.antiPatternCount, 0);
    assert.equal(result.sizeCategory, "small"); // 10 files
  });

  it("detects monorepo with multiple package.json files", () => {
    const tree = makeTree([
      "package.json",
      "packages/core/package.json",
      "packages/cli/package.json",
      "packages/core/src/index.ts",
      "packages/cli/src/index.ts",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.dependencyFileCount, 3);
    assert.equal(result.isMonorepo, true); // 3 different dirs: ".", "packages/core", "packages/cli"
  });

  it("does not detect monorepo with only two dep file locations", () => {
    const tree = makeTree([
      "package.json",
      "packages/core/package.json",
      "src/index.ts",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.dependencyFileCount, 2);
    assert.equal(result.isMonorepo, false); // only 2 dirs
  });

  it("detects anti-patterns: vendor committed", () => {
    const tree = makeTree([
      "src/main.go",
      "vendor/github.com/lib/pq/pq.go",
      "go.mod",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasVendorCommitted, true);
    assert.equal(result.antiPatternCount, 1);
  });

  it("detects anti-patterns: node_modules committed", () => {
    const tree = makeTree([
      "index.js",
      "node_modules/lodash/lodash.js",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasVendorCommitted, true);
    assert.equal(result.antiPatternCount, 1);
  });

  it("detects anti-patterns: .env committed", () => {
    const tree = makeTree([
      "src/app.py",
      ".env",
      ".env.example",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasDotEnvCommitted, true);
    assert.equal(result.antiPatternCount, 1);
    // .env.example should NOT trigger the anti-pattern
  });

  it("detects anti-patterns: minified files", () => {
    const tree = makeTree([
      "src/app.js",
      "assets/bundle.min.js",
      "assets/style.min.css",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasMinifiedFiles, true);
    assert.equal(result.antiPatternCount, 1);
  });

  it("detects anti-patterns: dist committed", () => {
    const tree = makeTree([
      "src/index.ts",
      "dist/index.js",
      "dist/styles.css",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasDistCommitted, true);
    assert.equal(result.antiPatternCount, 1);
  });

  it("counts all anti-patterns combined", () => {
    const tree = makeTree([
      "src/index.ts",
      ".env",
      "vendor/lib.go",
      "dist/bundle.js",
      "assets/app.min.js",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasDotEnvCommitted, true);
    assert.equal(result.hasVendorCommitted, true);
    assert.equal(result.hasDistCommitted, true);
    assert.equal(result.hasMinifiedFiles, true);
    assert.equal(result.antiPatternCount, 4);
  });

  it("classifies size: tiny (<10 files)", () => {
    const tree = makeTree(["README.md", "main.py"]);
    assert.equal(computeTreeAnalytics(tree).sizeCategory, "tiny");
  });

  it("classifies size: small (10-49 files)", () => {
    const entries = Array.from({ length: 10 }, (_, i) => `src/file${i}.ts`);
    assert.equal(computeTreeAnalytics(makeTree(entries)).sizeCategory, "small");
  });

  it("classifies size: medium (50-499 files)", () => {
    const entries = Array.from({ length: 50 }, (_, i) => `src/file${i}.ts`);
    assert.equal(computeTreeAnalytics(makeTree(entries)).sizeCategory, "medium");
  });

  it("classifies size: large (500-4999 files)", () => {
    const entries = Array.from({ length: 500 }, (_, i) => `src/file${i}.ts`);
    assert.equal(computeTreeAnalytics(makeTree(entries)).sizeCategory, "large");
  });

  it("classifies size: massive (5000+ files)", () => {
    const entries = Array.from({ length: 5000 }, (_, i) => `src/file${i}.ts`);
    assert.equal(computeTreeAnalytics(makeTree(entries)).sizeCategory, "massive");
  });

  it("counts markdown and doc files correctly", () => {
    const tree = makeTree([
      "README.md",
      "CONTRIBUTING.md",
      "docs/guide.md",
      "docs/api.rst",
      "docs/notes.txt",
      "doc/setup.md",
    ]);

    const result = computeTreeAnalytics(tree);

    // .md and .rst count as markdown files
    assert.equal(result.markdownFileCount, 5); // README, CONTRIBUTING, docs/guide, docs/api, doc/setup
    // docFileCount = files in docs/ or doc/ (.md, .rst, .txt)
    assert.equal(result.docFileCount, 4); // docs/guide.md, docs/api.rst, docs/notes.txt, doc/setup.md
  });

  it("detects test files with various patterns", () => {
    const tree = makeTree([
      "src/app.ts",
      "src/app.test.ts",
      "src/app.spec.ts",
      "tests/integration.ts",
      "__tests__/unit.ts",
      "spec/helper.rb",
      "test_utils.py",
      "pkg/handler_test.go",
    ]);

    const result = computeTreeAnalytics(tree);

    // test patterns: .test.ts, .spec.ts, tests/, __tests__/, spec/, test_*.py, _test.go
    assert.equal(result.testFileCount, 7);
    assert.equal(result.sourceFileCount, 1); // only src/app.ts (non-test source)
  });

  it("computes config score from unique config types", () => {
    const tree = makeTree([
      "Makefile",
      "Dockerfile",
      "docker-compose.yml",
      ".editorconfig",
      "tsconfig.json",
      ".prettierrc",
      "eslint.config.js",
      "vitest.config.ts",
      "renovate.json",
      ".pre-commit-config.yaml",
      // duplicate type in subdirectory should not add to score
      "packages/core/tsconfig.json",
    ]);

    const result = computeTreeAnalytics(tree);

    // 10 unique config file names (tsconfig.json counted once)
    assert.equal(result.configScore, 10);
  });

  it("computes maxDepth correctly", () => {
    const tree = makeTree([
      "README.md",                          // depth 1
      "src/index.ts",                       // depth 2
      "src/utils/helper.ts",                // depth 3
      "src/utils/deep/nested/file.ts",      // depth 5
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.maxDepth, 5); // "src/utils/deep/nested/file.ts".split("/").length
  });

  it("computes avgFilesPerDir", () => {
    const tree = makeTree([
      "README.md",           // dir: "."
      "src/a.ts",            // dir: "src"
      "src/b.ts",            // dir: "src"
      "lib/c.js",            // dir: "lib"
    ]);

    const result = computeTreeAnalytics(tree);

    // 4 files, 3 dirs (., src, lib) => avgFilesPerDir = round(4/3) = 1
    assert.equal(result.avgFilesPerDir, 1);
  });

  // ── Supply chain: lockfile and manifest detection ──────────────────────

  it("detects lockfiles and manifests separately", () => {
    const tree = makeTree([
      "package.json",         // manifest
      "package-lock.json",    // lockfile
      "src/index.ts",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasLockfile, true);
    assert.equal(result.lockfileCount, 1);
    assert.equal(result.manifestCount, 1);
    assert.equal(result.dependencyFileCount, 2);
    assert.equal(result.estimatedDependencyCount, 25); // 1 manifest * 25
  });

  it("detects multiple lockfiles across ecosystems", () => {
    const tree = makeTree([
      "package.json",
      "yarn.lock",
      "go.mod",
      "go.sum",
      "Cargo.toml",
      "Cargo.lock",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasLockfile, true);
    assert.equal(result.lockfileCount, 3); // yarn.lock, go.sum, Cargo.lock
    assert.equal(result.manifestCount, 3); // package.json, go.mod, Cargo.toml
    assert.equal(result.estimatedDependencyCount, 75); // 3 * 25
  });

  it("reports no lockfile when only manifests present", () => {
    const tree = makeTree([
      "requirements.txt",
      "setup.py",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasLockfile, false);
    assert.equal(result.lockfileCount, 0);
    assert.equal(result.manifestCount, 2);
  });

  it("detects Python lockfiles", () => {
    const tree = makeTree([
      "Pipfile",
      "Pipfile.lock",
      "pyproject.toml",
      "poetry.lock",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.hasLockfile, true);
    assert.equal(result.lockfileCount, 2); // Pipfile.lock, poetry.lock
    assert.equal(result.manifestCount, 2); // Pipfile, pyproject.toml
  });

  it("handles monorepo with multiple lockfiles", () => {
    const tree = makeTree([
      "package.json",
      "package-lock.json",
      "packages/core/package.json",
      "packages/cli/package.json",
    ]);

    const result = computeTreeAnalytics(tree);

    assert.equal(result.lockfileCount, 1);
    assert.equal(result.manifestCount, 3); // all three package.json
    assert.equal(result.isMonorepo, true);
  });
});
