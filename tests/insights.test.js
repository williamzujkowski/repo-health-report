import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { generateInsights } = await import("../dist/insights.js");

// Minimal stubs — only the fields generateInsights reads
function makeGrade(overrides = {}) {
  return {
    letter: "B",
    overall: 70,
    graded: true,
    dimensions: [],
    totalDurationMs: 500,
    ...overrides,
  };
}

function makeAnalytics(overrides = {}) {
  return {
    fileCount: 100,
    directoryCount: 10,
    maxDepth: 4,
    avgFilesPerDir: 10,
    testFileCount: 10,
    sourceFileCount: 50,
    testToSourceRatio: 0.2,
    markdownFileCount: 5,
    docFileCount: 2,
    dependencyFiles: ["package.json"],
    dependencyFileCount: 1,
    isMonorepo: false,
    configFiles: [],
    configScore: 5,
    hasVendorCommitted: false,
    hasDistCommitted: false,
    hasMinifiedFiles: false,
    hasDotEnvCommitted: false,
    antiPatternCount: 0,
    sizeCategory: "medium",
    ...overrides,
  };
}

function makeLanguages(overrides = {}) {
  return {
    primary: "TypeScript",
    all: [
      { language: "TypeScript", fileCount: 80, percentage: 80 },
      { language: "JavaScript", fileCount: 20, percentage: 20 },
    ],
    ...overrides,
  };
}

function makeMeta(overrides = {}) {
  return {
    name: "repo",
    description: null,
    default_branch: "main",
    language: "TypeScript",
    stargazers_count: 100,
    forks_count: 10,
    open_issues_count: 5,
    license: null,
    ...overrides,
  };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe("generateInsights", () => {
  describe("test culture", () => {
    it("returns positive insight for excellent test ratio (>=0.8)", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ testToSourceRatio: 1.13 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("test-to-source ratio"));
      assert.ok(found, "Expected a testing insight");
      assert.equal(found.category, "positive");
      assert.ok(found.text.includes("Excellent testing culture"));
    });

    it("returns critical insight when no test files detected (ratio 0)", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ testToSourceRatio: 0 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("No test files"));
      assert.ok(found, "Expected a no-tests critical insight");
      assert.equal(found.category, "critical");
    });

    it("returns warning insight for low test ratio (<0.2 but >0)", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ testToSourceRatio: 0.1 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("Low test coverage"));
      assert.ok(found, "Expected a low-test-coverage warning");
      assert.equal(found.category, "warning");
    });

    it("returns no test insight for ratio between 0.2 and 0.8", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ testToSourceRatio: 0.5 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("test"));
      assert.equal(found, undefined, "No test insight expected for mid-range ratio");
    });
  });

  describe("config maturity", () => {
    it("returns positive insight for high config score (>=8)", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ configScore: 10 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("operational config maturity"));
      assert.ok(found);
      assert.equal(found.category, "positive");
      assert.ok(found.text.includes("10/10"));
    });

    it("returns warning insight for low config score (<=3)", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ configScore: 2 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("operational maturity"));
      assert.ok(found);
      assert.equal(found.category, "warning");
    });

    it("returns no config insight for score 4-7", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ configScore: 5 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("config maturity") || i.text.includes("operational maturity"));
      assert.equal(found, undefined);
    });
  });

  describe("anti-patterns", () => {
    it("returns warning for vendor committed", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ hasVendorCommitted: true }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("vendor/"));
      assert.ok(found);
      assert.equal(found.category, "warning");
    });

    it("returns critical for .env committed", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ hasDotEnvCommitted: true }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes(".env"));
      assert.ok(found);
      assert.equal(found.category, "critical");
    });

    it("returns warning for dist committed", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ hasDistCommitted: true }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("dist/"));
      assert.ok(found);
      assert.equal(found.category, "warning");
    });
  });

  describe("monorepo", () => {
    it("returns positive insight when isMonorepo is true", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ isMonorepo: true, dependencyFileCount: 7 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("Monorepo structure"));
      assert.ok(found);
      assert.equal(found.category, "positive");
      assert.ok(found.text.includes("7 dependency manifests"));
    });

    it("returns no monorepo insight when isMonorepo is false", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ isMonorepo: false }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("Monorepo"));
      assert.equal(found, undefined);
    });
  });

  describe("multi-language", () => {
    it("returns polyglot insight when 3+ languages", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics(),
        makeLanguages({
          all: [
            { language: "TypeScript", fileCount: 60, percentage: 60 },
            { language: "Python", fileCount: 25, percentage: 25 },
            { language: "Go", fileCount: 15, percentage: 15 },
          ],
        }),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("Polyglot"));
      assert.ok(found);
      assert.equal(found.category, "positive");
      assert.ok(found.text.includes("TypeScript 60%"));
    });

    it("returns no polyglot insight when fewer than 3 languages", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics(),
        makeLanguages({ all: [{ language: "TypeScript", fileCount: 100, percentage: 100 }] }),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("Polyglot"));
      assert.equal(found, undefined);
    });
  });

  describe("size", () => {
    it("returns warning for massive codebase", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics({ sizeCategory: "massive", fileCount: 6000 }),
        makeLanguages(),
        makeMeta()
      );
      const found = insights.find((i) => i.text.includes("Very large codebase"));
      assert.ok(found);
      assert.equal(found.category, "warning");
      assert.ok(found.text.includes("6,000 files"));
    });

    it("returns no size insight for non-massive repos", () => {
      for (const cat of ["tiny", "small", "medium", "large"]) {
        const insights = generateInsights(
          makeGrade(),
          makeAnalytics({ sizeCategory: cat }),
          makeLanguages(),
          makeMeta()
        );
        const found = insights.find((i) => i.text.includes("large codebase"));
        assert.equal(found, undefined, `Expected no size insight for ${cat}`);
      }
    });
  });

  describe("age / maturity", () => {
    it("returns positive insight for projects 5+ years old", () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 6);
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics(),
        makeLanguages(),
        makeMeta({ created_at: oldDate.toISOString() })
      );
      const found = insights.find((i) => i.text.includes("Mature project"));
      assert.ok(found);
      assert.equal(found.category, "positive");
    });

    it("returns no maturity insight for projects under 5 years old", () => {
      const newDate = new Date();
      newDate.setFullYear(newDate.getFullYear() - 2);
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics(),
        makeLanguages(),
        makeMeta({ created_at: newDate.toISOString() })
      );
      const found = insights.find((i) => i.text.includes("Mature project"));
      assert.equal(found, undefined);
    });

    it("returns no maturity insight when created_at is missing", () => {
      const insights = generateInsights(
        makeGrade(),
        makeAnalytics(),
        makeLanguages(),
        makeMeta({ created_at: undefined })
      );
      const found = insights.find((i) => i.text.includes("Mature project"));
      assert.equal(found, undefined);
    });
  });

  it("returns empty array when all metrics are neutral", () => {
    // testToSourceRatio between 0.2-0.8, configScore 4-7, no anti-patterns,
    // no monorepo, <3 languages, small/medium/large size, <5yr old
    const insights = generateInsights(
      makeGrade(),
      makeAnalytics({
        testToSourceRatio: 0.5,
        configScore: 5,
        isMonorepo: false,
        hasVendorCommitted: false,
        hasDotEnvCommitted: false,
        hasDistCommitted: false,
        sizeCategory: "medium",
      }),
      makeLanguages({ all: [{ language: "TypeScript", fileCount: 100, percentage: 100 }] }),
      makeMeta({ created_at: new Date().toISOString() })
    );
    assert.equal(insights.length, 0);
  });
});
