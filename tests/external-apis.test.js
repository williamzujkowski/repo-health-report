import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

// Import compiled modules from dist
const { fetchScorecard, fetchDepsDevInfo, detectPackageInfo } = await import(
  "../dist/external-apis.js"
);

// ── detectPackageInfo (pure, no I/O) ─────────────────────────────────────────

describe("detectPackageInfo", () => {
  it("returns npm info when package.json is present and name is provided", () => {
    const result = detectPackageInfo(["package.json", "src/index.ts"], "my-pkg");
    assert.deepEqual(result, { system: "npm", packageName: "my-pkg" });
  });

  it("returns null when package.json is present but name is not provided", () => {
    const result = detectPackageInfo(["package.json"], undefined);
    assert.equal(result, null);
  });

  it("returns null for pyproject.toml (name needs file parsing)", () => {
    const result = detectPackageInfo(["pyproject.toml"], undefined);
    assert.equal(result, null);
  });

  it("returns null for Cargo.toml (name needs file parsing)", () => {
    const result = detectPackageInfo(["Cargo.toml"], undefined);
    assert.equal(result, null);
  });

  it("returns null for go.mod (name needs file parsing)", () => {
    const result = detectPackageInfo(["go.mod"], undefined);
    assert.equal(result, null);
  });

  it("returns null for an empty tree", () => {
    const result = detectPackageInfo([], undefined);
    assert.equal(result, null);
  });

  it("returns null when no recognized manifest is present", () => {
    const result = detectPackageInfo(["README.md", "src/main.py"], "mypkg");
    assert.equal(result, null);
  });
});

// ── fetchScorecard — network mocked via globalThis.fetch ─────────────────────

describe("fetchScorecard", () => {
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed scorecard on success", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        score: 7.5,
        date: "2024-01-15",
        checks: [
          { name: "Branch-Protection", score: 8, reason: "Branch protection enabled" },
          { name: "Token-Permissions", score: 5, reason: "Tokens have limited scope" },
        ],
      }),
    });

    const result = await fetchScorecard("owner/repo");
    assert.ok(result !== null);
    assert.equal(result.score, 7.5);
    assert.equal(result.date, "2024-01-15");
    assert.equal(result.checks.length, 2);
    assert.equal(result.checks[0].name, "Branch-Protection");
    assert.equal(result.checks[0].score, 8);
    assert.equal(result.checks[1].name, "Token-Permissions");
  });

  it("returns null when response is not ok (404)", async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    const result = await fetchScorecard("owner/private-repo");
    assert.equal(result, null);
  });

  it("returns null when fetch throws (network error)", async () => {
    globalThis.fetch = async () => {
      throw new Error("Network error");
    };
    const result = await fetchScorecard("owner/repo");
    assert.equal(result, null);
  });

  it("returns null when fetch times out (AbortError)", async () => {
    globalThis.fetch = async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    };
    const result = await fetchScorecard("owner/repo");
    assert.equal(result, null);
  });

  it("handles missing fields gracefully (defaults to 0 score, empty checks)", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({}),
    });
    const result = await fetchScorecard("owner/repo");
    assert.ok(result !== null);
    assert.equal(result.score, 0);
    assert.equal(result.date, null);
    assert.deepEqual(result.checks, []);
  });

  it("handles null checks field gracefully", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ score: 5.0, checks: null }),
    });
    const result = await fetchScorecard("owner/repo");
    assert.ok(result !== null);
    assert.deepEqual(result.checks, []);
  });

  it("maps check fields correctly including negative score", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        score: 3.0,
        checks: [{ name: "Vulnerabilities", score: -1, reason: "Not enough data" }],
      }),
    });
    const result = await fetchScorecard("owner/repo");
    assert.ok(result !== null);
    assert.equal(result.checks[0].score, -1);
    assert.equal(result.checks[0].reason, "Not enough data");
  });
});

// ── fetchDepsDevInfo — network mocked via globalThis.fetch ───────────────────

describe("fetchDepsDevInfo", () => {
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed deps.dev info on success", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        dependentCount: 1234,
        versions: [
          { versionKey: { version: "1.0.0" } },
          { versionKey: { version: "2.1.0" } },
        ],
      }),
    });

    const result = await fetchDepsDevInfo("my-package", "npm");
    assert.ok(result !== null);
    assert.equal(result.dependentCount, 1234);
    assert.equal(result.latestVersion, "2.1.0");
  });

  it("returns null when response is not ok (404)", async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    const result = await fetchDepsDevInfo("nonexistent-pkg", "npm");
    assert.equal(result, null);
  });

  it("returns null when fetch throws", async () => {
    globalThis.fetch = async () => {
      throw new Error("Connection refused");
    };
    const result = await fetchDepsDevInfo("my-package", "npm");
    assert.equal(result, null);
  });

  it("handles missing dependentCount (defaults to 0)", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ versions: [] }),
    });
    const result = await fetchDepsDevInfo("my-package", "npm");
    assert.ok(result !== null);
    assert.equal(result.dependentCount, 0);
    assert.equal(result.latestVersion, null);
  });

  it("handles empty versions array (latestVersion null)", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ dependentCount: 42, versions: [] }),
    });
    const result = await fetchDepsDevInfo("my-package", "npm");
    assert.ok(result !== null);
    assert.equal(result.dependentCount, 42);
    assert.equal(result.latestVersion, null);
  });

  it("handles missing versions field (latestVersion null)", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ dependentCount: 5 }),
    });
    const result = await fetchDepsDevInfo("my-package", "npm");
    assert.ok(result !== null);
    assert.equal(result.dependentCount, 5);
    assert.equal(result.latestVersion, null);
  });

  it("URL-encodes special characters in package name", async () => {
    let capturedUrl = "";
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { ok: false, status: 404 };
    };
    await fetchDepsDevInfo("@scope/my-package", "npm");
    assert.ok(capturedUrl.includes("%40scope%2Fmy-package"), `Expected encoded URL, got: ${capturedUrl}`);
  });

  it("works with pypi system parameter", async () => {
    globalThis.fetch = async (url) => {
      assert.ok(url.includes("/systems/pypi/"), `Expected pypi in URL, got: ${url}`);
      return {
        ok: true,
        json: async () => ({ dependentCount: 300, versions: [{ versionKey: { version: "3.2.1" } }] }),
      };
    };
    const result = await fetchDepsDevInfo("requests", "pypi");
    assert.ok(result !== null);
    assert.equal(result.dependentCount, 300);
    assert.equal(result.latestVersion, "3.2.1");
  });
});
