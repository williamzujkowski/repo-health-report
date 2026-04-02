import { execFile } from "node:child_process";

const GH_TIMEOUT_MS = 10_000;

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
 */
export async function ghApi<T>(endpoint: string): Promise<T> {
  return new Promise((resolve, reject) => {
    execFile(
      "gh",
      ["api", endpoint, "--paginate"],
      { timeout: GH_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
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

export type ProjectType = "application" | "iac" | "library" | "hybrid";

/**
 * Detect the project type based on the file tree.
 * Checks application entry points FIRST to avoid misclassifying
 * Go/Node/Python apps that also contain Terraform configs.
 *
 * - 'hybrid': has both application code AND IaC configs (e.g., Go + Terraform)
 * - 'application': Go, Node, Python, Rust, Java, etc.
 * - 'iac': purely Terraform, Ansible, Pulumi, or CloudFormation
 * - 'library': no src/ but has lib/ or root index file
 */
export function detectProjectType(tree: RepoTree): ProjectType {
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
