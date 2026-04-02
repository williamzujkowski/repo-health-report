import {
  type RepoTree,
  type RepoMeta,
  treeHasFile,
  treeHasPattern,
} from "../analyze.js";
import type { DimensionResult, Finding } from "./security.js";

export async function analyzeArchitectureDimension(
  tree: RepoTree,
  meta: RepoMeta,
  _slug: string
): Promise<DimensionResult> {
  const start = performance.now();
  const findings: Finding[] = [];

  // Type safety: TypeScript, typed language, or type annotations
  const hasTypeScript =
    treeHasFile(tree, "tsconfig.json") ||
    treeHasPattern(tree, /\.tsx?$/);
  const hasTypes =
    hasTypeScript ||
    treeHasFile(tree, "mypy.ini") ||
    treeHasFile(tree, "pyrightconfig.json") ||
    treeHasPattern(tree, /\.rs$/) ||
    treeHasPattern(tree, /\.go$/) ||
    treeHasPattern(tree, /\.java$/);
  findings.push({
    name: "Type safety",
    passed: hasTypes,
    detail: hasTypes
      ? `Typed language/config detected${hasTypeScript ? " (TypeScript)" : ""}`
      : "No type checking config found (consider TypeScript, mypy, etc.)",
    weight: 20,
  });

  // Linting config
  const hasLint =
    treeHasFile(tree, ".eslintrc.js") ||
    treeHasFile(tree, ".eslintrc.json") ||
    treeHasFile(tree, ".eslintrc.yml") ||
    treeHasFile(tree, "eslint.config.js") ||
    treeHasFile(tree, "eslint.config.mjs") ||
    treeHasFile(tree, ".flake8") ||
    treeHasFile(tree, "ruff.toml") ||
    treeHasFile(tree, ".golangci.yml") ||
    treeHasFile(tree, "clippy.toml") ||
    treeHasFile(tree, "biome.json");
  findings.push({
    name: "Linter configuration",
    passed: hasLint,
    detail: hasLint
      ? "Linting config found"
      : "No linter config — code quality may vary",
    weight: 20,
  });

  // Formatting config
  const hasFormatter =
    treeHasFile(tree, ".prettierrc") ||
    treeHasFile(tree, ".prettierrc.json") ||
    treeHasFile(tree, ".prettierrc.js") ||
    treeHasFile(tree, "prettier.config.js") ||
    treeHasFile(tree, "prettier.config.mjs") ||
    treeHasFile(tree, ".editorconfig") ||
    treeHasFile(tree, "biome.json") ||
    treeHasFile(tree, "rustfmt.toml") ||
    treeHasFile(tree, "pyproject.toml"); // black/ruff format
  findings.push({
    name: "Code formatter",
    passed: hasFormatter,
    detail: hasFormatter
      ? "Formatter config found"
      : "No formatter config — inconsistent style is likely",
    weight: 15,
  });

  // Clear source structure
  const hasSrcDir = treeHasPattern(tree, /^src\//);
  const hasLibDir = treeHasPattern(tree, /^lib\//);
  const hasPkgDir = treeHasPattern(tree, /^packages\//);
  const hasStructure = hasSrcDir || hasLibDir || hasPkgDir;
  findings.push({
    name: "Organized source structure",
    passed: hasStructure,
    detail: hasStructure
      ? `Source directory found (${hasSrcDir ? "src/" : hasLibDir ? "lib/" : "packages/"})`
      : "No clear source directory (src/, lib/, or packages/)",
    weight: 20,
  });

  // Monorepo tooling (if applicable)
  const hasMonorepo =
    treeHasFile(tree, "lerna.json") ||
    treeHasFile(tree, "nx.json") ||
    treeHasFile(tree, "turbo.json") ||
    treeHasFile(tree, "pnpm-workspace.yaml");
  const hasMultiplePackages = treeHasPattern(tree, /^packages\//);
  // Only penalize if it looks like a monorepo without tooling
  if (hasMultiplePackages) {
    findings.push({
      name: "Monorepo tooling",
      passed: hasMonorepo,
      detail: hasMonorepo
        ? "Monorepo tooling configured"
        : "packages/ directory found but no monorepo tool (lerna, nx, turbo)",
      weight: 15,
    });
  }

  // Config file for build
  const hasBuildConfig =
    treeHasFile(tree, "tsconfig.json") ||
    treeHasFile(tree, "webpack.config.js") ||
    treeHasFile(tree, "vite.config.ts") ||
    treeHasFile(tree, "rollup.config.js") ||
    treeHasFile(tree, "Makefile") ||
    treeHasFile(tree, "CMakeLists.txt") ||
    treeHasFile(tree, "build.gradle") ||
    treeHasFile(tree, "Cargo.toml") ||
    treeHasFile(tree, "go.mod");
  findings.push({
    name: "Build configuration",
    passed: hasBuildConfig,
    detail: hasBuildConfig
      ? "Build config found"
      : "No build configuration detected",
    weight: 10,
  });

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const earnedWeight = findings
    .filter((f) => f.passed)
    .reduce((sum, f) => sum + f.weight, 0);
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  return {
    name: "Architecture",
    score,
    findings,
    durationMs: performance.now() - start,
  };
}
