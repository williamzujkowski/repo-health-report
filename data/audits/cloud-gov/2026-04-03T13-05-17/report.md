# Org Audit: cloud-gov

**Analyzed:** 2026-04-03T13:05:17.807Z

## Executive Summary

| Metric | Value |
|--------|-------|
| Total repos | 118 |
| Graded repos | 112 |
| Average score | 51/100 |
| Grade distribution | A:0 B:7 C:8 D:12 F:85 |

### Dimension Averages

| Dimension | Average Score |
|-----------|--------------|
| Security | 63/100 |
| Testing | 31/100 |
| Documentation | 67/100 |
| Architecture | 30/100 |
| DevOps | 36/100 |
| Maintenance | 59/100 |

## Top Risks

### High

- **Pre-commit hooks** — 107 repos (96%) [ci-testing]
  - Add pre-commit hooks (husky, pre-commit, lefthook)
- **Release automation** — 106 repos (99%) [ci-testing]
  - Set up automated releases (semantic-release, changesets)
- **Deployment/Infrastructure config** — 99 repos (93%) [ci-testing]
  - Add deployment or infrastructure configuration
- **Coverage configuration** — 95 repos (89%) [ci-testing]
  - Configure test coverage reporting
- **Test files** — 73 repos (68%) [ci-testing]
  - Add test files for the project
- **Test runner configured** — 72 repos (67%) [ci-testing]
  - Configure a test runner in the build scripts
- **Container support (Docker)** — 71 repos (66%) [ci-testing]
  - Add a Dockerfile for containerized builds

### Medium

- **Dependency update automation** — 109 repos (92%) [supply-chain]
  - Enable Dependabot or Renovate for automated dependency updates
- **CHANGELOG** — 107 repos (91%) [documentation]
  - Add a CHANGELOG to track releases
- **Documentation directory or API docs** — 101 repos (86%) [documentation]
  - Add a docs/ directory or API documentation
- **CI workflows (branch protection proxy)** — 57 repos (48%) [ci-testing]
  - Add CI workflows to enable branch protection
- **CI workflows** — 53 repos (50%) [ci-testing]
  - Add CI workflow files (.github/workflows/)
- **Issue/PR templates** — 50 repos (45%) [ci-testing]
  - Add issue and PR templates
- **CI/CD pipeline** — 49 repos (44%) [ci-testing]
  - Set up a CI/CD pipeline (GitHub Actions recommended)
- **Code formatter (shfmt / editorconfig)** — 33 repos (100%) [other]
  - Address: Code formatter (shfmt / editorconfig)
- **Linter (ShellCheck)** — 32 repos (97%) [other]
  - Address: Linter (ShellCheck)
- **Build runner (Makefile)** — 31 repos (94%) [other]
  - Address: Build runner (Makefile)
- **Test framework (bats / shunit2)** — 30 repos (91%) [other]
  - Address: Test framework (bats / shunit2)
- **Code formatter** — 21 repos (91%) [architecture]
  - Add a code formatter configuration
- **Modular script structure (lib/ or src/)** — 20 repos (61%) [other]
  - Address: Modular script structure (lib/ or src/)
- **Linter (golangci-lint)** — 20 repos (100%) [other]
  - Address: Linter (golangci-lint)
- **Go version pinning (.go-version / go.work)** — 20 repos (100%) [other]
  - Address: Go version pinning (.go-version / go.work)
- **Linter (ESLint / Biome)** — 19 repos (79%) [other]
  - Address: Linter (ESLint / Biome)
- **Type safety (tsconfig / jsconfig)** — 17 repos (94%) [other]
  - Address: Type safety (tsconfig / jsconfig)
- **Build runner (Makefile / Taskfile)** — 17 repos (85%) [other]
  - Address: Build runner (Makefile / Taskfile)
- **Build configuration** — 14 repos (42%) [architecture]
  - Add a build configuration file
- **Organized source structure** — 13 repos (45%) [architecture]
  - Organize code into src/, lib/, or packages/ structure
- **Type checking (mypy / pyright)** — 11 repos (73%) [other]
  - Address: Type checking (mypy / pyright)
