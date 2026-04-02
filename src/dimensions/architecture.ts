import {
  type RepoTree,
  type RepoMeta,
  type ProjectType,
  treeHasFile,
  treeHasPattern,
} from "../analyze.js";
import type { DimensionResult, Finding } from "./security.js";

function analyzeIacArchitecture(tree: RepoTree): Finding[] {
  const findings: Finding[] = [];

  // Linter: tflint
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

  // Formatting: terraform fmt in CI or pre-commit
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

  // Module structure
  const hasModulesDir = treeHasPattern(tree, /^modules\//);
  findings.push({
    name: "Module structure",
    passed: hasModulesDir,
    detail: hasModulesDir
      ? "modules/ directory found — good Terraform module organization"
      : "No modules/ directory — consider modularizing Terraform configs",
    weight: 20,
  });

  // Terraform conventions: variables.tf and outputs.tf
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

  // Terraform version pinning
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

  // Build config: Makefile is common in IaC repos
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

function analyzeApplicationArchitecture(
  tree: RepoTree,
  _meta: RepoMeta
): Finding[] {
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
    treeHasFile(tree, "pyproject.toml");
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

  return findings;
}

export async function analyzeArchitectureDimension(
  tree: RepoTree,
  meta: RepoMeta,
  _slug: string,
  projectType: ProjectType = "application"
): Promise<DimensionResult> {
  const start = performance.now();

  let findings: Finding[];
  if (projectType === "iac") {
    findings = analyzeIacArchitecture(tree);
  } else if (projectType === "hybrid") {
    // Hybrid: application checks as base + IaC bonus checks (lower weight)
    findings = analyzeApplicationArchitecture(tree, meta);
    const iacFindings = analyzeIacArchitecture(tree).map((f) => ({
      ...f,
      name: `[IaC] ${f.name}`,
      weight: Math.round(f.weight * 0.5),
    }));
    findings.push(...iacFindings);
  } else {
    findings = analyzeApplicationArchitecture(tree, meta);
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
