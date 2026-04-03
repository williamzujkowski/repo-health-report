import type { RepoTree } from "./analyze.js";

export interface TreeAnalytics {
  // Complexity
  fileCount: number;
  directoryCount: number;
  maxDepth: number;
  avgFilesPerDir: number;

  // Testing
  testFileCount: number;
  sourceFileCount: number;
  testToSourceRatio: number; // 0.0 - 1.0+

  // Documentation
  markdownFileCount: number;
  docFileCount: number; // .md + .rst + .txt in docs/

  // Dependencies
  dependencyFiles: string[];
  dependencyFileCount: number;
  isMonorepo: boolean; // multiple package.json or go.mod at different paths

  // Config maturity
  configFiles: string[];
  configScore: number; // 0-10 based on how many operational configs exist

  // Anti-patterns
  hasVendorCommitted: boolean; // vendor/ or node_modules/ in tree
  hasDistCommitted: boolean; // dist/ or build/ with .js files in tree
  hasMinifiedFiles: boolean; // .min.js or .min.css
  hasDotEnvCommitted: boolean; // .env (not .env.example)
  antiPatternCount: number;

  // Size classification
  sizeCategory: "tiny" | "small" | "medium" | "large" | "massive";
}

// Dependency file names to detect
const DEP_FILES = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "go.mod",
  "go.sum",
  "requirements.txt",
  "Pipfile",
  "Pipfile.lock",
  "pyproject.toml",
  "setup.py",
  "poetry.lock",
  "uv.lock",
  "Cargo.toml",
  "Cargo.lock",
  "Gemfile",
  "Gemfile.lock",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "composer.lock",
  "mix.exs",
]);

// Config files that indicate operational maturity
const CONFIG_FILES = new Set([
  "Makefile",
  "Taskfile.yml",
  "Taskfile.yaml",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".editorconfig",
  ".prettierrc",
  ".prettierrc.json",
  ".eslintrc.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "biome.json",
  ".rubocop.yml",
  "tsconfig.json",
  "jsconfig.json",
  "jest.config.js",
  "vitest.config.ts",
  "pytest.ini",
  "tox.ini",
  ".pre-commit-config.yaml",
  ".husky",
  "renovate.json",
  ".renovaterc",
]);

// Source file extensions
const SOURCE_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "py",
  "go",
  "rs",
  "java",
  "kt",
  "rb",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "swift",
  "sh",
  "bash",
]);

// Test file patterns
const TEST_PATTERNS = [
  /[._]test\.[a-z]+$/,
  /[._]spec\.[a-z]+$/,
  /_test\.go$/,
  /^tests?\//,
  /^__tests__\//,
  /^spec\//,
  /test_[a-z].*\.py$/,
];

// CI config patterns (checked by directory prefix)
const CI_DIR_PREFIXES = [
  ".github/workflows/",
  ".circleci/",
  ".gitlab-ci",
  "Jenkinsfile",
];

export function computeTreeAnalytics(tree: RepoTree): TreeAnalytics {
  let fileCount = 0;
  let directoryCount = 0;
  let testFileCount = 0;
  let sourceFileCount = 0;
  let markdownFileCount = 0;
  let docFileCount = 0;
  let maxDepth = 0;

  const dirFileCounts = new Map<string, number>();
  const dependencyFiles: string[] = [];
  const configFiles: string[] = [];
  let hasVendorCommitted = false;
  let hasDistCommitted = false;
  let hasMinifiedFiles = false;
  let hasDotEnvCommitted = false;

  for (const entry of tree.tree) {
    const depth = entry.path.split("/").length;
    if (depth > maxDepth) maxDepth = depth;

    if (entry.type === "tree") {
      directoryCount++;
      continue;
    }

    // It's a blob (file)
    fileCount++;
    const filename = entry.path.split("/").pop() ?? "";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const dir = entry.path.includes("/")
      ? entry.path.substring(0, entry.path.lastIndexOf("/"))
      : ".";

    // Dir file counts
    dirFileCounts.set(dir, (dirFileCounts.get(dir) ?? 0) + 1);

    // Source vs test
    const isTest = TEST_PATTERNS.some((p) => p.test(entry.path));
    if (isTest) {
      testFileCount++;
    } else if (SOURCE_EXTS.has(ext)) {
      sourceFileCount++;
    }

    // Documentation
    if (ext === "md" || ext === "rst") {
      markdownFileCount++;
      if (entry.path.startsWith("docs/") || entry.path.startsWith("doc/")) {
        docFileCount++;
      }
    }
    // Also count .txt files inside docs/ directories
    if (
      ext === "txt" &&
      (entry.path.startsWith("docs/") || entry.path.startsWith("doc/"))
    ) {
      docFileCount++;
    }

    // Dependency files
    if (DEP_FILES.has(filename)) {
      dependencyFiles.push(entry.path);
    }

    // Config files (exact name match or CI directory patterns)
    if (CONFIG_FILES.has(filename)) {
      configFiles.push(entry.path);
    } else if (
      CI_DIR_PREFIXES.some((prefix) => entry.path.startsWith(prefix))
    ) {
      configFiles.push(entry.path);
    }

    // Anti-patterns
    if (
      entry.path.startsWith("vendor/") ||
      entry.path.startsWith("node_modules/")
    ) {
      hasVendorCommitted = true;
    }
    if (
      (entry.path.startsWith("dist/") || entry.path.startsWith("build/")) &&
      (ext === "js" || ext === "css")
    ) {
      hasDistCommitted = true;
    }
    if (filename.includes(".min.js") || filename.includes(".min.css")) {
      hasMinifiedFiles = true;
    }
    if (filename === ".env") {
      hasDotEnvCommitted = true;
    }
  }

  // Compute derived metrics
  const avgFilesPerDir =
    dirFileCounts.size > 0
      ? Math.round(fileCount / dirFileCounts.size)
      : fileCount;

  const testToSourceRatio =
    sourceFileCount > 0
      ? Math.round((testFileCount / sourceFileCount) * 100) / 100
      : 0;

  // Monorepo detection: multiple package.json/go.mod at different directory levels
  const depDirs = new Set(
    dependencyFiles.map((f) =>
      f.includes("/") ? f.substring(0, f.lastIndexOf("/")) : "."
    )
  );
  const isMonorepo = depDirs.size > 2;

  // Config maturity score (0-10)
  const uniqueConfigTypes = new Set(
    configFiles.map((f) => f.split("/").pop() ?? "")
  );
  const configScore = Math.min(10, uniqueConfigTypes.size);

  // Anti-pattern count
  const antiPatternCount = [
    hasVendorCommitted,
    hasDistCommitted,
    hasMinifiedFiles,
    hasDotEnvCommitted,
  ].filter(Boolean).length;

  // Size classification
  let sizeCategory: TreeAnalytics["sizeCategory"];
  if (fileCount < 10) sizeCategory = "tiny";
  else if (fileCount < 50) sizeCategory = "small";
  else if (fileCount < 500) sizeCategory = "medium";
  else if (fileCount < 5000) sizeCategory = "large";
  else sizeCategory = "massive";

  return {
    fileCount,
    directoryCount,
    maxDepth,
    avgFilesPerDir,
    testFileCount,
    sourceFileCount,
    testToSourceRatio,
    markdownFileCount,
    docFileCount,
    dependencyFiles,
    dependencyFileCount: dependencyFiles.length,
    isMonorepo,
    configFiles,
    configScore,
    hasVendorCommitted,
    hasDistCommitted,
    hasMinifiedFiles,
    hasDotEnvCommitted,
    antiPatternCount,
    sizeCategory,
  };
}