- **Code formatter (black / ruff / yapf)** — 11 repos (73%) [other]
  - Address: Code formatter (black / ruff / yapf)
- **Linter (ruff / flake8 / pylint)** — 10 repos (67%) [other]
  - Address: Linter (ruff / flake8 / pylint)
- **Package structure (cmd/, pkg/, internal/)** — 9 repos (45%) [other]
  - Address: Package structure (cmd/, pkg/, internal/)
- **Build configuration (pyproject.toml / setup.py)** — 8 repos (53%) [other]
  - Address: Build configuration (pyproject.toml / setup.py)
- **Type safety (Sorbet / RBS)** — 6 repos (100%) [other]
  - Address: Type safety (Sorbet / RBS)
- **Linter (RuboCop)** — 6 repos (100%) [other]
  - Address: Linter (RuboCop)
- **Code formatter (RuboCop / editorconfig)** — 6 repos (100%) [other]
  - Address: Code formatter (RuboCop / editorconfig)
- **Source structure (lib/ or app/)** — 6 repos (100%) [other]
  - Address: Source structure (lib/ or app/)
- **Markdown linting (markdownlint / pymarkdown)** — 6 repos (100%) [other]
  - Address: Markdown linting (markdownlint / pymarkdown)
- **Link checking (lychee / markdown-link-check)** — 6 repos (100%) [other]
  - Address: Link checking (lychee / markdown-link-check)
- **Spell check (cspell / aspell / codespell)** — 6 repos (100%) [other]
  - Address: Spell check (cspell / aspell / codespell)
- **Consistent formatting (.editorconfig / markdownlint)** — 6 repos (100%) [other]
  - Address: Consistent formatting (.editorconfig / markdownlint)
- **Compliance testing (kitchen-terraform / inspec)** — 5 repos (100%) [other]
  - Address: Compliance testing (kitchen-terraform / inspec)
- **IaC linter (tflint)** — 5 repos (100%) [other]
  - Address: IaC linter (tflint)
- **Module structure** — 5 repos (100%) [other]
  - Address: Module structure
- **Terraform version pinning** — 5 repos (100%) [other]
  - Address: Terraform version pinning
- **Environment / workspace config** — 5 repos (100%) [other]
  - Address: Environment / workspace config
- **Changelog / release tracking** — 5 repos (100%) [other]
  - Address: Changelog / release tracking
- **Type safety** — 5 repos (100%) [architecture]
  - Add type checking (TypeScript, mypy, etc.)
- **Linter configuration** — 5 repos (100%) [architecture]
  - Add a linter configuration file
- **Linter (Checkstyle / PMD / SpotBugs)** — 4 repos (100%) [other]
  - Address: Linter (Checkstyle / PMD / SpotBugs)
- **Standard Maven layout (src/main/java)** — 4 repos (100%) [other]
  - Address: Standard Maven layout (src/main/java)
- **CI workflow (for automated checks)** — 4 repos (67%) [other]
  - Address: CI workflow (for automated checks)
- **CI/CD pipeline (automated checks)** — 4 repos (67%) [other]
  - Address: CI/CD pipeline (automated checks)
- **Issue templates (for contribution requests)** — 4 repos (67%) [other]
  - Address: Issue templates (for contribution requests)
- **Automation tools (awesome-lint / scripts / Makefile)** — 4 repos (67%) [other]
  - Address: Automation tools (awesome-lint / scripts / Makefile)
- **Terratest / Go tests** — 4 repos (80%) [other]
  - Address: Terratest / Go tests
- **Terraform formatting (terraform fmt)** — 4 repos (80%) [other]
  - Address: Terraform formatting (terraform fmt)
- **Build/task runner (Makefile)** — 4 repos (80%) [other]
  - Address: Build/task runner (Makefile)
- **Code formatter (google-java-format / Spotless)** — 3 repos (75%) [other]
  - Address: Code formatter (google-java-format / Spotless)
- **Build configuration (Gemfile / Rakefile)** — 3 repos (50%) [other]
  - Address: Build configuration (Gemfile / Rakefile)
- **[IaC] Compliance testing (kitchen-terraform / inspec)** — 3 repos (100%) [other]
  - Address: [IaC] Compliance testing (kitchen-terraform / inspec)
