# Agent Instructions — repo-health-report

This document provides guidance for AI agents (Claude Code, Codex, Gemini CLI, etc.) working in this repository.

## Project Overview

`repo-health-report` is a CLI (runtime dep: chalk) that analyzes GitHub repository health across 6 dimensions using pure static analysis via the GitHub API. Optional `--ai` flag generates a nexus-agents vote proposal. No cloning, no secrets beyond `gh auth`.

## Repository Structure

```
src/
  aggregate.ts      — Batch result aggregation
  ai-analysis.ts    — --ai flag: vote proposal generation for nexus-agents
  ai-contributors.ts — AI-generated contributor analysis
  analyze.ts        — GitHub API calls (fetchRepoMeta, fetchRepoTree)
  batch.ts          — Parallel batch processing with caching
  cache.ts          — File-based caching layer
  cli.ts            — Entry point, argument parsing, orchestration
  debrief.ts        — Lessons-learned debrief command
  detectors.ts      — Multi-ecosystem file/pattern detectors
  explain.ts        — --explain flag: per-finding score breakdown
  export.ts         — Dashboard JSON export
  external-apis.ts  — OpenSSF Scorecard + deps.dev integration
  grader.ts         — Score → letter grade computation
  platform-apis.ts  — Multi-platform API abstraction
  platforms.ts      — Platform detection (GitHub, GitLab, Codeberg)
  render.ts         — Terminal color output
  report.ts         — Markdown report generation
  dimensions/
    architecture.ts — Architecture checks (types, linting, formatting, structure)
    devops.ts       — DevOps checks (CI/CD, Docker, releases, templates)
    docs.ts         — Documentation checks (README, LICENSE, CONTRIBUTING, etc.)
    maintenance.ts  — Maintenance checks (bus factor, funding, release cadence)
    security.ts     — Security checks (SECURITY.md, Dependabot, CODEOWNERS, etc.)
    testing.ts      — Testing checks (CI, test files, coverage, pre-commit)
tests/
  ai-contributors.test.js — Tests for AI contributor analysis
  cache.test.js           — Tests for caching layer
  detectors.test.js       — Tests for multi-ecosystem detectors
  explain.test.js         — Tests for explain output
  external-apis.test.js   — Tests for OpenSSF/deps.dev integration
  grader.test.js          — Tests for grading logic (node:test, no framework)
  platforms.test.js       — Tests for platform detection
dist/               — Compiled JS output (from tsc)
```

## Commands

```bash
npm run build       # Compile TypeScript → dist/
npm test            # Run tests (node --test)
npx tsc --noEmit    # Type check without emitting
```

## Development Principles

- **No new dependencies** — the project has one runtime dep (chalk). Keep it that way unless there is a strong reason.
- **Tests use node:test** — the built-in Node.js test runner. No vitest, jest, or mocha.
- **Tests run against dist/** — always build before running tests. Tests import `../dist/grader.js`, not TypeScript source.
- **No silent failures** — all errors are caught and reported with a clear message. Never swallow exceptions.
- **Deterministic output** — given the same repo state, the tool always produces the same score.

## Grading Scale

| Letter | Overall Score |
|--------|--------------|
| A      | >= 90        |
| B      | 80 – 89      |
| C      | 70 – 79      |
| D      | 60 – 69      |
| F      | < 60         |

## Adding a New Dimension Check

1. Open the relevant file in `src/dimensions/`.
2. Add a new check object to the `checks` array.
3. Each check has: `name`, `description`, `weight` (points), and a test against `tree` (file paths) or `meta`.
4. Update the dimension's `maxScore` if adding points.
5. Add a test case to `tests/grader.test.js` if the grading logic changes.
6. Run `npm run build && npm test` to verify.

## CI

GitHub Actions runs on every push and pull request:
- `build` job: type checks and runs the test suite.
- `self-report` job (after build): runs the tool against this repo itself as a live integration check.

The `GH_TOKEN` secret is automatically provided by GitHub Actions — no manual setup needed.

## Security

- Never hardcode tokens or secrets.
- The tool uses `gh api` subprocess calls — all inputs are validated before use.
- GitHub CLI handles authentication; no direct HTTP token handling in the source.

## Out of Scope for Agents

- Do not add runtime dependencies without explicit human approval.
- Do not modify the CI self-report job to run against a different repo.
- Do not change the grading scale without updating both `src/grader.ts` and `tests/grader.test.js`.
