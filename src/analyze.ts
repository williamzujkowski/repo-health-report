import { execFile } from "node:child_process";

const GH_TIMEOUT_MS = 15_000;

export interface RepoTree {
  tree: Array<{ path: string; type: string; size?: number }>;
}

export interface RepoMeta {
  default_branch: string;
  language: string | null;
  has_wiki: boolean;
  has_pages: boolean;
  license: { spdx_id: string } | null;
  open_issues_count: number;
  archived: boolean;
  description: string | null;
  stargazers_count?: number;
}

export interface WorkflowFile {
  name: string;
  path: string;
}

export interface FileContent {
  content: string;
  encoding: string;
}

/**
 * Validate a repo slug (owner/repo) format.
 * Accepts "owner/repo" or "https://github.com/owner/repo".
 */
export function parseRepoSlug(input: string): string {
  const ghUrlMatch = input.match(
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/?$/
  );
  if (ghUrlMatch) {
    return ghUrlMatch[1].replace(/\.git$/, "");
  }

  const slugMatch = input.match(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  if (slugMatch) {
    return slugMatch[0];
  }

  throw new Error(
    `Invalid repo format: "${input}". Use "owner/repo" or "https://github.com/owner/repo".`
  );
}

/**
 * Run a `gh api` call and parse JSON output.
 * Uses --paginate by default for endpoints that return paginated results.
 */
export async function ghApi<T>(
  endpoint: string,
  options?: { paginate?: boolean }
): Promise<T> {
  const args = ["api", endpoint];
  if (options?.paginate !== false) {
    args.push("--paginate");
  }
  return new Promise((resolve, reject) => {
    execFile(
      "gh",
      args,
      { timeout: GH_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr.trim() || error.message;
          reject(new Error(`gh api ${endpoint} failed: ${msg}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout) as T);
        } catch {
          reject(
            new Error(`Failed to parse JSON from gh api ${endpoint}`)
          );
        }
      }
    );
  });
}

/**
 * Fetch the full file tree for a repo's default branch.
 */
export async function fetchRepoTree(
  slug: string,
  branch: string
): Promise<RepoTree> {
  return ghApi<RepoTree>(
    `/repos/${slug}/git/trees/${branch}?recursive=1`
  );
}

/**
 * Fetch repo metadata.
 */
export async function fetchRepoMeta(slug: string): Promise<RepoMeta> {
  return ghApi<RepoMeta>(`/repos/${slug}`);
}

/**
 * Fetch file content (base64-encoded by default).
 */
export async function fetchFileContent(
  slug: string,
  path: string
): Promise<string | null> {
  try {
    const data = await ghApi<FileContent>(
      `/repos/${slug}/contents/${path}`
    );
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return data.content ?? null;
  } catch {
    return null;
  }
}

/**
 * List workflow files in .github/workflows/.
 */
export async function fetchWorkflows(
  slug: string
): Promise<WorkflowFile[]> {
  try {
    const data = await ghApi<{ workflows: WorkflowFile[] }>(
      `/repos/${slug}/actions/workflows`
    );
    return data.workflows ?? [];
  } catch {
    return [];
  }
}

/**
 * Check if a file exists in the tree.
 */
export function treeHasFile(tree: RepoTree, path: string): boolean {
  return tree.tree.some(
    (entry) => entry.path.toLowerCase() === path.toLowerCase()
  );
}

/**
 * Check if any file in the tree matches a pattern.
 */
export function treeHasPattern(tree: RepoTree, pattern: RegExp): boolean {
  return tree.tree.some((entry) => pattern.test(entry.path));
}

/**
 * Count files matching a pattern.
 */
export function treeCountPattern(tree: RepoTree, pattern: RegExp): number {
  return tree.tree.filter((entry) => pattern.test(entry.path)).length;
}

export type ProjectType = "application" | "iac" | "library" | "hybrid" | "documentation" | "runtime";

export type RepoLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "shell"
  | "c"
  | "ruby"
  | "other";

const LANGUAGE_MAP: Record<string, RepoLanguage> = {
  typescript: "typescript",
  javascript: "javascript",
  python: "python",
  go: "go",
  rust: "rust",
  java: "java",
  kotlin: "java",
  scala: "java",
  "c#": "java",
  dart: "java",
  swift: "java",
  clojure: "java",
  groovy: "java",
  shell: "shell",
  bash: "shell",
  lua: "shell",
  powershell: "shell",
  dockerfile: "shell",
  makefile: "shell",
  nix: "shell",
  c: "c",
  "c++": "c",
  "objective-c": "c",
  zig: "c",
  ruby: "ruby",
  php: "ruby",
  perl: "ruby",
  elixir: "ruby",
  erlang: "ruby",
  vue: "javascript",
  svelte: "javascript",
  scss: "javascript",
  css: "javascript",
  html: "javascript",
  r: "python",
  julia: "python",
  "jupyter notebook": "python",
  hcl: "other",
  haskell: "other",
};

/**
 * Detect language from file extensions in the repo tree.
 * Used as a fallback when GitHub returns null for the language field.
 */
export function detectLanguageFromTree(tree: RepoTree): RepoLanguage {
  const extCounts: Record<string, number> = {};
  for (const entry of tree.tree) {
    if (entry.type !== "blob") continue;
    const ext = entry.path.split(".").pop()?.toLowerCase();
    if (ext) extCounts[ext] = (extCounts[ext] ?? 0) + 1;
  }

  const extMap: Record<string, RepoLanguage> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript", mjs: "javascript",
    py: "python", pyx: "python",
    go: "go",
    rs: "rust",
    java: "java", kt: "java", scala: "java",
    sh: "shell", bash: "shell",
    c: "c", cpp: "c", h: "c", hpp: "c",
    rb: "ruby",
  };

  let bestLang: RepoLanguage = "other";
  let bestCount = 0;
  for (const [ext, count] of Object.entries(extCounts)) {
    const lang = extMap[ext];
    if (lang && count > bestCount) {
      bestLang = lang;
      bestCount = count;
    }
  }
  return bestLang;
}

export function normalizeLanguage(ghLanguage: string | null, tree?: RepoTree): RepoLanguage {
  const lower = (ghLanguage ?? "").toLowerCase();
  const mapped = LANGUAGE_MAP[lower];
  if (mapped) return mapped;
  if (tree) return detectLanguageFromTree(tree);
  return "other";
}

const KNOWN_RUNTIMES = new Set([
  "golang/go", "rust-lang/rust", "python/cpython", "ruby/ruby",
  "nodejs/node", "openjdk/jdk", "dotnet/runtime", "apple/swift",
  "llvm/llvm-project", "gcc-mirror/gcc", "torvalds/linux",
  "denoland/deno",
]);

/**
 * Detect the project type based on the file tree and repo slug.
 * Checks runtime and documentation repos FIRST, then application entry points
 * to avoid misclassifying Go/Node/Python apps that also contain Terraform configs.
 *
 * - 'runtime': language runtimes, compilers, kernels (known slugs)
 * - 'documentation': awesome lists, educational repos, book repos (>80% markdown, no source)
 * - 'hybrid': has both application code AND IaC configs (e.g., Go + Terraform)
 * - 'application': Go, Node, Python, Rust, Java, etc.
 * - 'iac': purely Terraform, Ansible, Pulumi, or CloudFormation
 * - 'library': no src/ but has lib/ or root index file
 */
export function detectProjectType(tree: RepoTree, slug?: string): ProjectType {
  // Runtime detection — check BEFORE everything else
  if (slug && KNOWN_RUNTIMES.has(slug)) return "runtime";
  // Documentation detection — check BEFORE application/IaC
  const repoName = slug?.split("/")[1] ?? "";
  // Match "awesome", "awesome-*", "*-awesome", or "*-awesome-*" patterns
  const isAwesomeRepo = /^awesome$/i.test(repoName) || /^awesome-|^.*-awesome$|^.*-awesome-/i.test(repoName);

  const totalFiles = tree.tree.filter((e) => e.type === "blob").length;
  const mdFiles = tree.tree.filter(
    (e) => e.type === "blob" && /\.md$/i.test(e.path)
  ).length;
  const markdownRatio = totalFiles > 0 ? mdFiles / totalFiles : 0;

  const sourceFileCount = tree.tree.filter(
    (e) =>
      e.type === "blob" &&
      /\.(ts|js|py|go|rs|java|rb|c|cpp|cc|cxx|cs|swift|kt|scala|ex|exs|php|lua|r|dart)$/i.test(
        e.path
      )
  ).length;

  const hasSubstantialReadme = treeHasFile(tree, "README.md");

  // A repo is a documentation project when:
  // - Named with the awesome-* pattern, OR
  // - Has no source code files, has a README, and >50% of files are markdown (educational/book repos)
  const isDocumentationRepo =
    isAwesomeRepo ||
    (markdownRatio > 0.5 && sourceFileCount === 0 && hasSubstantialReadme) ||
    (sourceFileCount === 0 && mdFiles > 0 && hasSubstantialReadme && totalFiles <= 5);

  if (isDocumentationRepo) {
    return "documentation";
  }

  // Application entry points — check these FIRST
  const appIndicators =
    treeHasFile(tree, "go.mod") ||
    treeHasFile(tree, "main.go") ||
    treeHasFile(tree, "package.json") ||
    treeHasFile(tree, "Cargo.toml") ||
    treeHasFile(tree, "pyproject.toml") ||
    treeHasFile(tree, "setup.py") ||
    treeHasFile(tree, "pom.xml") ||
    treeHasFile(tree, "build.gradle") ||
    treeHasFile(tree, "build.gradle.kts") ||
    treeHasFile(tree, "mix.exs") ||
    treeHasFile(tree, "Gemfile") ||
    treeHasPattern(tree, /^src\/.*\.(ts|js|py|rs|go|java|rb)$/);

  const iacIndicators =
    treeHasPattern(tree, /\.tf$/) ||
    treeHasPattern(tree, /^terraform\//) ||
    treeHasPattern(tree, /^ansible\//) ||
    treeHasPattern(tree, /^pulumi\//) ||
    treeHasPattern(tree, /^cloudformation\//) ||
    treeHasFile(tree, "Pulumi.yaml") ||
    treeHasFile(tree, "Pulumi.yml") ||
    treeHasPattern(tree, /\.cfn\.ya?ml$/);

  // Hybrid: both application code AND IaC
  if (appIndicators && iacIndicators) {
    return "hybrid";
  }

  // Pure IaC
  if (iacIndicators) {
    return "iac";
  }

  // Library detection
  const hasSrcDir = treeHasPattern(tree, /^src\//);
  const hasLibDir = treeHasPattern(tree, /^lib\//);
  const hasRootIndex =
    treeHasFile(tree, "index.ts") || treeHasFile(tree, "index.js");
  if (!hasSrcDir && (hasLibDir || hasRootIndex)) {
    return "library";
  }

  return "application";
}
