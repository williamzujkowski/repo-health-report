# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-04-03

### Added
- Dashboard website (Astro 6 + Svelte 5 + Tailwind CSS 4)
- Multi-platform support (GitHub, GitLab, Codeberg)
- OpenSSF Scorecard + deps.dev integration
- 7 project types (application, iac, hybrid, library, documentation, runtime, mirror)
- 9 language-specific architecture checks
- 12 CI system detectors
- Maintenance dimension (bus factor, funding, release cadence)
- Size-adjusted scoring for small repos
- Per-type dimension weights
- Parallel batch processing with caching
- Dashboard data export (JSON API format)
- Debrief command for lessons-learned analysis
- 143 unit tests

### Changed
- GraphQL metadata fetching (3x efficiency vs REST)
- Transparent scoring with --explain flag
- SCORING.md documentation

## [1.0.0] - 2026-04-01

### Added
- Initial release: 5-dimension health analysis
- GitHub API-based static analysis
- CLI with color-coded output
- Markdown report generation
