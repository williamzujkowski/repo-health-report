import {
  type RepoTree,
  type RepoMeta,
  type ProjectType,
  type RepoLanguage,
  treeHasFile,
  treeHasPattern,
} from "../analyze.js";
import type { DimensionResult, Finding } from "./security.js";

function analyzeIacArchitecture(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  const hasTflint =
    treeHasFile(tree, ".tflint.hcl") ||
    treeHasPattern(tree, /\.tflint\.hcl$/);
  findings.push({
    name: "IaC linter (tflint)",
    passed: hasTflint,
    detail: hasTflint
      ? "tflint config found (.tflint.hcl)"
      : "No tflint config — consider adding .tflint.hcl for Terraform linting",
    weight: 20,
  });

  const hasTerraformFmt =
    treeHasPattern(tree, /terraform fmt/) ||
    treeHasFile(tree, ".pre-commit-config.yaml");
  findings.push({
    name: "Terraform formatting (terraform fmt)",
    passed: hasTerraformFmt,
    detail: hasTerraformFmt
      ? "terraform fmt enforcement found"
      : "No terraform fmt in CI or pre-commit — code style may drift",
    weight: 15,
  });

  const hasModulesDir = treeHasPattern(tree, /^modules\//);
  findings.push({
    name: "Module structure",
    passed: hasModulesDir,
    detail: hasModulesDir
      ? "modules/ directory found — good Terraform module organization"
      : "No modules/ directory — consider modularizing Terraform configs",
    weight: 20,
  });

  const hasVariablesTf = treeHasPattern(tree, /variables\.tf$/);
  const hasOutputsTf = treeHasPattern(tree, /outputs\.tf$/);
  const hasTfConventions = hasVariablesTf && hasOutputsTf;
  findings.push({
    name: "Terraform conventions (variables.tf / outputs.tf)",
    passed: hasTfConventions,
    detail: hasTfConventions
      ? "variables.tf and outputs.tf found"
      : `Missing: ${!hasVariablesTf ? "variables.tf " : ""}${!hasOutputsTf ? "outputs.tf" : ""}`.trim(),
    weight: 20,
  });

  const hasVersionPin =
    treeHasFile(tree, ".terraform-version") ||
    treeHasFile(tree, ".tool-versions");
  findings.push({
    name: "Terraform version pinning",
    passed: hasVersionPin,
    detail: hasVersionPin
      ? "Version pin found (.terraform-version or .tool-versions)"
      : "No version pin — consider .terraform-version or .tool-versions",
    weight: 15,
  });

  const hasMakefile = treeHasFile(tree, "Makefile");
  findings.push({
    name: "Build/task runner (Makefile)",
    passed: hasMakefile,
    detail: hasMakefile
      ? "Makefile found"
      : "No Makefile — consider adding common targets (init, plan, apply, fmt)",
    weight: 10,
  });

  return findings;
}

// ── Language-specific check functions ─────────────────────────────────

function checkTypescript(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  const hasTsConfig = treeHasFile(tree, "tsconfig.json");
  findings.push({
    name: "Type safety (tsconfig.json)",
    passed: hasTsConfig,
    detail: hasTsConfig ? "tsconfig.json found" : "No tsconfig.json — TypeScript project without type config",
    weight: 20,
  });

  const hasLint =
    treeHasFile(tree, "eslint.config.js") ||
    treeHasFile(tree, "eslint.config.mjs") ||
    treeHasFile(tree, ".eslintrc.js") ||
    treeHasFile(tree, ".eslintrc.json") ||
    treeHasFile(tree, ".eslintrc.yml") ||
    treeHasFile(tree, "biome.json");
  findings.push({
    name: "Linter (ESLint / Biome)",
    passed: hasLint,
    detail: hasLint ? "Linter config found" : "No ESLint or Biome config",
    weight: 20,
  });

  const hasFmt =
    treeHasFile(tree, ".prettierrc") ||
    treeHasFile(tree, ".prettierrc.json") ||
    treeHasFile(tree, ".prettierrc.js") ||
    treeHasFile(tree, "prettier.config.js") ||
    treeHasFile(tree, "prettier.config.mjs") ||
    treeHasFile(tree, "biome.json") ||
    treeHasFile(tree, ".editorconfig");
  findings.push({
    name: "Code formatter (Prettier / Biome)",
    passed: hasFmt,
    detail: hasFmt ? "Formatter config found" : "No formatter config",
    weight: 15,
  });

  const hasSrc = treeHasPattern(tree, /^src\//) || treeHasPattern(tree, /^packages\//);
  findings.push({
    name: "Organized source structure",
    passed: hasSrc,
    detail: hasSrc ? "src/ or packages/ directory found" : "No clear source structure",
    weight: 20,
  });

  const hasBuild =
    treeHasFile(tree, "tsconfig.json") ||
    treeHasFile(tree, "vite.config.ts") ||
    treeHasFile(tree, "webpack.config.js") ||
    treeHasFile(tree, "rollup.config.js") ||
    treeHasFile(tree, "turbo.json");
  findings.push({
    name: "Build configuration",
    passed: hasBuild,
    detail: hasBuild ? "Build config found" : "No build configuration",
    weight: 10,
  });

  return findings;
}

function checkJavascript(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // JS projects get credit for TS config OR JSDoc type checking
  const hasTypes =
    treeHasFile(tree, "tsconfig.json") ||
    treeHasFile(tree, "jsconfig.json");
  findings.push({
    name: "Type safety (tsconfig / jsconfig)",
    passed: hasTypes,
    detail: hasTypes ? "Type config found" : "No type checking config — consider jsconfig.json or TypeScript",
    weight: 20,
  });

  const hasLint =
    treeHasFile(tree, "eslint.config.js") ||
    treeHasFile(tree, "eslint.config.mjs") ||
    treeHasFile(tree, ".eslintrc.js") ||
    treeHasFile(tree, ".eslintrc.json") ||
    treeHasFile(tree, ".eslintrc.yml") ||
    treeHasFile(tree, "biome.json");
  findings.push({
    name: "Linter (ESLint / Biome)",
    passed: hasLint,
    detail: hasLint ? "Linter config found" : "No ESLint or Biome config",
    weight: 20,
  });

  const hasFmt =
    treeHasFile(tree, ".prettierrc") ||
    treeHasFile(tree, ".prettierrc.json") ||
    treeHasFile(tree, "prettier.config.js") ||
    treeHasFile(tree, "biome.json") ||
    treeHasFile(tree, ".editorconfig");
  findings.push({
    name: "Code formatter",
    passed: hasFmt,
    detail: hasFmt ? "Formatter config found" : "No formatter config",
    weight: 15,
  });

  const hasSrc = treeHasPattern(tree, /^src\//) || treeHasPattern(tree, /^lib\//) || treeHasPattern(tree, /^packages\//);
  findings.push({
    name: "Organized source structure",
    passed: hasSrc,
    detail: hasSrc ? "Source directory found" : "No clear source structure",
    weight: 20,
  });

  const hasBuild =
    treeHasFile(tree, "package.json") ||
    treeHasFile(tree, "webpack.config.js") ||
    treeHasFile(tree, "vite.config.js") ||
    treeHasFile(tree, "rollup.config.js");
  findings.push({
    name: "Build configuration",
    passed: hasBuild,
    detail: hasBuild ? "Build config found" : "No build configuration",
    weight: 10,
  });

  return findings;
}

function checkPython(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  const hasTypeChecker =
    treeHasFile(tree, "mypy.ini") ||
    treeHasFile(tree, "pyrightconfig.json") ||
    treeHasFile(tree, ".mypy.ini") ||
    treeHasPattern(tree, /\[tool\.mypy\]/); // pyproject.toml section (heuristic via tree)
  // Also check pyproject.toml existence as a proxy
  const hasPyproject = treeHasFile(tree, "pyproject.toml");
  findings.push({
    name: "Type checking (mypy / pyright)",
    passed: hasTypeChecker || hasPyproject,
    detail: hasTypeChecker
      ? "Type checker config found"
      : hasPyproject
        ? "pyproject.toml found (may contain [tool.mypy])"
        : "No mypy or pyright config — consider adding type checking",
    weight: 20,
  });

  const hasLint =
    treeHasFile(tree, "ruff.toml") ||
    treeHasFile(tree, ".flake8") ||
    treeHasFile(tree, ".pylintrc") ||
    treeHasFile(tree, "setup.cfg") ||
    hasPyproject; // ruff/flake8 config often in pyproject.toml
  findings.push({
    name: "Linter (ruff / flake8 / pylint)",
    passed: hasLint,
    detail: hasLint ? "Linter config found" : "No linter config",
    weight: 20,
  });

  const hasFmt =
    treeHasFile(tree, "ruff.toml") ||
    treeHasFile(tree, ".style.yapf") ||
    hasPyproject; // black/ruff-format often in pyproject.toml
  findings.push({
    name: "Code formatter (black / ruff / yapf)",
    passed: hasFmt,
    detail: hasFmt ? "Formatter config found" : "No formatter config",
    weight: 15,
  });

  const hasSrcLayout = treeHasPattern(tree, /^src\//) || treeHasPattern(tree, /^[a-z_]+\/__init__\.py$/);
  findings.push({
    name: "Package structure (src/ or package layout)",
    passed: hasSrcLayout,
    detail: hasSrcLayout ? "Python package structure found" : "No clear package structure",
    weight: 20,
  });

  const hasBuild = hasPyproject || treeHasFile(tree, "setup.py") || treeHasFile(tree, "setup.cfg");
  findings.push({
    name: "Build configuration (pyproject.toml / setup.py)",
    passed: hasBuild,
    detail: hasBuild ? "Build config found" : "No build configuration",
    weight: 10,
  });

  return findings;
}

function checkGo(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // Go has built-in type safety
  const hasGoMod = treeHasFile(tree, "go.mod");
  findings.push({
    name: "Type safety (built-in + go.mod)",
    passed: hasGoMod,
    detail: hasGoMod ? "go.mod found — Go has built-in type safety" : "No go.mod found",
    weight: 20,
  });

  const hasLint =
    treeHasFile(tree, ".golangci.yml") ||
    treeHasFile(tree, ".golangci.yaml") ||
    treeHasFile(tree, ".golangci.json");
  findings.push({
    name: "Linter (golangci-lint)",
    passed: hasLint,
    detail: hasLint ? "golangci-lint config found" : "No golangci-lint config",
    weight: 20,
  });

  // gofmt is built into Go — always passes if go.mod exists
  findings.push({
    name: "Code formatter (gofmt — built-in)",
    passed: hasGoMod,
    detail: hasGoMod ? "gofmt is built into Go toolchain" : "No Go project detected",
    weight: 15,
  });

  const hasStructure =
    treeHasPattern(tree, /^cmd\//) ||
    treeHasPattern(tree, /^pkg\//) ||
    treeHasPattern(tree, /^internal\//);
  findings.push({
    name: "Package structure (cmd/, pkg/, internal/)",
    passed: hasStructure,
    detail: hasStructure ? "Standard Go layout found" : "No standard Go directory layout",
    weight: 20,
  });

  const hasBuild =
    treeHasFile(tree, "Makefile") ||
    treeHasFile(tree, "Taskfile.yml") ||
    treeHasFile(tree, "Taskfile.yaml");
  findings.push({
    name: "Build runner (Makefile / Taskfile)",
    passed: hasBuild,
    detail: hasBuild ? "Build runner found" : "No Makefile or Taskfile",
    weight: 10,
  });

  return findings;
}

function checkRust(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  const hasCargo = treeHasFile(tree, "Cargo.toml");
  findings.push({
    name: "Type safety (built-in + Cargo.toml)",
    passed: hasCargo,
    detail: hasCargo ? "Cargo.toml found — Rust has built-in type safety" : "No Cargo.toml",
    weight: 20,
  });

  // clippy config or CI step (heuristic: .clippy.toml or CI workflows)
  const hasClippy =
    treeHasFile(tree, ".clippy.toml") ||
    treeHasFile(tree, "clippy.toml") ||
    treeHasPattern(tree, /^\.github\/workflows\/.*\.ya?ml$/); // CI likely runs clippy
  findings.push({
    name: "Linter (clippy)",
    passed: hasClippy,
    detail: hasClippy ? "Clippy config or CI found" : "No clippy configuration",
    weight: 20,
  });

  const hasFmt =
    treeHasFile(tree, "rustfmt.toml") ||
    treeHasFile(tree, ".rustfmt.toml");
  // rustfmt is built-in, give credit if Cargo.toml exists
  findings.push({
    name: "Code formatter (rustfmt)",
    passed: hasFmt || hasCargo,
    detail: hasFmt ? "rustfmt.toml found" : hasCargo ? "rustfmt is built into Rust toolchain" : "No Rust project",
    weight: 15,
  });

  const hasSrc = treeHasPattern(tree, /^src\//);
  findings.push({
    name: "Source structure",
    passed: hasSrc,
    detail: hasSrc ? "src/ directory found" : "No src/ directory",
    weight: 20,
  });

  findings.push({
    name: "Build configuration (Cargo.toml)",
    passed: hasCargo,
    detail: hasCargo ? "Cargo.toml found" : "No Cargo.toml",
    weight: 10,
  });

  return findings;
}

function checkJava(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  const hasMaven = treeHasFile(tree, "pom.xml");
  const hasGradle =
    treeHasFile(tree, "build.gradle") ||
    treeHasFile(tree, "build.gradle.kts");
  const hasBuild = hasMaven || hasGradle;
  findings.push({
    name: "Type safety (built-in + build tool)",
    passed: hasBuild,
    detail: hasBuild
      ? `${hasMaven ? "Maven" : "Gradle"} found — Java has built-in type safety`
      : "No Maven or Gradle build file",
    weight: 20,
  });

  const hasLint =
    treeHasFile(tree, "checkstyle.xml") ||
    treeHasPattern(tree, /pmd.*\.xml$/) ||
    treeHasFile(tree, "spotbugs-exclude.xml") ||
    treeHasPattern(tree, /spotless/);
  findings.push({
    name: "Linter (Checkstyle / PMD / SpotBugs)",
    passed: hasLint,
    detail: hasLint ? "Static analysis config found" : "No Checkstyle, PMD, or SpotBugs config",
    weight: 20,
  });

  const hasFmt =
    treeHasFile(tree, ".editorconfig") ||
    treeHasPattern(tree, /google-java-format/) ||
    treeHasPattern(tree, /spotless/);
  findings.push({
    name: "Code formatter (google-java-format / Spotless)",
    passed: hasFmt,
    detail: hasFmt ? "Formatter config found" : "No formatter config",
    weight: 15,
  });

  const hasStdLayout =
    treeHasPattern(tree, /^src\/main\/java\//) ||
    treeHasPattern(tree, /^src\/test\/java\//);
  findings.push({
    name: "Standard Maven layout (src/main/java)",
    passed: hasStdLayout,
    detail: hasStdLayout ? "Standard Java layout found" : "No standard Maven/Gradle layout",
    weight: 20,
  });

  findings.push({
    name: "Build configuration",
    passed: hasBuild,
    detail: hasBuild ? `${hasMaven ? "pom.xml" : "build.gradle"} found` : "No build config",
    weight: 10,
  });

  return findings;
}

function checkShell(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // ShellCheck
  const hasShellcheck =
    treeHasFile(tree, ".shellcheckrc") ||
    treeHasPattern(tree, /^\.github\/workflows\/.*\.ya?ml$/); // CI likely runs shellcheck
  findings.push({
    name: "Linter (ShellCheck)",
    passed: hasShellcheck,
    detail: hasShellcheck ? "ShellCheck config or CI found" : "No ShellCheck configuration",
    weight: 25,
  });

  const hasShfmt =
    treeHasFile(tree, ".editorconfig"); // shfmt reads .editorconfig
  findings.push({
    name: "Code formatter (shfmt / editorconfig)",
    passed: hasShfmt,
    detail: hasShfmt ? ".editorconfig found (used by shfmt)" : "No .editorconfig for shfmt",
    weight: 15,
  });

  const hasMakefile = treeHasFile(tree, "Makefile");
  findings.push({
    name: "Build runner (Makefile)",
    passed: hasMakefile,
    detail: hasMakefile ? "Makefile found" : "No Makefile",
    weight: 20,
  });

  const hasLib = treeHasPattern(tree, /^lib\//) || treeHasPattern(tree, /^src\//);
  findings.push({
    name: "Modular script structure (lib/ or src/)",
    passed: hasLib,
    detail: hasLib ? "Modular structure found" : "No lib/ or src/ directory",
    weight: 20,
  });

  const hasTestFramework =
    treeHasPattern(tree, /\.bats$/) ||
    treeHasPattern(tree, /shunit/) ||
    treeHasPattern(tree, /^test\//);
  findings.push({
    name: "Test framework (bats / shunit2)",
    passed: hasTestFramework,
    detail: hasTestFramework ? "Test framework found" : "No bats or shunit2 tests",
    weight: 20,
  });

  return findings;
}

function checkC(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  const hasMake = treeHasFile(tree, "Makefile");
  const hasCmake = treeHasFile(tree, "CMakeLists.txt");
  const hasMeson = treeHasFile(tree, "meson.build");
  const hasBuild = hasMake || hasCmake || hasMeson;
  findings.push({
    name: "Build system (Make / CMake / Meson)",
    passed: hasBuild,
    detail: hasBuild
      ? `Build system found (${hasCmake ? "CMake" : hasMeson ? "Meson" : "Make"})`
      : "No build system detected",
    weight: 20,
  });

  const hasAnalyzer =
    treeHasFile(tree, ".clang-tidy") ||
    treeHasFile(tree, ".cppcheck") ||
    treeHasPattern(tree, /cppcheck/) ||
    treeHasPattern(tree, /^\.github\/workflows\/.*\.ya?ml$/);
  findings.push({
    name: "Static analyzer (clang-tidy / cppcheck)",
    passed: hasAnalyzer,
    detail: hasAnalyzer ? "Static analysis config or CI found" : "No static analyzer config",
    weight: 20,
  });

  const hasFmt =
    treeHasFile(tree, ".clang-format") ||
    treeHasFile(tree, ".editorconfig");
  findings.push({
    name: "Code formatter (clang-format)",
    passed: hasFmt,
    detail: hasFmt ? "Formatter config found" : "No .clang-format config",
    weight: 15,
  });

  const hasSeparation =
    treeHasPattern(tree, /^include\//) ||
    treeHasPattern(tree, /^src\//);
  findings.push({
    name: "Header/source separation (include/, src/)",
    passed: hasSeparation,
    detail: hasSeparation ? "Standard C layout found" : "No include/ or src/ structure",
    weight: 20,
  });

  findings.push({
    name: "Build configuration",
    passed: hasBuild,
    detail: hasBuild ? "Build config found" : "No build config",
    weight: 10,
  });

  return findings;
}

function checkRuby(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // Ruby is dynamically typed; Sorbet or RBS add type safety
  const hasTypes =
    treeHasFile(tree, "sorbet/config") ||
    treeHasPattern(tree, /\.rbs$/) ||
    treeHasPattern(tree, /^sorbet\//);
  findings.push({
    name: "Type safety (Sorbet / RBS)",
    passed: hasTypes,
    detail: hasTypes ? "Type checking found" : "No Sorbet or RBS — consider adding type checking",
    weight: 20,
  });

  const hasLint =
    treeHasFile(tree, ".rubocop.yml") ||
    treeHasFile(tree, ".rubocop.yaml");
  findings.push({
    name: "Linter (RuboCop)",
    passed: hasLint,
    detail: hasLint ? "RuboCop config found" : "No RuboCop config",
    weight: 20,
  });

  const hasFmt = hasLint || treeHasFile(tree, ".editorconfig");
  findings.push({
    name: "Code formatter (RuboCop / editorconfig)",
    passed: hasFmt,
    detail: hasFmt ? "Formatter config found" : "No formatter config",
    weight: 15,
  });

  const hasStructure =
    treeHasPattern(tree, /^lib\//) ||
    treeHasPattern(tree, /^app\//);
  findings.push({
    name: "Source structure (lib/ or app/)",
    passed: hasStructure,
    detail: hasStructure ? "Standard Ruby layout found" : "No lib/ or app/ directory",
    weight: 20,
  });

  const hasBuild =
    treeHasFile(tree, "Gemfile") ||
    treeHasFile(tree, "Rakefile") ||
    treeHasPattern(tree, /\.gemspec$/);
  findings.push({
    name: "Build configuration (Gemfile / Rakefile)",
    passed: hasBuild,
    detail: hasBuild ? "Build config found" : "No Gemfile or Rakefile",
    weight: 10,
  });

  return findings;
}

/**
 * Fallback for unrecognized languages — uses the original generic checks.
 */
function checkGenericApplication(tree: RepoTree, _meta: RepoMeta): Finding[] {
  const findings: Finding[] = [];

  const hasTypeScript =
    treeHasFile(tree, "tsconfig.json") || treeHasPattern(tree, /\.tsx?$/);
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
    detail: hasLint ? "Linting config found" : "No linter config — code quality may vary",
    weight: 20,
  });

  const hasFormatter =
    treeHasFile(tree, ".prettierrc") ||
    treeHasFile(tree, ".prettierrc.json") ||
    treeHasFile(tree, ".prettierrc.js") ||
    treeHasFile(tree, "prettier.config.js") ||
    treeHasFile(tree, "prettier.config.mjs") ||
    treeHasFile(tree, ".editorconfig") ||
    treeHasFile(tree, "biome.json") ||
    treeHasFile(tree, "rustfmt.toml") ||
    treeHasFile(tree, "pyproject.toml");
  findings.push({
    name: "Code formatter",
    passed: hasFormatter,
    detail: hasFormatter ? "Formatter config found" : "No formatter config — inconsistent style is likely",
    weight: 15,
  });

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

  const hasMonorepo =
    treeHasFile(tree, "lerna.json") ||
    treeHasFile(tree, "nx.json") ||
    treeHasFile(tree, "turbo.json") ||
    treeHasFile(tree, "pnpm-workspace.yaml");
  const hasMultiplePackages = treeHasPattern(tree, /^packages\//);
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
    detail: hasBuildConfig ? "Build config found" : "No build configuration detected",
    weight: 10,
  });

  return findings;
}

// ── Language dispatch map ─────────────────────────────────────────────

type ArchCheckFn = (tree: RepoTree, meta: RepoMeta) => Finding[];

const LANGUAGE_CHECKS: Record<RepoLanguage, ArchCheckFn> = {
  typescript: (tree) => checkTypescript(tree),
  javascript: (tree) => checkJavascript(tree),
  python: (tree) => checkPython(tree),
  go: (tree) => checkGo(tree),
  rust: (tree) => checkRust(tree),
  java: (tree) => checkJava(tree),
  shell: (tree) => checkShell(tree),
  c: (tree) => checkC(tree),
  ruby: (tree) => checkRuby(tree),
  other: (tree, meta) => checkGenericApplication(tree, meta),
};

function analyzeApplicationArchitecture(
  tree: RepoTree,
  meta: RepoMeta,
  language: RepoLanguage = "other"
): Finding[] {
  const checkFn = LANGUAGE_CHECKS[language];
  return checkFn(tree, meta);
}

function analyzeDocumentationArchitecture(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // README structure: has headings and table of contents indicators
  const hasToC =
    treeHasPattern(tree, /^README\.md$/i) &&
    treeHasPattern(tree, /## Contents|## Table of Contents|## TOC/i);
  findings.push({
    name: "README structure (headings + table of contents)",
    passed: hasToC || treeHasFile(tree, "README.md"),
    detail: hasToC
      ? "README.md with table of contents found"
      : treeHasFile(tree, "README.md")
        ? "README.md found (consider adding a table of contents)"
        : "No README.md found",
    weight: 25,
  });

  // Organized file structure: subdirectories for categories
  const hasSubdirectories =
    tree.tree.filter(
      (e) => e.type === "tree" && !e.path.startsWith(".") && !e.path.startsWith("_")
    ).length > 0;
  findings.push({
    name: "Organized file structure (category directories)",
    passed: hasSubdirectories,
    detail: hasSubdirectories
      ? "Subdirectories found for category organization"
      : "No subdirectories — consider organizing content into category folders",
    weight: 20,
  });

  // Contributing guidelines
  const hasContributing =
    treeHasFile(tree, "CONTRIBUTING.md") ||
    treeHasFile(tree, "contributing.md") ||
    treeHasFile(tree, ".github/CONTRIBUTING.md");
  findings.push({
    name: "Contributing guidelines (CONTRIBUTING.md)",
    passed: hasContributing,
    detail: hasContributing
      ? "CONTRIBUTING.md found"
      : "No CONTRIBUTING.md — contributors won't know how to add entries",
    weight: 20,
  });

  // LICENSE present
  const hasLicense =
    treeHasFile(tree, "LICENSE") ||
    treeHasFile(tree, "LICENSE.md") ||
    treeHasFile(tree, "LICENSE.txt") ||
    treeHasFile(tree, "license") ||
    treeHasFile(tree, "license.md");
  findings.push({
    name: "License (LICENSE file)",
    passed: hasLicense,
    detail: hasLicense ? "LICENSE file found" : "No LICENSE file",
    weight: 20,
  });

  // Consistent formatting: .editorconfig or markdownlint config
  const hasFormatConfig =
    treeHasFile(tree, ".editorconfig") ||
    treeHasFile(tree, ".markdownlint.json") ||
    treeHasFile(tree, ".markdownlint.yml") ||
    treeHasFile(tree, ".markdownlint.yaml") ||
    treeHasFile(tree, "markdownlint.json") ||
    treeHasFile(tree, ".markdownlintrc");
  findings.push({
    name: "Consistent formatting (.editorconfig / markdownlint)",
    passed: hasFormatConfig,
    detail: hasFormatConfig
      ? "Formatting config found"
      : "No .editorconfig or markdownlint config — consider adding for consistency",
    weight: 15,
  });

  return findings;
}

export async function analyzeArchitectureDimension(
  tree: RepoTree,
  meta: RepoMeta,
  _slug: string,
  projectType: ProjectType = "application",
  language: RepoLanguage = "other"
): Promise<DimensionResult> {
  const start = performance.now();

  let findings: Finding[];
  if (projectType === "documentation") {
    findings = analyzeDocumentationArchitecture(tree);
  } else if (projectType === "iac") {
    findings = analyzeIacArchitecture(tree);
  } else if (projectType === "hybrid") {
    findings = analyzeApplicationArchitecture(tree, meta, language);
    const iacFindings = analyzeIacArchitecture(tree).map((f) => ({
      ...f,
      name: `[IaC] ${f.name}`,
      weight: Math.round(f.weight * 0.5),
    }));
    findings.push(...iacFindings);
  } else {
    findings = analyzeApplicationArchitecture(tree, meta, language);
  }

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const earnedWeight = findings
    .filter((f) => f.passed)
    .reduce((sum, f) => sum + f.weight, 0);
  const score =
    totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  return {
    name: "Architecture",
    score,
    findings,
    durationMs: performance.now() - start,
  };
}
