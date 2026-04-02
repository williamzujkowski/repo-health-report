import { execFile, execFileSync } from "node:child_process";

const NEXUS_TIMEOUT_MS = 120_000;

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

/**
 * Check if nexus-agents CLI is installed and available.
 */
export function isNexusAvailable(): boolean {
  try {
    execFileSync("nexus-agents", ["--version"], {
      timeout: 5000,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a nexus-agents CLI command and return its stdout.
 */
async function runNexus(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "nexus-agents",
      args,
      { timeout: NEXUS_TIMEOUT_MS, maxBuffer: 5 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr.trim() || error.message;
          reject(new Error(`nexus-agents ${args[0] ?? ""} failed: ${msg}`));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

/**
 * Parse a JSON response from nexus-agents output.
 * Scans for the first '{' in case there is preamble text before the JSON.
 * Returns null if the output cannot be parsed.
 */
function tryParseJson(output: string): Record<string, unknown> | null {
  const start = output.indexOf("{");
  if (start === -1) return null;
  try {
    return JSON.parse(output.slice(start)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Run AI expert analysis on a repo using nexus-agents orchestrate.
 * Each dimension gets its own focused expert prompt.
 * Invalid or unavailable scores are returned as -1.
 */
export async function analyzeWithExperts(
  slug: string,
  staticSummary: string
): Promise<ExpertResult[]> {
  const dimensions = [
    "Security",
    "Testing",
    "Documentation",
    "Architecture",
    "DevOps",
  ];

  const results: ExpertResult[] = [];

  for (const dim of dimensions) {
    const prompt = [
      `Analyze the ${dim.toLowerCase()} posture of GitHub repo: ${slug}.`,
      `Static analysis findings: ${staticSummary}`,
      `Focus only on ${dim} concerns.`,
      `Respond with JSON: {"score": <0-100>, "confidence": <0-1>, "analysis": "<1-2 sentences>"}`,
    ].join(" ");

    try {
      const raw = await runNexus(["orchestrate", prompt]);
      const parsed = tryParseJson(raw);
      const score =
        typeof parsed?.["score"] === "number" ? parsed["score"] : 50;
      const confidence =
        typeof parsed?.["confidence"] === "number"
          ? parsed["confidence"]
          : 0.5;
      const analysis =
        typeof parsed?.["analysis"] === "string"
          ? parsed["analysis"]
          : raw.slice(0, 300);

      results.push({
        dimension: dim,
        analysis,
        score: Math.min(100, Math.max(0, Math.round(score))),
        confidence: Math.min(1, Math.max(0, confidence)),
      });
    } catch (err) {
      results.push({
        dimension: dim,
        analysis: `Analysis unavailable: ${(err as Error).message.slice(0, 100)}`,
        score: -1,
        confidence: 0,
      });
    }
  }

  return results;
}

/**
 * Run a consensus vote on the overall health grade via nexus-agents vote.
 */
export async function voteOnGrade(
  slug: string,
  staticLetter: string,
  staticScore: number,
  expertResults: ExpertResult[]
): Promise<ConsensusResult> {
  const expertSummary = expertResults
    .filter((e) => e.score >= 0)
    .map(
      (e) =>
        `${e.dimension}: ${e.score}/100 (confidence ${(e.confidence * 100).toFixed(0)}%)`
    )
    .join(", ");

  const proposal = [
    `Grade GitHub repo ${slug} overall as "${staticLetter}" (${staticScore}/100).`,
    expertSummary
      ? `Expert AI analysis: ${expertSummary}.`
      : "Expert AI analysis unavailable.",
    `Should the grade of ${staticLetter} be accepted?`,
  ].join(" ");

  const raw = await runNexus([
    "vote",
    "--proposal",
    proposal,
    "--threshold",
    "majority",
    "--quick",
  ]);

  const parsed = tryParseJson(raw);

  const approvalPct =
    typeof parsed?.["approvalPercentage"] === "number"
      ? parsed["approvalPercentage"]
      : typeof parsed?.["approval"] === "number"
        ? (parsed["approval"] as number)
        : 60;

  const reasoning =
    typeof parsed?.["reasoning"] === "string"
      ? parsed["reasoning"]
      : typeof parsed?.["summary"] === "string"
        ? (parsed["summary"] as string)
        : raw.slice(0, 400);

  return {
    grade: staticLetter,
    reasoning,
    approvalPercentage: Math.min(100, Math.max(0, Math.round(approvalPct))),
  };
}

/**
 * Build a plain-text summary of static findings for use as AI context.
 */
export function buildStaticSummary(
  dimensions: Array<{ name: string; score: number; findings: Array<{ name: string; passed: boolean }> }>
): string {
  return dimensions
    .map((d) => {
      const failed = d.findings
        .filter((f) => !f.passed)
        .map((f) => f.name)
        .join(", ");
      return `${d.name} ${d.score}/100${failed ? ` (issues: ${failed})` : ""}`;
    })
    .join("; ");
}

/**
 * Run the full AI analysis pipeline.
 * Always fails gracefully — static analysis continues to work without this.
 */
export async function runAiAnalysis(
  slug: string,
  staticLetter: string,
  staticScore: number,
  staticSummary: string
): Promise<AiAnalysisResult> {
  if (!isNexusAvailable()) {
    return {
      available: false,
      experts: [],
      consensus: null,
      error:
        "nexus-agents CLI not found. Install it to enable AI analysis.",
    };
  }

  try {
    const experts = await analyzeWithExperts(slug, staticSummary);

    let consensus: ConsensusResult | null = null;
    try {
      consensus = await voteOnGrade(
        slug,
        staticLetter,
        staticScore,
        experts
      );
    } catch (voteErr) {
      // Consensus vote is optional — expert results alone are still useful
      process.stderr.write(
        `  [AI] Consensus vote failed: ${(voteErr as Error).message.slice(0, 100)}\n`
      );
    }

    return { available: true, experts, consensus };
  } catch (err) {
    return {
      available: true,
      experts: [],
      consensus: null,
      error: (err as Error).message,
    };
  }
}
