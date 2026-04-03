import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectCI,
  detectDependencyUpdates,
  detectCodeOwnership,
  detectSecurityPolicy,
  detectLicense,
  detectCodeScanning,
  detectSecretScanning,
} from "../dist/detectors.js";

/**
 * Helper: create a mock RepoTree from a list of file paths.
 * All entries are blobs (files) by default.
 */
function mockTree(paths) {
  return { tree: paths.map((p) => ({ path: p, type: "blob" })) };
}

// ── CI Detection ────────────────────────────────────────────────────────────

describe("detectCI", () => {
  it("detects GitHub Actions", () => {
    const result = detectCI(mockTree([".github/workflows/ci.yml"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /GitHub Actions/);
  });

  it("detects Jenkins via Jenkinsfile", () => {
    const result = detectCI(mockTree(["Jenkinsfile", "src/main.py"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /Jenkins/);
  });

  it("detects CircleCI", () => {
    const result = detectCI(mockTree([".circleci/config.yml"]));
    assert.equal(result.detected, true);
  });

  it("detects Travis CI", () => {
    const result = detectCI(mockTree([".travis.yml"]));
    assert.equal(result.detected, true);
  });

  it("detects Azure Pipelines", () => {
    const result = detectCI(mockTree(["azure-pipelines.yml"]));
    assert.equal(result.detected, true);
  });

  it("detects Buildkite", () => {
    const result = detectCI(mockTree([".buildkite/pipeline.yml"]));
    assert.equal(result.detected, true);
  });

  it("detects GitLab CI", () => {
    const result = detectCI(mockTree([".gitlab-ci.yml"]));
    assert.equal(result.detected, true);
  });

  it("detects Prow via OWNERS + Makefile", () => {
    const result = detectCI(mockTree(["OWNERS", "Makefile"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /Prow/);
  });

  it("detects Concourse via ci/pipeline.yml", () => {
    const result = detectCI(mockTree(["ci/pipeline.yml"]));
    assert.equal(result.detected, true);
  });

  it("detects AppVeyor", () => {
    const result = detectCI(mockTree(["appveyor.yml"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /AppVeyor/);
  });

  it("detects Zuul", () => {
    const result = detectCI(mockTree([".zuul.yaml"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /Zuul/);
  });

  it("returns false for no CI files", () => {
    const result = detectCI(mockTree(["README.md", "src/index.ts"]));
    assert.equal(result.detected, false);
    assert.match(result.detail, /No CI/);
  });

  it("returns false for empty tree", () => {
    const result = detectCI(mockTree([]));
    assert.equal(result.detected, false);
  });
});

// ── Dependency Update Detection ─────────────────────────────────────────────

describe("detectDependencyUpdates", () => {
  it("detects Dependabot", () => {
    const result = detectDependencyUpdates(
      mockTree([".github/dependabot.yml"])
    );
    assert.equal(result.detected, true);
    assert.match(result.detail, /Dependabot/);
  });

  it("detects Renovate at root", () => {
    const result = detectDependencyUpdates(mockTree(["renovate.json"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /Renovate/);
  });

  it("detects Renovate in .github/", () => {
    const result = detectDependencyUpdates(
      mockTree([".github/renovate.json"])
    );
    assert.equal(result.detected, true);
  });

  it("detects .renovaterc", () => {
    const result = detectDependencyUpdates(mockTree([".renovaterc"]));
    assert.equal(result.detected, true);
  });

  it("returns false when no updater configured", () => {
    const result = detectDependencyUpdates(mockTree(["package.json"]));
    assert.equal(result.detected, false);
  });

  it("returns false for empty tree", () => {
    const result = detectDependencyUpdates(mockTree([]));
    assert.equal(result.detected, false);
  });
});

// ── Code Ownership Detection ────────────────────────────────────────────────

describe("detectCodeOwnership", () => {
  it("detects CODEOWNERS at root", () => {
    const result = detectCodeOwnership(mockTree(["CODEOWNERS"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /CODEOWNERS/);
  });

  it("detects .github/CODEOWNERS", () => {
    const result = detectCodeOwnership(mockTree([".github/CODEOWNERS"]));
    assert.equal(result.detected, true);
  });

  it("detects OWNERS (Kubernetes-style)", () => {
    const result = detectCodeOwnership(mockTree(["OWNERS"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /Kubernetes/i);
  });

  it("detects MAINTAINERS file", () => {
    const result = detectCodeOwnership(mockTree(["MAINTAINERS"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /MAINTAINERS/);
  });

  it("detects MAINTAINERS.md", () => {
    const result = detectCodeOwnership(mockTree(["MAINTAINERS.md"]));
    assert.equal(result.detected, true);
  });

  it("returns false when none present", () => {
    const result = detectCodeOwnership(mockTree(["README.md"]));
    assert.equal(result.detected, false);
  });
});

// ── Security Policy Detection ───────────────────────────────────────────────

describe("detectSecurityPolicy", () => {
  it("detects SECURITY.md", () => {
    const result = detectSecurityPolicy(mockTree(["SECURITY.md"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /SECURITY\.md/);
  });

  it("detects SECURITY.rst", () => {
    const result = detectSecurityPolicy(mockTree(["SECURITY.rst"]));
    assert.equal(result.detected, true);
  });

  it("detects .github/SECURITY.md", () => {
    const result = detectSecurityPolicy(mockTree([".github/SECURITY.md"]));
    assert.equal(result.detected, true);
  });

  it("detects SECURITY_CONTACTS", () => {
    const result = detectSecurityPolicy(mockTree(["SECURITY_CONTACTS"]));
    assert.equal(result.detected, true);
  });

  it("returns false when none present", () => {
    const result = detectSecurityPolicy(mockTree(["README.md"]));
    assert.equal(result.detected, false);
  });

  it("returns false for empty tree", () => {
    const result = detectSecurityPolicy(mockTree([]));
    assert.equal(result.detected, false);
  });
});

// ── Code Scanning / SAST Detection ─────────────────────────────────────────

describe("detectCodeScanning", () => {
  it("detects CodeQL workflow by filename pattern", () => {
    const result = detectCodeScanning(
      mockTree([".github/workflows/codeql-analysis.yml"])
    );
    assert.equal(result.detected, true);
    assert.match(result.detail, /CodeQL/);
  });

  it("detects CodeQL workflow in workflows directory", () => {
    const result = detectCodeScanning(
      mockTree([".github/workflows/codeql.yaml"])
    );
    assert.equal(result.detected, true);
  });

  it("detects code-scanning workflow", () => {
    const result = detectCodeScanning(
      mockTree([".github/workflows/code-scanning.yml"])
    );
    assert.equal(result.detected, true);
    assert.match(result.detail, /[Cc]ode.scanning/);
  });

  it("detects CodeQL config file", () => {
    const result = detectCodeScanning(
      mockTree([".github/codeql/codeql-config.yml"])
    );
    assert.equal(result.detected, true);
    assert.match(result.detail, /CodeQL config/);
  });

  it("returns false when no code scanning present", () => {
    const result = detectCodeScanning(
      mockTree(["README.md", ".github/workflows/ci.yml"])
    );
    assert.equal(result.detected, false);
    assert.match(result.detail, /No SAST/);
  });

  it("returns false for empty tree", () => {
    const result = detectCodeScanning(mockTree([]));
    assert.equal(result.detected, false);
  });
});

// ── Secret Scanning Detection ───────────────────────────────────────────────

describe("detectSecretScanning", () => {
  it("detects .github/secret-scanning.yml", () => {
    const result = detectSecretScanning(
      mockTree([".github/secret-scanning.yml"])
    );
    assert.equal(result.detected, true);
    assert.match(result.detail, /[Ss]ecret scanning/);
  });

  it("detects Gitleaks config", () => {
    const result = detectSecretScanning(mockTree([".gitleaks.toml"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /Gitleaks/);
  });

  it("detects detect-secrets baseline", () => {
    const result = detectSecretScanning(mockTree([".secrets.baseline"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /detect-secrets/);
  });

  it("detects TruffleHog config", () => {
    const result = detectSecretScanning(mockTree([".trufflehogignore"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /TruffleHog/);
  });

  it("returns false when no secret scanning present", () => {
    const result = detectSecretScanning(mockTree(["README.md", ".gitignore"]));
    assert.equal(result.detected, false);
    assert.match(result.detail, /No secret scanning/);
  });

  it("returns false for empty tree", () => {
    const result = detectSecretScanning(mockTree([]));
    assert.equal(result.detected, false);
  });
});

// ── License Detection ───────────────────────────────────────────────────────

describe("detectLicense", () => {
  it("detects LICENSE", () => {
    const result = detectLicense(mockTree(["LICENSE"]));
    assert.equal(result.detected, true);
  });

  it("detects LICENSE.md", () => {
    const result = detectLicense(mockTree(["LICENSE.md"]));
    assert.equal(result.detected, true);
  });

  it("detects COPYING", () => {
    const result = detectLicense(mockTree(["COPYING"]));
    assert.equal(result.detected, true);
  });

  it("detects LICENCE (British spelling)", () => {
    const result = detectLicense(mockTree(["LICENCE"]));
    assert.equal(result.detected, true);
  });

  it("detects licenses/ directory", () => {
    const result = detectLicense(mockTree(["licenses/MIT.txt"]));
    assert.equal(result.detected, true);
    assert.match(result.detail, /licenses/);
  });

  it("returns false when none present", () => {
    const result = detectLicense(mockTree(["README.md"]));
    assert.equal(result.detected, false);
  });

  it("returns false for empty tree", () => {
    const result = detectLicense(mockTree([]));
    assert.equal(result.detected, false);
  });
});
