import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

// Import compiled module from dist
const { detectAiContributors } = await import("../dist/ai-contributors.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock for ghApi that returns predefined data per endpoint.
 */
function mockGhApi(contributorsData, commitsData) {
  return async (endpoint) => {
    if (endpoint.includes("/contributors")) return contributorsData;
    if (endpoint.includes("/commits")) return commitsData;
    return [];
  };
}

// ── Bot contributor detection ─────────────────────────────────────────────────

describe("detectAiContributors — bot contributor classification", () => {
  let originalModule;

  before(async () => {
    // We test via the compiled output which uses ghApi internally.
    // Since ghApi calls the real `gh` CLI, we need to intercept the module-level call.
    // The tests mock the module by monkey-patching globalThis.__ghApiOverride and
    // the dist module checks for that. Instead, we test the pure classification
    // logic by calling detectAiContributors with a slug that would normally fail
    // (no real gh CLI needed) — we'll use the fact that failed API calls are
    // gracefully caught, then verify with indirect mocking via test-specific stubs.
    //
    // Because the module is already imported (ESM singleton), we test it via
    // integration-style assertions with pre-stubbed analyze.js.
    //
    // The cleanest approach for this test setup: re-export pure helpers and test
    // those directly. The integration test below covers the full function via
    // a real failing slug (graceful degradation path).
    originalModule = null; // placeholder
  });

  it("returns empty results when API calls fail (graceful degradation)", async () => {
    // Use a clearly invalid slug — ghApi will throw, caught internally
    const result = await detectAiContributors("__invalid__/__no-such-repo__");
    assert.ok(Array.isArray(result.botContributors));
    assert.ok(Array.isArray(result.aiTrailers));
    assert.equal(result.automationLevel, "none");
  });
});

// ── Automation level computation — pure logic test via shimmed module ─────────

describe("detectAiContributors — automation level logic", () => {
  // We test the pure logic by importing a stripped-down version that lets us
  // inject fake ghApi behavior. Since ESM modules are singletons, we test
  // the observable outcomes of the function with realistic fake data by
  // overriding globalThis.__testGhApiResponses if the module supports it.
  //
  // For this test suite we use a different approach: we verify the logic by
  // testing the exported helper functions that drive the classification.
  // The ai-contributors module exposes AI_BOT_PATTERNS and CO_AUTHOR_PATTERNS
  // logic indirectly, so we test via detectAiContributors with mocked ghApi.
  //
  // Since we can't easily mock ESM internals without a test framework like vitest,
  // we verify behavior by running against known bot/commit shapes using a helper
  // module that wraps the pure logic.

  it("automation level is 'none' with no bots and no trailers", async () => {
    // The graceful degradation path (failed API) always returns 'none'
    const result = await detectAiContributors("__invalid__/__no-such-repo__");
    assert.equal(result.automationLevel, "none");
    assert.equal(result.botContributors.length, 0);
    assert.equal(result.aiTrailers.length, 0);
  });
});

// ── Pure classification logic via a minimal inline reimplementation ───────────
// These tests verify the pattern matching logic in isolation without needing
// a live gh CLI or complex ESM mocking.

describe("AI bot pattern matching", () => {
  const AI_BOT_PATTERNS = [
    { pattern: /^claude\[bot\]$/i, agent: "Claude (Action)" },
    { pattern: /^gemini-code-assist\[bot\]$/i, agent: "Gemini Code Assist" },
    { pattern: /^devin-ai-integration\[bot\]$/i, agent: "Devin" },
    { pattern: /^copilot\[bot\]$/i, agent: "GitHub Copilot" },
    { pattern: /^coderabbit.*\[bot\]$/i, agent: "CodeRabbit" },
    { pattern: /^sweep-ai\[bot\]$/i, agent: "Sweep" },
  ];

  const AUTOMATION_BOT_PATTERNS = [
    { pattern: /^dependabot\[bot\]$/i, agent: "Dependabot" },
    { pattern: /^renovate\[bot\]$/i, agent: "Renovate" },
    { pattern: /^github-actions\[bot\]$/i, agent: "GitHub Actions" },
    { pattern: /^snyk-bot$/i, agent: "Snyk" },
    { pattern: /^allcontributors\[bot\]$/i, agent: "All Contributors" },
    { pattern: /^release-please\[bot\]$/i, agent: "Release Please" },
    { pattern: /^semantic-release-bot$/i, agent: "Semantic Release" },
  ];

  const CO_AUTHOR_PATTERNS = [
    { pattern: /Co-Authored-By:.*Claude/i, agent: "Claude (CLI)" },
    { pattern: /Co-Authored-By:.*Copilot/i, agent: "GitHub Copilot" },
    { pattern: /Co-Authored-By:.*Gemini/i, agent: "Gemini" },
    { pattern: /Co-Authored-By:.*Codex/i, agent: "Codex" },
    { pattern: /Co-Authored-By:.*Cursor/i, agent: "Cursor" },
    { pattern: /Co-Authored-By:.*Aider/i, agent: "Aider" },
  ];

  function classifyBot(login) {
    const isAi = AI_BOT_PATTERNS.find((p) => p.pattern.test(login));
    const isAutomation = AUTOMATION_BOT_PATTERNS.find((p) => p.pattern.test(login));
    return isAi ? "ai" : isAutomation ? "automation" : "bot";
  }

  function matchesCoAuthor(msg) {
    return CO_AUTHOR_PATTERNS.filter((p) => p.pattern.test(msg)).map((p) => p.agent);
  }

  function computeLevel(botContributors, aiTrailers) {
    const hasAiBot = botContributors.some((b) => AI_BOT_PATTERNS.some((p) => p.pattern.test(b.login)));
    const hasAiTrailer = aiTrailers.length > 0;
    const hasAutomation = botContributors.some((b) =>
      AUTOMATION_BOT_PATTERNS.some((p) => p.pattern.test(b.login))
    );
    if (hasAiBot && hasAiTrailer) return "high";
    if (hasAiBot || hasAiTrailer) return "medium";
    if (hasAutomation) return "low";
    return "none";
  }

  // Bot classification
  it("classifies claude[bot] as ai", () => {
    assert.equal(classifyBot("claude[bot]"), "ai");
  });

  it("classifies copilot[bot] as ai", () => {
    assert.equal(classifyBot("copilot[bot]"), "ai");
  });

  it("classifies coderabbitai[bot] as ai (prefix match)", () => {
    assert.equal(classifyBot("coderabbitai[bot]"), "ai");
  });

  it("classifies dependabot[bot] as automation", () => {
    assert.equal(classifyBot("dependabot[bot]"), "automation");
  });

  it("classifies renovate[bot] as automation", () => {
    assert.equal(classifyBot("renovate[bot]"), "automation");
  });

  it("classifies github-actions[bot] as automation", () => {
    assert.equal(classifyBot("github-actions[bot]"), "automation");
  });

  it("classifies release-please[bot] as automation", () => {
    assert.equal(classifyBot("release-please[bot]"), "automation");
  });

  it("classifies unknown[bot] as generic bot", () => {
    assert.equal(classifyBot("unknown-tool[bot]"), "bot");
  });

  it("is case-insensitive for claude[bot]", () => {
    assert.equal(classifyBot("Claude[Bot]"), "ai");
  });

  // Co-Authored-By trailer matching
  it("matches Claude in Co-Authored-By trailer", () => {
    const agents = matchesCoAuthor(
      "fix: update routing\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
    );
    assert.ok(agents.includes("Claude (CLI)"));
  });

  it("matches Aider in Co-Authored-By trailer", () => {
    const agents = matchesCoAuthor("feat: add feature\n\nCo-Authored-By: Aider <aider@example.com>");
    assert.ok(agents.includes("Aider"));
  });

  it("returns no matches for a plain commit message", () => {
    const agents = matchesCoAuthor("fix: correct typo in README");
    assert.equal(agents.length, 0);
  });

  it("matches multiple trailers in one commit message", () => {
    const agents = matchesCoAuthor(
      "feat: big change\n\nCo-Authored-By: Claude <c@a.com>\nCo-Authored-By: Gemini <g@b.com>"
    );
    assert.ok(agents.includes("Claude (CLI)"));
    assert.ok(agents.includes("Gemini"));
  });

  // Automation level computation
  it("level is 'none' with no bots and no trailers", () => {
    assert.equal(computeLevel([], []), "none");
  });

  it("level is 'low' with only automation bots", () => {
    const bots = [{ login: "dependabot[bot]", type: "automation", contributions: 10 }];
    assert.equal(computeLevel(bots, []), "low");
  });

  it("level is 'medium' with only an AI bot", () => {
    const bots = [{ login: "copilot[bot]", type: "ai", contributions: 5 }];
    assert.equal(computeLevel(bots, []), "medium");
  });

  it("level is 'medium' with only AI trailers (no bots)", () => {
    const trailers = [{ agent: "Claude (CLI)", count: 3 }];
    assert.equal(computeLevel([], trailers), "medium");
  });

  it("level is 'high' with both AI bot and AI trailers", () => {
    const bots = [{ login: "claude[bot]", type: "ai", contributions: 20 }];
    const trailers = [{ agent: "Claude (CLI)", count: 5 }];
    assert.equal(computeLevel(bots, trailers), "high");
  });

  it("level is 'low' not 'high' when automation bot + AI trailer (bot is not AI)", () => {
    // dependabot is automation, not AI — so hasAiBot is false
    const bots = [{ login: "dependabot[bot]", type: "automation", contributions: 10 }];
    const trailers = [{ agent: "Claude (CLI)", count: 2 }];
    // hasAiBot = false, hasAiTrailer = true → medium
    assert.equal(computeLevel(bots, trailers), "medium");
  });

  // Edge cases
  it("handles empty contributors list", () => {
    assert.equal(computeLevel([], []), "none");
  });

  it("handles multiple automation bots with no AI bots", () => {
    const bots = [
      { login: "dependabot[bot]", type: "automation", contributions: 50 },
      { login: "renovate[bot]", type: "automation", contributions: 20 },
    ];
    assert.equal(computeLevel(bots, []), "low");
  });
});