- **[IaC] Pre-commit hooks** — 3 repos (100%) [other]
  - Address: [IaC] Pre-commit hooks
- **[IaC] IaC linter (tflint)** — 3 repos (100%) [other]
  - Address: [IaC] IaC linter (tflint)
- **[IaC] Terraform formatting (terraform fmt)** — 3 repos (100%) [other]
  - Address: [IaC] Terraform formatting (terraform fmt)
- **[IaC] Module structure** — 3 repos (100%) [other]
  - Address: [IaC] Module structure
- **[IaC] Terraform version pinning** — 3 repos (100%) [other]
  - Address: [IaC] Terraform version pinning
- **[IaC] Environment / workspace config** — 3 repos (100%) [other]
  - Address: [IaC] Environment / workspace config
- **PR template (for new additions)** — 3 repos (50%) [other]
  - Address: PR template (for new additions)
- **Validation script (terraform validate)** — 3 repos (60%) [other]
  - Address: Validation script (terraform validate)
- **Terraform conventions (variables.tf / outputs.tf)** — 3 repos (60%) [other]
  - Address: Terraform conventions (variables.tf / outputs.tf)
- **Task runner (Makefile / scripts)** — 3 repos (60%) [other]
  - Address: Task runner (Makefile / scripts)
- **Type safety (built-in + build tool)** — 2 repos (50%) [other]
  - Address: Type safety (built-in + build tool)
- **[IaC] Validation script (terraform validate)** — 2 repos (67%) [other]
  - Address: [IaC] Validation script (terraform validate)
- **[IaC] Build/task runner (Makefile)** — 2 repos (67%) [other]
  - Address: [IaC] Build/task runner (Makefile)
- **[IaC] Task runner (Makefile / scripts)** — 2 repos (67%) [other]
  - Address: [IaC] Task runner (Makefile / scripts)
- **[IaC] Changelog / release tracking** — 2 repos (67%) [other]
  - Address: [IaC] Changelog / release tracking

## Quick Wins

Findings that fail >80% of repos — high-impact fixes:

