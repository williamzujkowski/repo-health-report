import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { detectAllLanguages } = await import("../dist/analyze.js");

/**
 * Helper: build a minimal RepoTree from a list of file paths.
 */
function makeTree(paths) {
  return {
    tree: paths.map((path) => ({ path, type: "blob" })),
  };
}

describe("detectAllLanguages", () => {
  it("returns single language for Go-only repo", () => {
    const tree = makeTree([
      "main.go",
      "pkg/server.go",
      "pkg/handler.go",
      "go.mod",
      "go.sum",
    ]);
    const result = detectAllLanguages(tree, "Go");

    assert.equal(result.primary, "go");
    assert.equal(result.all.length, 1);
    assert.equal(result.all[0].language, "go");
    assert.equal(result.all[0].fileCount, 3);
    assert.equal(result.all[0].percentage, 100);
  });

  it("returns multiple languages sorted by file count", () => {
    const tree = makeTree([
      // 5 Go files
      "main.go",
      "cmd/server.go",
      "pkg/handler.go",
      "pkg/router.go",
      "internal/db.go",
      // 3 Shell files
      "scripts/build.sh",
      "scripts/deploy.sh",
      "scripts/test.sh",
      // 2 Python files
      "tools/lint.py",
      "tools/gen.py",
    ]);
    const result = detectAllLanguages(tree, "Go");

    assert.equal(result.primary, "go");
    assert.equal(result.all.length, 3);

    // Sorted by count: Go(5), Shell(3), Python(2)
    assert.equal(result.all[0].language, "go");
    assert.equal(result.all[0].fileCount, 5);
    assert.equal(result.all[0].percentage, 50);

    assert.equal(result.all[1].language, "shell");
    assert.equal(result.all[1].fileCount, 3);
    assert.equal(result.all[1].percentage, 30);

    assert.equal(result.all[2].language, "python");
    assert.equal(result.all[2].fileCount, 2);
    assert.equal(result.all[2].percentage, 20);
  });

  it("returns empty all array for tree with no source files", () => {
    const tree = makeTree([
      "README.md",
      "LICENSE",
      "docs/guide.md",
    ]);
    const result = detectAllLanguages(tree, null);

    assert.equal(result.primary, "other");
    assert.equal(result.all.length, 0);
  });

  it("groups TypeScript ts and tsx together", () => {
    const tree = makeTree([
      "src/index.ts",
      "src/app.tsx",
      "src/utils.ts",
    ]);
    const result = detectAllLanguages(tree, "TypeScript");

    assert.equal(result.primary, "typescript");
    assert.equal(result.all.length, 1);
    assert.equal(result.all[0].language, "typescript");
    assert.equal(result.all[0].fileCount, 3);
  });

  it("groups JavaScript js, jsx, and mjs together", () => {
    const tree = makeTree([
      "src/index.js",
      "src/component.jsx",
      "src/utils.mjs",
    ]);
    const result = detectAllLanguages(tree, "JavaScript");

    assert.equal(result.all.length, 1);
    assert.equal(result.all[0].language, "javascript");
    assert.equal(result.all[0].fileCount, 3);
  });

  it("uses GitHub language for primary when tree disagrees", () => {
    // GitHub says TypeScript but more Python files in tree
    const tree = makeTree([
      "src/index.ts",
      "scripts/a.py",
      "scripts/b.py",
      "scripts/c.py",
    ]);
    const result = detectAllLanguages(tree, "TypeScript");

    // Primary comes from GitHub
    assert.equal(result.primary, "typescript");
    // But all[] reflects actual file counts: Python(3), TypeScript(1)
    assert.equal(result.all[0].language, "python");
    assert.equal(result.all[0].fileCount, 3);
    assert.equal(result.all[1].language, "typescript");
    assert.equal(result.all[1].fileCount, 1);
  });

  it("handles C/C++ grouping with .c, .cpp, .h, .hpp", () => {
    const tree = makeTree([
      "src/main.c",
      "src/utils.cpp",
      "include/utils.h",
      "include/types.hpp",
    ]);
    const result = detectAllLanguages(tree, "C");

    assert.equal(result.all.length, 1);
    assert.equal(result.all[0].language, "c");
    assert.equal(result.all[0].fileCount, 4);
  });

  it("ignores non-blob entries (directories)", () => {
    const tree = {
      tree: [
        { path: "src", type: "tree" },
        { path: "src/main.go", type: "blob" },
      ],
    };
    const result = detectAllLanguages(tree, "Go");

    assert.equal(result.all.length, 1);
    assert.equal(result.all[0].fileCount, 1);
  });

  it("percentages sum to approximately 100", () => {
    const tree = makeTree([
      "a.go", "b.go", "c.go",
      "x.py", "y.py",
      "z.rs",
    ]);
    const result = detectAllLanguages(tree, null);

    const totalPct = result.all.reduce((sum, e) => sum + e.percentage, 0);
    // Due to rounding, allow 98-102
    assert.ok(totalPct >= 98 && totalPct <= 102, `Total percentage ${totalPct} not near 100`);
  });
});
