# repo-health-report

Analyze any GitHub repository's health across 5 dimensions and generate a color-coded terminal report with a markdown file.

**Pure static analysis via the GitHub API. No AI APIs, no cloning, no secrets required.**

## Quick Start

```bash
# Requires: gh CLI installed and authenticated (gh auth login)
npx repo-health-report williamzujkowski/nexus-agents
```

Or with a full URL:

```bash
npx repo-health-report https://github.com/facebook/react
```

## Example Output

```
  Repo Health Report: williamzujkowski/nexus-agents
  ──────────────────────────────────────────────────

  Overall Grade: A (94/100)

  Security         ████████████████████ 100/100
  Testing          ████████████████████ 100/100
  Documentation    ████████████████████ 100/100
  Architecture     ████████████████████ 100/100
  DevOps           ██████████████░░░░░░  70/100

  Findings:
  ──────────────────────────────────────────────────

  Security
    ✔ Security policy (SECURITY.md)
    ✔ Dependency update automation
    ✔ CODEOWNERS file
    ...
```

A markdown report (`health-report.md`) is also written with a full findings table and prioritized recommendations.

## What It Checks

### Security (0-100)
- SECURITY.md vulnerability disclosure policy
- Dependabot or Renovate for dependency updates
- CODEOWNERS for review enforcement
- No committed `.env` files
- `.gitignore` present
- CI workflows (branch protection proxy)

### Testing (0-100)
- GitHub Actions or other CI workflows
- Test files (test/, __tests__, *.test.*, *.spec.*)
- Coverage/test runner configuration (vitest, jest, pytest, etc.)
- Test scripts in package.json (or language-equivalent)
- Pre-commit hooks (Husky, pre-commit)

### Documentation (0-100)
- README.md quality (existence and length)
- LICENSE file
- CONTRIBUTING.md
- CHANGELOG
- docs/ directory or API documentation
- Repository description on GitHub

### Architecture (0-100)
- Type safety (TypeScript, mypy, Rust, Go, Java)
- Linter configuration (ESLint, flake8, ruff, clippy, biome)
- Code formatter (Prettier, editorconfig, rustfmt, black)
- Organized source structure (src/, lib/, packages/)
- Monorepo tooling (if applicable)
- Build configuration

### DevOps (0-100)
- CI/CD pipeline (GitHub Actions, Travis, CircleCI, Jenkins, GitLab CI)
- Docker support (Dockerfile, Compose)
- Release automation (semantic-release, changesets)
- Issue/PR templates
- Deployment/Infrastructure config (Terraform, k8s, Vercel, Fly, etc.)

## CLI Options

```
repo-health-report <owner/repo | URL>

Options:
  --output, -o <file>   Write markdown report to file (default: health-report.md)
  --no-file             Skip writing markdown file
  --json                Output JSON instead of terminal rendering
  --help, -h            Show help
```

## Requirements

- **[GitHub CLI (`gh`)](https://cli.github.com/)** installed and authenticated
- Node.js 18+

The tool uses `gh api` to fetch repository data. It never clones repos or requires any API keys beyond your GitHub authentication.

## How It Works

1. Fetches repo metadata and full file tree via the GitHub API
2. Runs 5 analysis dimensions in parallel (pattern matching on the file tree)
3. Fetches specific file contents when needed (README length, package.json scripts)
4. Computes weighted scores per dimension and an overall letter grade
5. Renders a color-coded terminal report and writes a markdown file

All analysis is deterministic. The same repo will always produce the same score (unless the repo changes).

## Related

Built to work alongside [nexus-agents](https://github.com/williamzujkowski/nexus-agents), a multi-agent orchestration system with 24 MCP tools for coordinating Claude, Gemini, Codex, and OpenCode.

## License

MIT