- [ ] **Pre-commit hooks** (96% fail rate) — Add pre-commit hooks (husky, pre-commit, lefthook)
- [ ] **Release automation** (99% fail rate) — Set up automated releases (semantic-release, changesets)
- [ ] **Deployment/Infrastructure config** (93% fail rate) — Add deployment or infrastructure configuration
- [ ] **Coverage configuration** (89% fail rate) — Configure test coverage reporting
- [ ] **Dependency update automation** (92% fail rate) — Enable Dependabot or Renovate for automated dependency updates
- [ ] **CHANGELOG** (91% fail rate) — Add a CHANGELOG to track releases
- [ ] **Documentation directory or API docs** (86% fail rate) — Add a docs/ directory or API documentation
- [ ] **Code formatter (shfmt / editorconfig)** (100% fail rate) — Address: Code formatter (shfmt / editorconfig)
- [ ] **Linter (ShellCheck)** (97% fail rate) — Address: Linter (ShellCheck)
- [ ] **Build runner (Makefile)** (94% fail rate) — Address: Build runner (Makefile)
- [ ] **Test framework (bats / shunit2)** (91% fail rate) — Address: Test framework (bats / shunit2)
- [ ] **Code formatter** (91% fail rate) — Add a code formatter configuration
- [ ] **Linter (golangci-lint)** (100% fail rate) — Address: Linter (golangci-lint)
- [ ] **Go version pinning (.go-version / go.work)** (100% fail rate) — Address: Go version pinning (.go-version / go.work)
- [ ] **Type safety (tsconfig / jsconfig)** (94% fail rate) — Address: Type safety (tsconfig / jsconfig)
- [ ] **Build runner (Makefile / Taskfile)** (85% fail rate) — Address: Build runner (Makefile / Taskfile)
- [ ] **Type safety (Sorbet / RBS)** (100% fail rate) — Address: Type safety (Sorbet / RBS)
- [ ] **Linter (RuboCop)** (100% fail rate) — Address: Linter (RuboCop)
- [ ] **Code formatter (RuboCop / editorconfig)** (100% fail rate) — Address: Code formatter (RuboCop / editorconfig)
- [ ] **Source structure (lib/ or app/)** (100% fail rate) — Address: Source structure (lib/ or app/)
- [ ] **Markdown linting (markdownlint / pymarkdown)** (100% fail rate) — Address: Markdown linting (markdownlint / pymarkdown)
- [ ] **Link checking (lychee / markdown-link-check)** (100% fail rate) — Address: Link checking (lychee / markdown-link-check)
- [ ] **Spell check (cspell / aspell / codespell)** (100% fail rate) — Address: Spell check (cspell / aspell / codespell)
- [ ] **Consistent formatting (.editorconfig / markdownlint)** (100% fail rate) — Address: Consistent formatting (.editorconfig / markdownlint)
- [ ] **Compliance testing (kitchen-terraform / inspec)** (100% fail rate) — Address: Compliance testing (kitchen-terraform / inspec)
- [ ] **IaC linter (tflint)** (100% fail rate) — Address: IaC linter (tflint)
- [ ] **Module structure** (100% fail rate) — Address: Module structure
- [ ] **Terraform version pinning** (100% fail rate) — Address: Terraform version pinning
- [ ] **Environment / workspace config** (100% fail rate) — Address: Environment / workspace config
- [ ] **Changelog / release tracking** (100% fail rate) — Address: Changelog / release tracking
- [ ] **Type safety** (100% fail rate) — Add type checking (TypeScript, mypy, etc.)
- [ ] **Linter configuration** (100% fail rate) — Add a linter configuration file
- [ ] **Linter (Checkstyle / PMD / SpotBugs)** (100% fail rate) — Address: Linter (Checkstyle / PMD / SpotBugs)
- [ ] **Standard Maven layout (src/main/java)** (100% fail rate) — Address: Standard Maven layout (src/main/java)
- [ ] **[IaC] Compliance testing (kitchen-terraform / inspec)** (100% fail rate) — Address: [IaC] Compliance testing (kitchen-terraform / inspec)
- [ ] **[IaC] Pre-commit hooks** (100% fail rate) — Address: [IaC] Pre-commit hooks
- [ ] **[IaC] IaC linter (tflint)** (100% fail rate) — Address: [IaC] IaC linter (tflint)
- [ ] **[IaC] Terraform formatting (terraform fmt)** (100% fail rate) — Address: [IaC] Terraform formatting (terraform fmt)
- [ ] **[IaC] Module structure** (100% fail rate) — Address: [IaC] Module structure
- [ ] **[IaC] Terraform version pinning** (100% fail rate) — Address: [IaC] Terraform version pinning
- [ ] **[IaC] Environment / workspace config** (100% fail rate) — Address: [IaC] Environment / workspace config
- [ ] **Maintainer funding** (100% fail rate) — Address: Maintainer funding
- [ ] **Recent releases** (92% fail rate) — Address: Recent releases
- [ ] **Community adoption (stars)** (86% fail rate) — Address: Community adoption (stars)

## Per-Repo Grades

