/**
 * AI analysis integration for repo-health-report.
 *
 * Instead of calling nexus-agents CLI directly (which doesn't exist as a
 * standalone binary), this module:
 * 1. Exports structured data for consumption by Claude Code / MCP tools
 * 2. Provides a buildAnalysisPrompt() function that generates a ready-to-use
 *    prompt for nexus-agents MCP tools (orchestrate, consensus_vote, etc.)
 *
 * Usage from Claude Code:
 *   1. Run `repo-health-report owner/repo --json` to get structured findings
 *   2. Feed the JSON to nexus-agents MCP tools for AI expert analysis
 *   3. Or use the `repo-health` Claude Code skill which does both automatically
 */

export interface ExpertResult {
  dimension: string;
  analysis: string;
  score: number;
  confidence: number;
}

export interface ConsensusResult {
  grade: string;
  reasoning: string;
  approvalPercentage: number;
}

export interface AiAnalysisResult {
  available: boolean;
  experts: ExpertResult[];
  consensus: ConsensusResult | null;
  error?: string;
}

// Re-use the canonical types from dimensions
import type { DimensionResult } from "./dimensions/security.js";

/**
 * Build a structured prompt for nexus-agents consensus_vote MCP tool.
 * This is used by the Claude Code skill to feed static analysis into AI voting.
 */
export function buildVoteProposal(
  repo: string,
  projectType: string,
  dimensions: DimensionResult[],
  staticGrade: string,
  staticScore: number
): string {
  const findings = dimensions
    .map(
      (d) =>
        `${d.name} ${d.score}/100: ${d.findings
          .map((f) => `${f.passed ? "PASS" : "FAIL"} ${f.name}`)
          .join(", ")}`
    )
    .join(". ");

  return (
    `Grade the GitHub repository ${repo} (${projectType} project) for overall health. ` +
    `Static analysis scored ${staticScore}/100 (${staticGrade}). ` +
    `Dimension scores: ${findings}. ` +
    `Should the grade be adjusted based on project type context and findings?`
  );
}

/**
 * Build a prompt for nexus-agents repo_analyze MCP tool.
 */
export function buildAnalyzePrompt(repo: string): string {
  return `Analyze the GitHub repository ${repo} for language, framework, CI provider, security tooling, and gaps.`;
}

/**
 * Placeholder for when AI analysis is requested but no MCP tools are available.
 * Points the user to the correct integration path.
 */
export function getUnavailableResult(): AiAnalysisResult {
  return {
    available: false,
    experts: [],
    consensus: null,
    error:
      "AI analysis requires nexus-agents MCP tools. " +
      "Run from Claude Code with nexus-agents MCP server configured, " +
      "or use: repo-health-report <repo> --json | then feed to nexus-agents MCP tools. " +
      "See: https://github.com/williamzujkowski/nexus-agents",
  };
}
