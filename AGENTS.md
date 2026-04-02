# Agent Instructions — repo-health-report

This document provides guidance for AI agents (Claude Code, Codex, Gemini CLI, etc.) working in this repository.

## Project Overview

`repo-health-report` is a zero-dependency CLI that analyzes GitHub repository health across 5 dimensions using pure static analysis via the GitHub API. No AI, no cloning, no secrets beyond `gh auth`.

## Repository Structure

```
src/
  cli.ts            — Entry point, argument parsing, orchestration
  analyze.ts        — GitHub API calls (fetchRepoMeta, fetchRepoTree)
  grader.ts         — Score → letter grade computation
  render.ts         — Terminal color output
  report.ts         — Markdown report generation
  dimensions/
    security.ts     — Security checks (SECURITY.md, Dependabot, CODEOWNERS, etc.)
    testing.ts      — Testing checks (CI, test files, coverage, pre-commit)
    docs.ts         — Documentation checks (README, LICENSE, CONTRIBUTING, etc.)
    architecture.ts — Architecture checks (types, linting, formatting, structure)
    devops.ts       — DevOps checks (CI/CD, Docker, releases, templates)
tests/
  grader.test.js    — Tests for grading logic (node:test, no framework)
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