| Repo | Grade | Score | Language | Type |
|------|-------|-------|----------|------|
| uaa-bot | B | 84 | Python | application |
| pages-core | B | 83 | JavaScript | library |
| django-uaa | B | 82 | Python | application |
| security-considerations-action | B | 82 | TypeScript | application |
| pages-site-gantry | B | 82 | TypeScript | application |
| pages-editor | B | 81 | TypeScript | application |
| ubuntu-mirror | N/A | 80 | — | documentation |
| cg-ui | B | 80 | TypeScript | application |
| uaa-extras | C | 79 | Python | application |
| pages-redirects | C | 79 | JavaScript | library |
| external-domain-broker | C | 79 | Python | application |
| pages-build-container | C | 75 | Python | application |
| pages-bot | C | 75 | JavaScript | application |
| purge-sandboxes | C | 73 | Go | application |
| cvd-sync | N/A | 72 | Shell | documentation |
| caulking | C | 71 | Shell | application |
| aws_opensearch_preprocess_lambdas | C | 71 | Python | application |
| terraform-provision | D | 69 | HCL | iac |
| buildpack-notify | D | 69 | Go | application |
| pages-proxy | D | 67 | JavaScript | application |
| github-pr-resource | D | 67 | Go | application |
| sandbox-bot | D | 66 | Ruby | application |
| compliance-docs | N/A | 66 | Makefile | documentation |
| playwright-python | N/A | 66 | Shell | documentation |
| pages-mailer | D | 65 | JavaScript | application |
| billing | D | 65 | Go | hybrid |
| s3-broker | D | 64 | Go | application |
| .github | N/A | 64 | — | documentation |
| csb | D | 63 | HCL | iac |
| nessus-manager-boshrelease | D | 61 | Shell | application |
| cf-service-connect | D | 61 | Go | application |
| stratos | D | 60 | TypeScript | application |
| snort-boshrelease | F | 59 | Shell | application |
| Shibboleth-IdP3-TOTP-Auth | F | 59 | Java | application |
| cert-check | F | 59 | Python | application |
| deploy-shibboleth | F | 58 | Python | application |
| login-migrator-bot | F | 58 | Ruby | application |
| aws-broker | F | 57 | Go | hybrid |
| deploy-logsearch | F | 57 | Shell | application |
| manage-rds | F | 57 | Python | application |
| pages-cf-build-tasks | F | 56 | JavaScript | application |
| github-release-resource | F | 56 | Go | application |
| deploy-platform-opensearch | F | 56 | Python | application |
| deploy-postfix | F | 55 | Shell | application |
| deploy-logs-opensearch | F | 55 | Python | application |
| site | F | 55 | Astro | application |
| uaa-customized-boshrelease | F | 53 | CSS | application |
| deploy-opsuaa | F | 53 | — | application |
| deploy-stratos | F | 53 | HTML | application |
| secureproxy-boshrelease | F | 52 | Perl | application |
| uaa-credentials-broker | F | 52 | Go | application |
| opensearch-alerting | F | 52 | Kotlin | application |
| s3-simple-resource | F | 51 | Shell | application |
| deploy-nessus-manager | F | 51 | — | application |
| deploy-s3-broker | F | 51 | Shell | application |
| deploy-prometheus | F | 51 | Python | application |
| deploy-autoscaler | F | 51 | Shell | application |
| cf-hello-worlds | F | 50 | Java | application |
| deploy-bosh | F | 49 | Shell | application |
| aws-elasticsearch-example | F | 49 | Python | application |
| zap-runner | F | 49 | Dockerfile | application |
| general-task | F | 48 | Shell | library |
| s3-resource | F | 48 | Go | application |
| deploy-doomsday | F | 48 | — | application |
| deploy-credhub | F | 48 | HCL | iac |
| oci-build-task | F | 48 | Go | application |
| clamav-rest-image | F | 48 | Shell | application |
| deploy-cf | F | 47 | Shell | iac |
| doomsday | F | 47 | Go | application |
| python3-boshrelease | F | 46 | Shell | application |
| pages-uswds-11ty | F | 46 | HTML | application |
| common-pipelines | F | 46 | Dockerfile | application |
| demo-cg-identity | F | 46 | JavaScript | application |
| go-broker-tags | F | 45 | Go | application |
| pages-images | F | 45 | Shell | application |
| opensearch-notifications | F | 45 | Kotlin | application |
| nessus-agent-boshrelease | F | 44 | Shell | application |
| laboratory | F | 44 | Go | application |
| cg-scripts | F | 43 | Python | library |
| metrics-dashboard | F | 43 | JavaScript | application |
| slack-notification-resource | F | 43 | Shell | application |
| pages-example-api-website | F | 43 | HTML | application |
| cf-resource | F | 43 | Go | application |
| mysql-8-stig-overlay | F | 43 | Ruby | application |
| deploy-concourse | F | 42 | Shell | iac |
| bosh-deployment-resource | F | 42 | Go | application |
| postgres-client-boshrelease | F | 42 | Shell | application |
| pages-uswds-gatsby | F | 41 | JavaScript | application |
| opensearch-boshrelease | F | 41 | HTML | application |
| deploy-defectdojo | F | 41 | Shell | application |
| godojo | F | 41 | Go | application |
| pages-pipeline-tasks | F | 41 | Shell | application |
| intranet-demo | F | 41 | Shell | application |
| pipeline-tasks | F | 40 | Shell | application |
| shibboleth-boshrelease | F | 40 | HTML | application |
| oauth2-proxy-boshrelease | F | 40 | Shell | application |
| aide-boshrelease | F | 40 | Shell | application |
| cg-cli-tools | F | 40 | Shell | application |
| logsearch-for-cloudfoundry | F | 39 | HTML | application |
| pages-example-website-api | F | 39 | Python | application |
| go-cfenv | F | 39 | Go | application |
| harden-boshrelease | F | 37 | Shell | application |
| pages-example-spa | F | 37 | JavaScript | application |
| logsearch-boshrelease | F | 34 | Shell | hybrid |
| cron-resource | F | 34 | Go | application |
| cron-boshrelease | F | 34 | Shell | application |
| cf-common | F | 34 | — | application |
| clamav-boshrelease | F | 33 | Shell | application |
| defectdojo-boshrelease | F | 33 | HTML | application |
| postfix-boshrelease | F | 32 | Shell | application |
| upload-github-to-s3 | F | 32 | Shell | application |
| wordpress-example | F | 31 | PHP | application |
| pages-404-page | N/A | 30 | HTML | documentation |
| homebrew-cloudgov | F | 28 | Ruby | application |
| ubuntu-hardened | F | 23 | Shell | library |
| demo-walk-through | F | 20 | Shell | application |
| concourse-locks | F | 20 | — | application |
| .allstar | F | 17 | — | application |

