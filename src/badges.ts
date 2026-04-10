/**
 * Generate shields.io endpoint badge JSON files for all analyzed repos.
 * Output: data/dashboard/badges/{owner}--{repo}.json
 *
 * Usage: node dist/badges.js
 *
 * shields.io endpoint schema:
 * { schemaVersion: 1, label: "health", message: "A (94)", color: "green" }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface LeaderboardRepo {
  slug: string;
  grade: string;
  score: number;
  graded: boolean;
}

interface ShieldsBadge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": return "brightgreen";
    case "B": return "blue";
    case "C": return "yellow";
    case "D": return "orange";
    case "F": return "red";
    default: return "lightgrey";
  }
}

function generateBadge(repo: LeaderboardRepo): ShieldsBadge {
  if (!repo.graded) {
    return { schemaVersion: 1, label: "health", message: "N/A", color: "lightgrey" };
  }
  return {
    schemaVersion: 1,
    label: "health",
    message: `${repo.grade} (${repo.score})`,
    color: gradeColor(repo.grade),
  };
}

const leaderboardPath = join(process.cwd(), "data/dashboard/leaderboard-slim.json");
if (!existsSync(leaderboardPath)) {
  console.error("No leaderboard data found. Run analysis first.");
  process.exit(1);
}

const leaderboard = JSON.parse(readFileSync(leaderboardPath, "utf8"));
const repos: LeaderboardRepo[] = leaderboard.repos;

const badgeDir = join(process.cwd(), "data/dashboard/badges");
mkdirSync(badgeDir, { recursive: true });

let count = 0;
for (const repo of repos) {
  const badge = generateBadge(repo);
  const filename = repo.slug.replace("/", "--") + ".json";
  writeFileSync(join(badgeDir, filename), JSON.stringify(badge));
  count++;
}

console.log(`Generated ${count} badge files in ${badgeDir}`);
