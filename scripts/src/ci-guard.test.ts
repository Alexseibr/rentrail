/**
 * Integration tests — CI missing-XML guard.
 *
 * Three layers of coverage:
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
 * 3. ci.sh source audit: reads `ci.sh` directly and asserts that its trap
 *    command lists the exact set of XML basenames the CI pipeline is
 *    expected to produce. Editing ci.sh's trap without updating this
 *    canonical list is a breaking change that this layer will catch.
 *
 * All layers redirect `RESULTS_DIR` to a temporary directory via the
 * `TEST_RESULTS_DIR` env var so no real `test-results/` files are touched.
 *
 * Run: pnpm --filter @workspace/scripts run test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
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

// ---------------------------------------------------------------------------
// Layer 3: ci.sh source audit — trap declaration matches canonical file list
// ---------------------------------------------------------------------------
//
// These are the XML basenames that the CI pipeline's test steps are expected
// to write. If ci.sh's trap is edited to drop or rename one of these, the
// test below will fail immediately — without needing to run a full CI pass.
//
const CANONICAL_CI_XML_FILES = ["api.xml", "integration.xml", "unit.xml"];

/**
 * Extract the `.xml` basenames listed inside the `trap '...' EXIT` command
 * of a ci.sh file.  Returns an empty array when no trap line is found.
 */
function parseTrapXmlFiles(ciShContent: string): string[] {
  // Match: trap '...' EXIT  (single-quoted trap body on one line)
  const trapMatch = /trap\s+'([^']+)'\s+EXIT/.exec(ciShContent);
  if (!trapMatch) return [];
  const trapBody = trapMatch[1];
  return (trapBody.match(/\b\w+\.xml\b/g) ?? []).sort();
}

describe("ci-guard (ci.sh source audit): trap lists the canonical XML files", () => {
  const CI_SH = join(WORKSPACE_ROOT, "ci.sh");

  it("ci.sh contains an EXIT trap", () => {
    const src = readFileSync(CI_SH, "utf8");
    const trapMatch = /trap\s+'[^']+'\s+EXIT/.test(src);
    assert.ok(trapMatch, "Expected ci.sh to declare a trap '...' EXIT command");
  });

  it("ci.sh trap lists exactly the canonical XML basenames", () => {
    const src = readFileSync(CI_SH, "utf8");
    const found = parseTrapXmlFiles(src);
    const expected = [...CANONICAL_CI_XML_FILES].sort();
    assert.deepEqual(
      found,
      expected,
      `ci.sh trap XML list mismatch.\n  found:    ${found.join(", ")}\n  expected: ${expected.join(", ")}`,
    );
  });

  it("ci.sh uses set -euo pipefail before the trap", () => {
    const src = readFileSync(CI_SH, "utf8");
    const setPipeIdx = src.indexOf("set -euo pipefail");
    // Match the `trap` command itself (start of line, not inside a comment).
    const trapCmdMatch = /^trap\s+/m.exec(src);
    assert.ok(
      setPipeIdx !== -1,
      "Expected ci.sh to contain 'set -euo pipefail'",
    );
    assert.ok(
      trapCmdMatch !== null,
      "Expected ci.sh to contain a 'trap' command",
    );
    assert.ok(
      setPipeIdx < (trapCmdMatch.index ?? Infinity),
      "'set -euo pipefail' must appear before the trap declaration",
    );
  });
});