## Recommendations

### Quick Wins (high impact, low effort)

1. **Pre-commit hooks** — Add pre-commit hooks (husky, pre-commit, lefthook) (affects 107 repos)
1. **Release automation** — Set up automated releases (semantic-release, changesets) (affects 106 repos)
1. **Deployment/Infrastructure config** — Add deployment or infrastructure configuration (affects 99 repos)
1. **Coverage configuration** — Configure test coverage reporting (affects 95 repos)

### Medium Effort

1. **Dependency update automation** — Enable Dependabot or Renovate for automated dependency updates (affects 109 repos)
1. **CHANGELOG** — Add a CHANGELOG to track releases (affects 107 repos)
1. **Documentation directory or API docs** — Add a docs/ directory or API documentation (affects 101 repos)
1. **Code formatter (shfmt / editorconfig)** — Address: Code formatter (shfmt / editorconfig) (affects 33 repos)
1. **Linter (ShellCheck)** — Address: Linter (ShellCheck) (affects 32 repos)
1. **Build runner (Makefile)** — Address: Build runner (Makefile) (affects 31 repos)
1. **Test framework (bats / shunit2)** — Address: Test framework (bats / shunit2) (affects 30 repos)
1. **Code formatter** — Add a code formatter configuration (affects 21 repos)
1. **Modular script structure (lib/ or src/)** — Address: Modular script structure (lib/ or src/) (affects 20 repos)
1. **Linter (golangci-lint)** — Address: Linter (golangci-lint) (affects 20 repos)
1. **Go version pinning (.go-version / go.work)** — Address: Go version pinning (.go-version / go.work) (affects 20 repos)
1. **Linter (ESLint / Biome)** — Address: Linter (ESLint / Biome) (affects 19 repos)
1. **Type safety (tsconfig / jsconfig)** — Address: Type safety (tsconfig / jsconfig) (affects 17 repos)
1. **Build runner (Makefile / Taskfile)** — Address: Build runner (Makefile / Taskfile) (affects 17 repos)
1. **Type checking (mypy / pyright)** — Address: Type checking (mypy / pyright) (affects 11 repos)
1. **Code formatter (black / ruff / yapf)** — Address: Code formatter (black / ruff / yapf) (affects 11 repos)
1. **Linter (ruff / flake8 / pylint)** — Address: Linter (ruff / flake8 / pylint) (affects 10 repos)
1. **Build configuration (pyproject.toml / setup.py)** — Address: Build configuration (pyproject.toml / setup.py) (affects 8 repos)
1. **Type safety (Sorbet / RBS)** — Address: Type safety (Sorbet / RBS) (affects 6 repos)
1. **Linter (RuboCop)** — Address: Linter (RuboCop) (affects 6 repos)
1. **Code formatter (RuboCop / editorconfig)** — Address: Code formatter (RuboCop / editorconfig) (affects 6 repos)
1. **Source structure (lib/ or app/)** — Address: Source structure (lib/ or app/) (affects 6 repos)
1. **Markdown linting (markdownlint / pymarkdown)** — Address: Markdown linting (markdownlint / pymarkdown) (affects 6 repos)
1. **Link checking (lychee / markdown-link-check)** — Address: Link checking (lychee / markdown-link-check) (affects 6 repos)
1. **Spell check (cspell / aspell / codespell)** — Address: Spell check (cspell / aspell / codespell) (affects 6 repos)
1. **Consistent formatting (.editorconfig / markdownlint)** — Address: Consistent formatting (.editorconfig / markdownlint) (affects 6 repos)
1. **Compliance testing (kitchen-terraform / inspec)** — Address: Compliance testing (kitchen-terraform / inspec) (affects 5 repos)
1. **IaC linter (tflint)** — Address: IaC linter (tflint) (affects 5 repos)
1. **Module structure** — Address: Module structure (affects 5 repos)
1. **Terraform version pinning** — Address: Terraform version pinning (affects 5 repos)
1. **Environment / workspace config** — Address: Environment / workspace config (affects 5 repos)
1. **Changelog / release tracking** — Address: Changelog / release tracking (affects 5 repos)
1. **Type safety** — Add type checking (TypeScript, mypy, etc.) (affects 5 repos)
1. **Linter configuration** — Add a linter configuration file (affects 5 repos)
1. **Linter (Checkstyle / PMD / SpotBugs)** — Address: Linter (Checkstyle / PMD / SpotBugs) (affects 4 repos)
1. **Standard Maven layout (src/main/java)** — Address: Standard Maven layout (src/main/java) (affects 4 repos)
1. **CI workflow (for automated checks)** — Address: CI workflow (for automated checks) (affects 4 repos)
1. **CI/CD pipeline (automated checks)** — Address: CI/CD pipeline (automated checks) (affects 4 repos)
1. **Issue templates (for contribution requests)** — Address: Issue templates (for contribution requests) (affects 4 repos)
1. **Automation tools (awesome-lint / scripts / Makefile)** — Address: Automation tools (awesome-lint / scripts / Makefile) (affects 4 repos)
1. **Terratest / Go tests** — Address: Terratest / Go tests (affects 4 repos)
1. **Terraform formatting (terraform fmt)** — Address: Terraform formatting (terraform fmt) (affects 4 repos)
1. **Build/task runner (Makefile)** — Address: Build/task runner (Makefile) (affects 4 repos)
1. **Code formatter (google-java-format / Spotless)** — Address: Code formatter (google-java-format / Spotless) (affects 3 repos)
1. **[IaC] Compliance testing (kitchen-terraform / inspec)** — Address: [IaC] Compliance testing (kitchen-terraform / inspec) (affects 3 repos)
1. **[IaC] Pre-commit hooks** — Address: [IaC] Pre-commit hooks (affects 3 repos)
1. **[IaC] IaC linter (tflint)** — Address: [IaC] IaC linter (tflint) (affects 3 repos)
1. **[IaC] Terraform formatting (terraform fmt)** — Address: [IaC] Terraform formatting (terraform fmt) (affects 3 repos)
1. **[IaC] Module structure** — Address: [IaC] Module structure (affects 3 repos)
1. **[IaC] Terraform version pinning** — Address: [IaC] Terraform version pinning (affects 3 repos)
1. **[IaC] Environment / workspace config** — Address: [IaC] Environment / workspace config (affects 3 repos)
1. **Validation script (terraform validate)** — Address: Validation script (terraform validate) (affects 3 repos)
1. **Terraform conventions (variables.tf / outputs.tf)** — Address: Terraform conventions (variables.tf / outputs.tf) (affects 3 repos)
1. **Task runner (Makefile / scripts)** — Address: Task runner (Makefile / scripts) (affects 3 repos)
1. **[IaC] Validation script (terraform validate)** — Address: [IaC] Validation script (terraform validate) (affects 2 repos)
1. **[IaC] Build/task runner (Makefile)** — Address: [IaC] Build/task runner (Makefile) (affects 2 repos)
1. **[IaC] Task runner (Makefile / scripts)** — Address: [IaC] Task runner (Makefile / scripts) (affects 2 repos)
1. **[IaC] Changelog / release tracking** — Address: [IaC] Changelog / release tracking (affects 2 repos)

