# Scoring Formula

This document describes how repo-health-report computes health scores and grades.

## Overview

Each repository is evaluated across **6 dimensions**. Each dimension produces a score from 0-100 based on individual findings (checks). The overall score is a weighted average of dimension scores, with weights determined by the detected **project type**.

## Dimensions

### 1. Security

Checks for supply-chain and vulnerability disclosure practices.

| Check | Weight | What it looks for |
|-------|--------|-------------------|
| Security policy (SECURITY.md) | 25 | SECURITY.md with contact info and disclosure process |
| Pinned dependencies (Actions SHA) | 15 | GitHub Actions pinned to full commit SHAs |
| Token permissions | 10 | Explicit restrictive `permissions:` in workflows |
| Dependency update automation | 15 | Dependabot or Renovate configured |
| Code ownership | 5 | CODEOWNERS, OWNERS, or MAINTAINERS file |
| No committed .env files | 10 | Absence of .env files in the tree |
| .gitignore present | 10 | .gitignore exists |
| CI workflows (branch protection proxy) | 10 | Any CI system detected |

### 2. Testing

Checks for test infrastructure and coverage. Adapts to project type (application, IaC, documentation).

**Application projects:**

| Check | Weight | What it looks for |
|-------|--------|-------------------|
| CI workflows | 25 | Any CI system detected |
| Test files | 25 | Files matching test patterns (__tests__, .test., .spec., tests/) |
| Coverage configuration | 20 | Coverage tool configs (nyc, jest, vitest, codecov, etc.) |
| Test runner configured | 15 | Test script in package.json, pytest, cargo, or go.mod |
| Pre-commit hooks | 5 | Husky or pre-commit-config |

**IaC projects:** Checks for Terratest, validation scripts, kitchen-terraform, InSpec, pre-commit hooks.

**Documentation projects:** Checks for CI, markdown linting, link checking, spell checking.

### 3. Documentation

Checks for user-facing and contributor documentation.

| Check | Weight | What it looks for |
|-------|--------|-------------------|
| README quality | 30 | README exists and is >500 characters |
| LICENSE file | 20 | LICENSE, LICENCE, COPYING, or licenses/ directory |
| CONTRIBUTING guide | 15 | CONTRIBUTING.md or .github/CONTRIBUTING.md |
| CHANGELOG | 15 | CHANGELOG.md, CHANGES, HISTORY, NEWS, or release-notes |
| Documentation directory or API docs | 10 | docs/, doc/, or API.md |
| Repository description | 10 | GitHub repo description is set |

### 4. Architecture

Language-aware checks for code quality tooling and project structure. Supports: TypeScript, JavaScript, Python, Go, Rust, Java, Shell, C/C++, Ruby, and a generic fallback.

Common checks across languages:

| Check | Typical Weight | What it looks for |
|-------|---------------|-------------------|
| Type safety | 20 | Language-appropriate type checking (tsconfig, mypy, built-in) |
| Linter | 20 | ESLint, Biome, ruff, golangci-lint, Clippy, etc. |
| Code formatter | 15 | Prettier, black, gofmt, rustfmt, clang-format, etc. |
| Source structure | 20 | Organized directory layout (src/, lib/, cmd/, packages/) |
| Build configuration | 10 | Build tool present (tsconfig, Cargo.toml, Makefile, etc.) |

**IaC projects:** Checks for tflint, terraform fmt, module structure, conventions, version pinning.

**Documentation projects:** Checks for README structure, file organization, contributing guidelines, license, formatting config.

### 5. DevOps

Checks for CI/CD, deployment, and project management infrastructure.

**Application projects:**

| Check | Weight | What it looks for |
|-------|--------|-------------------|
| CI/CD pipeline | 30 | GitHub Actions, GitLab CI, CircleCI, Jenkins, etc. |
| Container support (Docker) | 20 | Dockerfile or docker-compose |
| Release automation | 20 | semantic-release, changesets, release workflows |
| Issue/PR templates | 15 | .github/ISSUE_TEMPLATE or PR templates |
| Deployment/Infrastructure config | 5 | Terraform, k8s, Helm, Makefile, etc. |

**IaC projects:** Checks for CI/CD, task runners, templates, environment config, changelog.

**Documentation projects:** Checks for CI, issue templates, PR templates, automation tools.

### 6. Maintenance

Checks for ongoing project health and sustainability signals.

| Check | Weight | What it looks for |
|-------|--------|-------------------|
| Last commit recency | 30 | Last commit within 30 days (full weight) or 90 days (partial) |
| Open issue freshness | 15 | Median open issue age under 90 days |
| Recent releases | 20 | Latest release/tag within 180 days; flags release hygiene gaps |
| Bus factor | 20 | Number of contributors with >5% of commits (4+ is healthy) |
| Community adoption (stars) | 5 | 10+ stars indicates community interest |
| Maintainer funding | 10* | FUNDING.yml present (*weight is 0 if absent -- not penalized) |

The "Recent releases" check also detects:
- **Release hygiene gap**: Latest release is >1 year old but the repo has recent commits
- **No release process**: The repo has commits but has never published a release or tag

## Dimension Scoring

Each dimension's score is computed as:

```
dimension_score = round(earned_weight / total_weight * 100)
```

Where `earned_weight` is the sum of weights for passing checks, and `total_weight` is the sum of all check weights in that dimension.

## Weight Profiles by Project Type

The overall score uses a weighted average of dimension scores. Weights vary by detected project type:

| Dimension | application | library | iac | hybrid | documentation | runtime | mirror |
|-----------|------------|---------|-----|--------|---------------|---------|--------|
| Security | 1.0 | 0.8 | 1.5 | 1.2 | 0.3 | 0.5 | 0.3 |
| Testing | 1.0 | 1.2 | 0.8 | 1.0 | 0.5 | 0.8 | 0.5 |
| Documentation | 1.0 | 1.5 | 1.0 | 1.0 | 2.0 | 1.5 | 1.5 |
| Architecture | 1.0 | 1.0 | 1.5 | 1.2 | 1.5 | 0.5 | 0.5 |
| DevOps | 1.0 | 0.5 | 0.8 | 1.0 | 0.5 | 0.5 | 0.2 |
| Maintenance | 1.0 | 1.0 | 0.8 | 0.8 | 0.5 | 1.5 | 1.5 |

## Overall Score

```
overall = round(sum(dimension_score * weight) / sum(weight))
```

## Grade Scale

| Grade | Score Range |
|-------|------------|
| A | >= 90 |
| B | >= 80 |
| C | >= 70 |
| D | >= 60 |
| F | < 60 |

**Documentation** and **mirror** project types receive a numeric score but are not assigned a letter grade (shown as "N/A"), since standard code metrics do not meaningfully apply.

## CLI Usage

Use `--explain` to see the full scoring breakdown in the terminal:

```bash
repo-health-report owner/repo --explain
```

This shows the weight profile, per-dimension contributions, and which grade threshold was matched.
