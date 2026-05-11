/**
 * Integration tests — CI missing-XML guard.
 *
 * Two layers of coverage:
 *
 * 1. Script-level: spawns `print-test-report.ts` directly and asserts the
 *    exit code for present / absent expected XML files.
 *
 * 2. Shell stand-in: runs a minimal bash script that reproduces the exact
 *    trap wiring from `ci.sh`:
 *
 *      set -euo pipefail
 *      trap 'tsx print-test-report.ts -- a.xml b.xml' EXIT
 *      # main body exits 0; trap fires and detects the missing file
 *
 *    This ensures that removing or rewiring the trap in `ci.sh` would break
 *    the test even if `print-test-report.ts` itself is untouched.
 *
 * Both layers redirect `RESULTS_DIR` to a temporary directory via the
 * `TEST_RESULTS_DIR` env var so no real `test-results/` files are touched.
 *
 * Run: pnpm --filter @workspace/scripts run test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKSPACE_ROOT = join(__dirname, "../..");
const SCRIPT = join(__dirname, "print-test-report.ts");
const TSX = join(WORKSPACE_ROOT, "node_modules/.bin/tsx");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runScript(
  resultsDir: string,
  ...args: string[]
): { status: number; stderr: string } {
  const result = spawnSync(TSX, [SCRIPT, ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    env: { ...process.env, TEST_RESULTS_DIR: resultsDir },
  });
  return { status: result.status ?? 1, stderr: result.stderr ?? "" };
}

/**
 * Write a minimal bash stand-in that mirrors ci.sh's trap structure:
 *
 *   set -euo pipefail
 *   trap 'tsx print-test-report.ts -- <files...>' EXIT
 *   exit 0   # main body succeeds; trap fires and may exit 1
 *
 * Returns the overall exit code of running the stand-in.
 */
function runStandin(
  resultsDir: string,
  expectedFiles: string[],
): { status: number; stderr: string } {
  const fileList = expectedFiles.join(" ");
  const standin = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `trap '${TSX} ${SCRIPT} -- ${fileList}' EXIT`,
    "exit 0",
  ].join("\n");

  const tmpFile = join(tmpdir(), `ci-stand-in-${Date.now()}.sh`);
  writeFileSync(tmpFile, standin, { mode: 0o755 });

  try {
    const result = spawnSync("bash", [tmpFile], {
      cwd: WORKSPACE_ROOT,
      encoding: "utf8",
      env: { ...process.env, TEST_RESULTS_DIR: resultsDir },
    });
    return { status: result.status ?? 1, stderr: result.stderr ?? "" };
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  }
}

function writeXml(dir: string, name: string): void {
  writeFileSync(join(dir, name), "<testsuites/>");
}

function removeXml(dir: string, name: string): void {
  const p = join(dir, name);
  if (existsSync(p)) unlinkSync(p);
}

// ---------------------------------------------------------------------------
// Layer 1: script-level exit-code contract
// ---------------------------------------------------------------------------

describe("ci-guard (script-level): print-test-report exit-code contract", () => {
  let resultsDir: string;

  before(() => {
    resultsDir = mkdtempSync(join(tmpdir(), "ci-guard-script-"));
    mkdirSync(resultsDir, { recursive: true });
  });

  after(() => {
    rmSync(resultsDir, { recursive: true, force: true });
  });

  it("exits 1 when one of two expected XML files is absent", () => {
    writeXml(resultsDir, "a.xml");
    removeXml(resultsDir, "b.xml");

    const { status } = runScript(resultsDir, "a.xml", "b.xml");
    assert.equal(
      status,
      1,
      `Expected exit code 1 (b.xml missing) but got ${status}`,
    );
  });

  it("exits 0 when all expected XML files are present", () => {
    writeXml(resultsDir, "a.xml");
    writeXml(resultsDir, "b.xml");

    const { status } = runScript(resultsDir, "a.xml", "b.xml");
    assert.equal(
      status,
      0,
      `Expected exit code 0 (all present) but got ${status}`,
    );
  });

  it("exits 1 when all expected XML files are absent", () => {
    const { status } = runScript(resultsDir, "never-exists.xml");
    assert.equal(
      status,
      1,
      `Expected exit code 1 (all absent) but got ${status}`,
    );
  });

  it("exits 0 when no expected files are configured (guard not active)", () => {
    const { status } = runScript(resultsDir);
    assert.equal(
      status,
      0,
      `Expected exit code 0 (no guard) but got ${status}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Layer 2: shell stand-in — exact ci.sh trap wiring
// ---------------------------------------------------------------------------

describe("ci-guard (shell stand-in): ci.sh trap wiring exits 1 on missing XML", () => {
  let resultsDir: string;

  before(() => {
    resultsDir = mkdtempSync(join(tmpdir(), "ci-guard-trap-"));
    mkdirSync(resultsDir, { recursive: true });
  });

  after(() => {
    rmSync(resultsDir, { recursive: true, force: true });
  });

  it("stand-in exits 1 when one expected XML file is absent (trap catches it)", () => {
    writeXml(resultsDir, "api.xml");
    writeXml(resultsDir, "unit.xml");
    removeXml(resultsDir, "integration.xml");

    const { status } = runStandin(resultsDir, [
      "api.xml",
      "integration.xml",
      "unit.xml",
    ]);
    assert.equal(
      status,
      1,
      `Expected stand-in to exit 1 (integration.xml missing) but got ${status}`,
    );
  });

  it("stand-in exits 0 when all expected XML files are present (trap is silent)", () => {
    writeXml(resultsDir, "api.xml");
    writeXml(resultsDir, "integration.xml");
    writeXml(resultsDir, "unit.xml");

    const { status } = runStandin(resultsDir, [
      "api.xml",
      "integration.xml",
      "unit.xml",
    ]);
    assert.equal(
      status,
      0,
      `Expected stand-in to exit 0 (all files present) but got ${status}`,
    );
  });

  it("stand-in exits 1 when ALL expected XML files are absent", () => {
    const { status } = runStandin(resultsDir, [
      "gone-a.xml",
      "gone-b.xml",
      "gone-c.xml",
    ]);
    assert.equal(
      status,
      1,
      `Expected stand-in to exit 1 (all absent) but got ${status}`,
    );
  });
});
