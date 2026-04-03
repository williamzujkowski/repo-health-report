import { ghApi } from "./analyze.js";

export interface AiContributorResult {
  botContributors: Array<{ login: string; type: string; contributions: number }>;
  aiTrailers: Array<{ agent: string; count: number }>;
  automationLevel: "none" | "low" | "medium" | "high";
}

// Known AI agent bot accounts
const AI_BOT_PATTERNS: Array<{ pattern: RegExp; agent: string }> = [
  { pattern: /^claude\[bot\]$/i, agent: "Claude (Action)" },
  { pattern: /^gemini-code-assist\[bot\]$/i, agent: "Gemini Code Assist" },
  { pattern: /^devin-ai-integration\[bot\]$/i, agent: "Devin" },
  { pattern: /^copilot\[bot\]$/i, agent: "GitHub Copilot" },
  { pattern: /^coderabbit.*\[bot\]$/i, agent: "CodeRabbit" },
  { pattern: /^sweep-ai\[bot\]$/i, agent: "Sweep" },
];

// Known automation bot accounts (not AI per se, but automation)
const AUTOMATION_BOT_PATTERNS: Array<{ pattern: RegExp; agent: string }> = [
  { pattern: /^dependabot\[bot\]$/i, agent: "Dependabot" },
  { pattern: /^renovate\[bot\]$/i, agent: "Renovate" },
  { pattern: /^github-actions\[bot\]$/i, agent: "GitHub Actions" },
  { pattern: /^snyk-bot$/i, agent: "Snyk" },
  { pattern: /^allcontributors\[bot\]$/i, agent: "All Contributors" },
  { pattern: /^release-please\[bot\]$/i, agent: "Release Please" },
  { pattern: /^semantic-release-bot$/i, agent: "Semantic Release" },
];

// Co-Authored-By patterns in commit messages
const CO_AUTHOR_PATTERNS: Array<{ pattern: RegExp; agent: string }> = [
  { pattern: /Co-Authored-By:.*Claude/i, agent: "Claude (CLI)" },
  { pattern: /Co-Authored-By:.*Copilot/i, agent: "GitHub Copilot" },
  { pattern: /Co-Authored-By:.*Gemini/i, agent: "Gemini" },
  { pattern: /Co-Authored-By:.*Codex/i, agent: "Codex" },
  { pattern: /Co-Authored-By:.*Cursor/i, agent: "Cursor" },
  { pattern: /Co-Authored-By:.*Aider/i, agent: "Aider" },
];

/**
 * Detect AI and automation contributors for a GitHub repo.
 * Uses two signals: the contributors API (bot accounts) and
 * Co-Authored-By trailers in recent commits.
 */
export async function detectAiContributors(slug: string): Promise<AiContributorResult> {
  const botContributors: AiContributorResult["botContributors"] = [];
  const aiTrailerCounts = new Map<string, number>();

  // 1. Check contributors API for bot accounts
  try {
    const contributors = await ghApi<Array<{ login: string; type: string; contributions: number }>>(
      `/repos/${slug}/contributors?per_page=30`,
      { paginate: false }
    );
    for (const c of contributors) {
      if (c.type === "Bot" || c.login.includes("[bot]")) {
        const isAi = AI_BOT_PATTERNS.find((p) => p.pattern.test(c.login));
        const isAutomation = AUTOMATION_BOT_PATTERNS.find((p) => p.pattern.test(c.login));
        botContributors.push({
          login: c.login,
          type: isAi ? "ai" : isAutomation ? "automation" : "bot",
          contributions: c.contributions,
        });
      }
    }
  } catch {
    // no contributor data available — continue
  }

  // 2. Check recent commits for Co-Authored-By trailers
  try {
    const commits = await ghApi<Array<{ commit: { message: string } }>>(
      `/repos/${slug}/commits?per_page=20`,
      { paginate: false }
    );
    for (const c of commits) {
      const msg = c.commit.message;
      for (const { pattern, agent } of CO_AUTHOR_PATTERNS) {
        if (pattern.test(msg)) {
          aiTrailerCounts.set(agent, (aiTrailerCounts.get(agent) ?? 0) + 1);
        }
      }
    }
  } catch {
    // no commit data available — continue
  }

  const aiTrailers = [...aiTrailerCounts.entries()].map(([agent, count]) => ({ agent, count }));

  // Compute automation level
  const hasAiBot = botContributors.some((b) => AI_BOT_PATTERNS.some((p) => p.pattern.test(b.login)));
  const hasAiTrailer = aiTrailers.length > 0;
  const hasAutomation = botContributors.some((b) =>
    AUTOMATION_BOT_PATTERNS.some((p) => p.pattern.test(b.login))
  );

  let automationLevel: AiContributorResult["automationLevel"] = "none";
  if (hasAiBot && hasAiTrailer) automationLevel = "high";
  else if (hasAiBot || hasAiTrailer) automationLevel = "medium";
  else if (hasAutomation) automationLevel = "low";

  return { botContributors, aiTrailers, automationLevel };
}