### Strategic (long-term improvement)

1. **CI workflows (branch protection proxy)** — Add CI workflows to enable branch protection (affects 57 repos)
1. **CI workflows** — Add CI workflow files (.github/workflows/) (affects 53 repos)
1. **Issue/PR templates** — Add issue and PR templates (affects 50 repos)
1. **CI/CD pipeline** — Set up a CI/CD pipeline (GitHub Actions recommended) (affects 49 repos)
1. **Build configuration** — Add a build configuration file (affects 14 repos)
1. **Organized source structure** — Organize code into src/, lib/, or packages/ structure (affects 13 repos)
1. **Package structure (cmd/, pkg/, internal/)** — Address: Package structure (cmd/, pkg/, internal/) (affects 9 repos)
1. **Build configuration (Gemfile / Rakefile)** — Address: Build configuration (Gemfile / Rakefile) (affects 3 repos)
1. **PR template (for new additions)** — Address: PR template (for new additions) (affects 3 repos)
1. **Type safety (built-in + build tool)** — Address: Type safety (built-in + build tool) (affects 2 repos)
1. **Maintainer funding** — Address: Maintainer funding (affects 118 repos)
1. **Recent releases** — Address: Recent releases (affects 108 repos)
1. **Community adoption (stars)** — Address: Community adoption (stars) (affects 101 repos)
1. **Open issue freshness** — Address: Open issue freshness (affects 60 repos)
1. **Security policy (SECURITY.md)** — Add a SECURITY.md with vulnerability disclosure instructions (affects 29 repos)
1. **README quality** — Improve README.md with description, install steps, and usage examples (affects 19 repos)
1. **CONTRIBUTING guide** — Add a CONTRIBUTING.md guide (affects 19 repos)
1. **.gitignore present** — Add a .gitignore file appropriate for the project language (affects 18 repos)
1. **Repository description** — Set the repository description on GitHub (affects 18 repos)
1. **Last commit recency** — Address: Last commit recency (affects 15 repos)
1. **Pinned dependencies (Actions SHA)** — Pin all GitHub Actions to full commit SHA (affects 12 repos)
1. **LICENSE file** — Add a LICENSE file (affects 10 repos)
1. **Token permissions** — Add explicit permissions block to GitHub Actions workflows (affects 9 repos)
1. **Bus factor** — Address: Bus factor (affects 6 repos)
1. **Package structure (src/ or package layout)** — Address: Package structure (src/ or package layout) (affects 4 repos)
1. **No committed .env files** — Remove committed .env files and add to .gitignore (affects 3 repos)
1. **Organized file structure (category directories)** — Address: Organized file structure (category directories) (affects 2 repos)
1. **Code ownership** — Add a CODEOWNERS file to enforce review requirements (affects 1 repos)
1. **[IaC] CI pipeline** — Address: [IaC] CI pipeline (affects 1 repos)
1. **[IaC] Terratest / Go tests** — Address: [IaC] Terratest / Go tests (affects 1 repos)
1. **Type safety (built-in + go.mod)** — Address: Type safety (built-in + go.mod) (affects 1 repos)
1. **Code formatter (gofmt — built-in)** — Address: Code formatter (gofmt — built-in) (affects 1 repos)
1. **[IaC] Terraform conventions (variables.tf / outputs.tf)** — Address: [IaC] Terraform conventions (variables.tf / outputs.tf) (affects 1 repos)
1. **[IaC] CI/CD pipeline** — Address: [IaC] CI/CD pipeline (affects 1 repos)
1. **[IaC] Issue/PR templates** — Address: [IaC] Issue/PR templates (affects 1 repos)
1. **License (LICENSE file)** — Address: License (LICENSE file) (affects 1 repos)
1. **Code formatter (Prettier / Biome)** — Address: Code formatter (Prettier / Biome) (affects 1 repos)
