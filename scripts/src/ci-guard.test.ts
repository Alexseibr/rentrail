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
 *      EXPECTED_XMLS=$(tsx collect-xml-files.ts)
 *      trap "tsx print-test-report.ts -- $EXPECTED_XMLS" EXIT
 *      # main body exits 0; trap fires and detects the missing file
 *
 *    This ensures that removing or rewiring the trap in `ci.sh` would break
 *    the test even if `print-test-report.ts` itself is untouched.
 *
 * 3. ci.sh source audit: reads `ci.sh` directly and asserts that it derives
 *    its expected XML list via `collect-xml-files` (the dynamic scanner)
 *    rather than a hardcoded parallel array. Also verifies that the
 *    `CI_XML_FILES` module itself produces the correct basenames.
 *    Editing ci.sh's trap without keeping the derivation wiring is a breaking
 *    change that this layer will catch.
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
  readdirSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  CI_XML_FILES,
  collectCiXmlFiles,
  findVitestConfigsWithoutOutputFile,
} from "./ci-xml-files.js";

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
 *   EXPECTED_XMLS=$(tsx collect-xml-files.ts)
 *   trap "tsx print-test-report.ts -- $EXPECTED_XMLS" EXIT
 *   exit 0   # main body succeeds; trap fires and may exit 1
 *
 * Returns the overall exit code of running the stand-in.
 */
function runStandin(resultsDir: string): { status: number; stderr: string } {
  const collectScript = join(__dirname, "collect-xml-files.ts");
  const standin = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `EXPECTED_XMLS=$(${TSX} ${collectScript})`,
    `trap "${TSX} ${SCRIPT} -- $EXPECTED_XMLS" EXIT`,
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

/**
 * Extract every XML basename that appears literally in a trap body string.
 *
 * Uses /[a-z][a-z0-9-]*\.xml/g so that hyphenated stems like "api-server.xml"
 * are matched in full.  The previous \b\w+\.xml\b pattern relied on word
 * boundaries and could only match the suffix after the last hyphen (e.g.
 * "server.xml" from "api-server.xml"), silently missing the full filename.
 *
 * Returns an empty array when the trap body contains only shell variable
 * references (the expected case in ci.sh).
 */
function parseTrapXmlFiles(trapBody: string): string[] {
  const FILENAME_RE = /[a-z][a-z0-9-]*\.xml/g;
  return [...trapBody.matchAll(FILENAME_RE)].map((m) => m[0]);
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
    // Write all but the first derived XML file.
    for (const name of CI_XML_FILES.slice(1)) writeXml(resultsDir, name);
    removeXml(resultsDir, CI_XML_FILES[0]!);

    const { status } = runStandin(resultsDir);
    assert.equal(
      status,
      1,
      `Expected stand-in to exit 1 (${CI_XML_FILES[0]} missing) but got ${status}`,
    );
  });

  it("stand-in exits 0 when all expected XML files are present (trap is silent)", () => {
    for (const name of CI_XML_FILES) writeXml(resultsDir, name);

    const { status } = runStandin(resultsDir);
    assert.equal(
      status,
      0,
      `Expected stand-in to exit 0 (all files present) but got ${status}`,
    );
  });

  it("stand-in exits 1 when ALL expected XML files are absent", () => {
    for (const name of CI_XML_FILES) removeXml(resultsDir, name);

    const { status } = runStandin(resultsDir);
    assert.equal(
      status,
      1,
      `Expected stand-in to exit 1 (all absent) but got ${status}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Layer 3: ci.sh source audit — dynamic derivation is wired correctly
// ---------------------------------------------------------------------------

describe("ci-guard (ci.sh source audit): trap uses derived XML file list", () => {
  const CI_SH = join(WORKSPACE_ROOT, "ci.sh");

  it("ci.sh contains an EXIT trap", () => {
    const src = readFileSync(CI_SH, "utf8");
    const trapMatch = /trap\s+".+"\s+EXIT/.test(src);
    assert.ok(trapMatch, 'Expected ci.sh to declare a trap "..." EXIT command');
  });

  it("ci.sh derives expected XML via collect-xml-files, not a hardcoded list", () => {
    const src = readFileSync(CI_SH, "utf8");

    // The script must call collect-xml-files to build the file list dynamically.
    assert.ok(
      src.includes("collect-xml-files"),
      "Expected ci.sh to call collect-xml-files for dynamic XML list derivation",
    );

    // The trap body itself must not embed hardcoded *.xml filenames — it should
    // reference a variable populated by collect-xml-files instead.
    const trapMatch = /trap\s+"([^"]+)"\s+EXIT/.exec(src);
    assert.ok(
      trapMatch !== null,
      'Expected ci.sh to declare a double-quoted trap "..." EXIT command',
    );
    const trapBody = trapMatch[1] ?? "";
    const hardcoded = parseTrapXmlFiles(trapBody);
    assert.deepEqual(
      hardcoded,
      [],
      `Expected trap body to reference a shell variable, not hardcoded XML names. ` +
        `Found: [${hardcoded.join(", ")}] in: ${trapBody}`,
    );
  });

  it("parseTrapXmlFiles extracts hyphenated and plain XML filenames from a trap body", () => {
    // Regression guard: the previous \b\w+\.xml\b pattern only matched the
    // portion after the last hyphen (e.g. "server.xml" from "api-server.xml").
    // parseTrapXmlFiles must return the full filename in every case.

    // Plain (no hyphens) — baseline.
    assert.deepEqual(
      parseTrapXmlFiles("tsx print-test-report.ts -- unit.xml"),
      ["unit.xml"],
    );

    // Hyphenated stem — the key regression case.
    assert.deepEqual(
      parseTrapXmlFiles("tsx print-test-report.ts -- api-server.xml"),
      ["api-server.xml"],
    );

    // Multiple filenames, including a hyphenated one, as if someone hardcoded
    // the canonical list directly in the trap body.
    assert.deepEqual(
      parseTrapXmlFiles(
        `tsx print-test-report.ts -- unit.xml api-server.xml e2e.xml`,
      ),
      ["unit.xml", "api-server.xml", "e2e.xml"],
    );

    // Quoted args (e.g. 'tsx ... -- "api-server.xml"') — quotes are transparent
    // to the regex since it matches on the bare name characters.
    assert.deepEqual(
      parseTrapXmlFiles(`tsx print-test-report.ts -- "api-server.xml"`),
      ["api-server.xml"],
    );

    // A body using only a shell variable must return an empty array — this is
    // the correct state of ci.sh and must not be flagged as hardcoded.
    assert.deepEqual(
      parseTrapXmlFiles("tsx print-test-report.ts -- $EXPECTED_XMLS"),
      [],
    );
  });

  it("parseTrapXmlFiles output is consistent with the canonical CI_XML_FILES list (hyphenated-name coverage)", () => {
    // Build a synthetic trap body that hardcodes the exact same names as
    // CI_XML_FILES, including any hyphenated entries, and verify that
    // parseTrapXmlFiles recovers every entry intact.
    //
    // This test locks in that the canonical list and the parser agree for all
    // current declared XML files — if a hyphenated filename is ever added to
    // CI_XML_FILES, parseTrapXmlFiles must still round-trip it correctly.
    const syntheticBody = `tsx print-test-report.ts -- ${CI_XML_FILES.join(" ")}`;
    const extracted = parseTrapXmlFiles(syntheticBody);
    assert.deepEqual(
      extracted,
      CI_XML_FILES,
      `parseTrapXmlFiles must recover every entry from CI_XML_FILES unchanged. ` +
        `Expected: [${CI_XML_FILES.join(", ")}], got: [${extracted.join(", ")}]`,
    );

    // When at least one canonical filename contains a hyphen, assert that the
    // parser round-trips that specific entry exactly — keeping the hyphen-aware
    // intent explicit and not just an implicit side-effect of the loop above.
    const hyphenated = CI_XML_FILES.filter((n) => n.includes("-"));
    if (hyphenated.length > 0) {
      for (const name of hyphenated) {
        const body = `tsx print-test-report.ts -- ${name}`;
        assert.deepEqual(
          parseTrapXmlFiles(body),
          [name],
          `parseTrapXmlFiles must preserve hyphenated canonical entry '${name}' intact`,
        );
      }
    }
  });

  it("CI_XML_FILES module yields well-formed basenames consistent with a fresh scan", () => {
    // Shape: non-empty, every entry is a well-formed XML basename.
    // No fixed list is asserted here — adding a new test suite that correctly
    // declares its output file requires no change to this test.
    assert.ok(CI_XML_FILES.length > 0, "CI_XML_FILES must not be empty");
    for (const name of CI_XML_FILES) {
      assert.match(
        name,
        /^[a-z][a-z0-9-]*\.xml$/,
        `Expected a well-formed XML basename, got: ${name}`,
      );
    }

    // Consistency: the exported constant must match a fresh run of the scanner
    // so the module cannot drift from the workspace declarations it reads.
    const fresh = collectCiXmlFiles();
    assert.deepEqual(
      CI_XML_FILES,
      fresh,
      "CI_XML_FILES export must equal a fresh collectCiXmlFiles() call",
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

// ---------------------------------------------------------------------------
// Layer 4: scanner pattern coverage — synthetic workspace
//
// Creates a minimal fake workspace in a temp directory and calls
// collectCiXmlFiles() directly against it to verify every supported
// declaration pattern is recognised, including vitest configs placed inside
// package subdirectories listed in pnpm-workspace.yaml.
// ---------------------------------------------------------------------------

describe("ci-guard (scanner patterns): collectCiXmlFiles detects all supported declaration styles", () => {
  let tmpRoot: string;

  before(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ci-scanner-patterns-"));
    // Seed an empty package.json so every test can rely on it existing.
    writeFileSync(
      join(tmpRoot, "package.json"),
      JSON.stringify({ scripts: {} }),
      "utf8",
    );
    // Seed a pnpm-workspace.yaml that declares a `packages/*` glob so the
    // subdirectory-scan tests can place configs under `packages/sub/`.
    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
      "utf8",
    );
  });

  after(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function writePkg(scripts: Record<string, string>): void {
    writeFileSync(
      join(tmpRoot, "package.json"),
      JSON.stringify({ scripts }),
      "utf8",
    );
  }

  function writeConfig(name: string, content: string): void {
    writeFileSync(join(tmpRoot, name), content, "utf8");
  }

  it("detects the --outputFile.junit CLI flag declared in a package.json test script", () => {
    writePkg({
      "test:e2e":
        "vitest run --reporter=junit --outputFile.junit=test-results/e2e-cli.xml e2e.test",
    });

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("e2e-cli.xml"),
      `Expected scanner to detect e2e-cli.xml via --outputFile.junit flag, got: [${found.join(", ")}]`,
    );
  });

  it("detects the per-reporter outputFile object key (junit: ...) inside a vitest.*.ts config", () => {
    writePkg({});
    writeConfig(
      "vitest.cfg-object.ts",
      [
        'import { defineConfig } from "vitest/config";',
        "export default defineConfig({",
        "  test: {",
        '    reporters: ["verbose", "junit"],',
        "    outputFile: {",
        '      junit: "test-results/cfg-object.xml",',
        "    },",
        "  },",
        "});",
      ].join("\n"),
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("cfg-object.xml"),
      `Expected scanner to detect cfg-object.xml via vitest config per-reporter junit: key, got: [${found.join(", ")}]`,
    );
  });

  it("detects the plain-string outputFile form (outputFile: '...') inside a vitest.*.ts config", () => {
    // Vitest also accepts a plain string when a single reporter owns all output.
    // This is the alternative shape the scanner previously missed.
    writePkg({});
    writeConfig(
      "vitest.cfg-plain.ts",
      [
        "export default {",
        "  test: {",
        '    reporters: ["junit"],',
        '    outputFile: "test-results/cfg-plain.xml",',
        "  },",
        "};",
      ].join("\n"),
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("cfg-plain.xml"),
      `Expected scanner to detect cfg-plain.xml via vitest config plain outputFile: string, got: [${found.join(", ")}]`,
    );
  });

  it("deduplicates when the same basename appears in both a script and a vitest config", () => {
    writePkg({
      "test:dup":
        "vitest run --reporter=junit --outputFile.junit=test-results/dup.xml dup.test",
    });
    writeConfig(
      "vitest.dup.ts",
      [
        "export default {",
        "  test: {",
        "    outputFile: {",
        '      junit: "test-results/dup.xml",',
        "    },",
        "  },",
        "};",
      ].join("\n"),
    );

    const found = collectCiXmlFiles(tmpRoot);
    const dupCount = found.filter((n) => n === "dup.xml").length;
    assert.equal(
      dupCount,
      1,
      `Expected dup.xml to appear exactly once after deduplication, got ${dupCount} occurrence(s)`,
    );
  });

  it("detects the reporter-tuple outputFile form (['junit', { outputFile: '...' }]) inside a vitest.*.ts config", () => {
    writePkg({});
    writeConfig(
      "vitest.cfg-tuple.ts",
      [
        'import { defineConfig } from "vitest/config";',
        "export default defineConfig({",
        "  test: {",
        "    reporters: [['junit', { outputFile: 'test-results/cfg-tuple.xml' }]],",
        "  },",
        "});",
      ].join("\n"),
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("cfg-tuple.xml"),
      `Expected scanner to detect cfg-tuple.xml via reporter-tuple outputFile, got: [${found.join(", ")}]`,
    );
  });

  it("detects a vitest config placed in a package subdirectory listed in pnpm-workspace.yaml", () => {
    // The scanner resolves package dirs from pnpm-workspace.yaml and scans
    // each package root, so a config at packages/sub/vitest.e2e.ts is found
    // even though it is not at the workspace root.
    const subDir = join(tmpRoot, "packages", "sub");
    mkdirSync(subDir, { recursive: true });
    writePkg({});
    writeFileSync(
      join(subDir, "vitest.e2e.ts"),
      [
        "export default {",
        "  test: {",
        "    outputFile: {",
        '      junit: "test-results/sub-e2e.xml",',
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("sub-e2e.xml"),
      `Expected scanner to detect sub-e2e.xml from a package subdirectory config, got: [${found.join(", ")}]`,
    );
  });

  it("resolves package dirs when pnpm-workspace.yaml uses double-quoted glob patterns", () => {
    // A future author may write  - "packages/*"  with double quotes.
    // The proper YAML parser must strip the quotes and still expand the glob.
    const subDir = join(tmpRoot, "packages", "dq-sub");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      'packages:\n  - "packages/*"\n',
      "utf8",
    );
    writePkg({});
    writeFileSync(
      join(subDir, "vitest.dq.ts"),
      [
        "export default {",
        "  test: {",
        "    outputFile: {",
        '      junit: "test-results/dq-sub.xml",',
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("dq-sub.xml"),
      `Expected double-quoted glob to be resolved; got: [${found.join(", ")}]`,
    );

    // Restore the original workspace yaml so subsequent tests are unaffected.
    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
      "utf8",
    );
  });

  it("resolves package dirs when pnpm-workspace.yaml uses single-quoted glob patterns", () => {
    // A future author may write  - 'packages/*'  with single quotes.
    const subDir = join(tmpRoot, "packages", "sq-sub");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n  - 'packages/*'\n",
      "utf8",
    );
    writePkg({});
    writeFileSync(
      join(subDir, "vitest.sq.ts"),
      [
        "export default {",
        "  test: {",
        "    outputFile: {",
        '      junit: "test-results/sq-sub.xml",',
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("sq-sub.xml"),
      `Expected single-quoted glob to be resolved; got: [${found.join(", ")}]`,
    );

    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
      "utf8",
    );
  });

  it("resolves package dirs when pnpm-workspace.yaml has inline comments on pattern lines", () => {
    // An author annotating patterns with  # comments  must not break the scan.
    const subDir = join(tmpRoot, "packages", "cm-sub");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/* # all workspace packages\n",
      "utf8",
    );
    writePkg({});
    writeFileSync(
      join(subDir, "vitest.cm.ts"),
      [
        "export default {",
        "  test: {",
        "    outputFile: {",
        '      junit: "test-results/cm-sub.xml",',
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("cm-sub.xml"),
      `Expected inline-commented glob to be resolved; got: [${found.join(", ")}]`,
    );

    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
      "utf8",
    );
  });

  it("resolves package dirs when pnpm-workspace.yaml mixes quoted and commented patterns", () => {
    // Both robustness features active at once: double-quoted value + inline comment.
    const subDir = join(tmpRoot, "packages", "mix-sub");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      'packages:\n  - "packages/*" # root packages\n',
      "utf8",
    );
    writePkg({});
    writeFileSync(
      join(subDir, "vitest.mix.ts"),
      [
        "export default {",
        "  test: {",
        "    outputFile: {",
        '      junit: "test-results/mix-sub.xml",',
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("mix-sub.xml"),
      `Expected double-quoted + commented glob to be resolved; got: [${found.join(", ")}]`,
    );

    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
      "utf8",
    );
  });

  it("detects the --outputFile.junit CLI flag declared in a package-level package.json script", () => {
    // A test suite invoked via a per-package script (not forwarded to the root)
    // must still be visible to the scanner.  Previously only the root
    // package.json was read, so package-level declarations were silently missed.
    const subDir = join(tmpRoot, "packages", "pkg-script");
    mkdirSync(subDir, { recursive: true });
    writePkg({});
    writeFileSync(
      join(subDir, "package.json"),
      JSON.stringify({
        scripts: {
          "test:int":
            "vitest run --reporter=junit --outputFile.junit=test-results/pkg-script-int.xml integration.test",
        },
      }),
      "utf8",
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("pkg-script-int.xml"),
      `Expected scanner to detect pkg-script-int.xml via package-level --outputFile.junit flag, got: [${found.join(", ")}]`,
    );
  });

  // ---------------------------------------------------------------------------
  // Layer 4 — shared-helper import following
  //
  // Teams often extract reporter config into a shared helper file and import
  // it from each vitest config.  The scanner must follow relative imports one
  // level deep so that outputFile declarations in the helper are detected.
  // ---------------------------------------------------------------------------

  it("detects outputFile declared in a shared helper imported from a vitest config (per-reporter object form)", () => {
    // Shared helper exports the reporter options, including `outputFile`.
    // The vitest config imports from it — the scanner must follow that import.
    writePkg({});
    writeFileSync(
      join(tmpRoot, "vitest-shared.ts"),
      [
        "export const outputFile = {",
        '  junit: "test-results/shared-helper.xml",',
        "};",
      ].join("\n"),
      "utf8",
    );
    writeConfig(
      "vitest.shared-consumer.ts",
      [
        'import { outputFile } from "./vitest-shared";',
        'import { defineConfig } from "vitest/config";',
        "export default defineConfig({",
        "  test: {",
        '    reporters: ["junit"],',
        "    outputFile,",
        "  },",
        "});",
      ].join("\n"),
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("shared-helper.xml"),
      `Expected scanner to follow the import and detect shared-helper.xml, got: [${found.join(", ")}]`,
    );
  });

  it("detects outputFile declared in a shared helper imported from a vitest config (plain string form)", () => {
    // The helper exports a config fragment that contains the plain-string
    // outputFile pattern (outputFile: "...").  The config imports from the
    // helper and spreads it in — the scanner must read the helper and find the
    // declaration there even though the config body itself has no test-results/
    // string literal.
    writePkg({});
    writeFileSync(
      join(tmpRoot, "lib-shared.ts"),
      [
        "export const sharedTestConfig = {",
        '  outputFile: "test-results/shared-plain.xml",',
        "};",
      ].join("\n"),
      "utf8",
    );
    writeConfig(
      "vitest.shared-plain.ts",
      [
        'import { sharedTestConfig } from "./lib-shared";',
        "export default {",
        "  test: {",
        '    reporters: ["junit"],',
        "    ...sharedTestConfig,",
        "  },",
        "};",
      ].join("\n"),
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("shared-plain.xml"),
      `Expected scanner to follow import and detect shared-plain.xml from lib-shared.ts, got: [${found.join(", ")}]`,
    );
  });

  it("detects outputFile in a helper accessed via a parent-relative import (../helper)", () => {
    // A package subdirectory whose vitest config imports from the workspace root
    // using a `../` specifier is also followed correctly.
    const subDir = join(tmpRoot, "packages", "rel-import");
    mkdirSync(subDir, { recursive: true });
    writePkg({});
    writeFileSync(
      join(tmpRoot, "vitest-root-helper.ts"),
      [
        "export const outputFile = {",
        '  junit: "test-results/rel-import.xml",',
        "};",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(subDir, "vitest.rel.ts"),
      [
        'import { outputFile } from "../../vitest-root-helper";',
        "export default { test: { reporters: ['junit'], outputFile } };",
      ].join("\n"),
      "utf8",
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("rel-import.xml"),
      `Expected scanner to follow ../ import and detect rel-import.xml, got: [${found.join(", ")}]`,
    );
  });

  it("does not follow bare (non-relative) module imports when scanning helpers", () => {
    // `import { x } from 'vitest/config'` must NOT cause a file-read attempt
    // for a node_modules path.  The scanner must only follow specifiers that
    // begin with `.` or `..`.  This test verifies the scanner completes without
    // error even when the config only imports from packages (no relative import).
    writePkg({});
    writeConfig(
      "vitest.bare-import.ts",
      [
        'import { defineConfig } from "vitest/config";',
        "export default defineConfig({",
        "  test: {",
        '    reporters: ["junit"],',
        '    outputFile: { junit: "test-results/bare-import.xml" },',
        "  },",
        "});",
      ].join("\n"),
    );

    // The outputFile IS declared inline in the config — it must be found.
    // The bare import from "vitest/config" must not cause the scanner to crash.
    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("bare-import.xml"),
      `Expected scanner to detect bare-import.xml (declared inline) without crashing on bare imports, got: [${found.join(", ")}]`,
    );
  });

  // ---------------------------------------------------------------------------
  // Two-level-deep import chain
  //
  // Previously the scanner only followed imports one level deep from the
  // vitest config.  If a team chains helpers (config → level-1 → level-2),
  // declarations in the second-level file were silently missed.
  //
  // The recursive scanner (up to MAX_IMPORT_DEPTH = 3) must detect them.
  // ---------------------------------------------------------------------------

  it("detects outputFile declared two levels deep in a chained helper import", () => {
    // Chain:
    //   vitest.deep-chain.ts  →  ./deep-level1  →  ./deep-level2
    //   Only deep-level2 contains the outputFile declaration.
    writePkg({});

    // Level 2: the leaf helper — only this file has the outputFile declaration.
    writeFileSync(
      join(tmpRoot, "deep-level2.ts"),
      [
        "export const outputFile = {",
        '  junit: "test-results/deep-chain.xml",',
        "};",
      ].join("\n"),
      "utf8",
    );

    // Level 1: a middle helper that re-exports from the leaf.
    writeFileSync(
      join(tmpRoot, "deep-level1.ts"),
      ['export { outputFile } from "./deep-level2";'].join("\n"),
      "utf8",
    );

    // The vitest config imports from level 1 only; level 2 must still be found.
    writeConfig(
      "vitest.deep-chain.ts",
      [
        'import { outputFile } from "./deep-level1";',
        "export default {",
        "  test: {",
        '    reporters: ["junit"],',
        "    outputFile,",
        "  },",
        "};",
      ].join("\n"),
    );

    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("deep-chain.xml"),
      `Expected recursive scanner to detect deep-chain.xml two levels deep, got: [${found.join(", ")}]`,
    );
  });

  it("does not infinitely loop when helpers have circular relative imports", () => {
    // If two helpers import each other, the visited-set guard must break the
    // cycle.  The scanner must complete without hanging or throwing.
    writePkg({});

    // circular-a imports circular-b, circular-b imports circular-a.
    writeFileSync(
      join(tmpRoot, "circular-a.ts"),
      [
        'import { b } from "./circular-b";',
        'export const outputFile = { junit: "test-results/circular.xml" };',
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(tmpRoot, "circular-b.ts"),
      [
        'import { outputFile } from "./circular-a";',
        "export const b = 1;",
      ].join("\n"),
      "utf8",
    );

    writeConfig(
      "vitest.circular.ts",
      [
        'import { outputFile } from "./circular-a";',
        "export default { test: { reporters: ['junit'], outputFile } };",
      ].join("\n"),
    );

    // Must not hang; the declaration in circular-a must still be found.
    const found = collectCiXmlFiles(tmpRoot);
    assert.ok(
      found.includes("circular.xml"),
      `Expected scanner to detect circular.xml despite circular imports, got: [${found.join(", ")}]`,
    );
  });
});

// ---------------------------------------------------------------------------
// Layer 5: on-disk cross-check — enforcement logic tests
//
// The "on-disk cross-check" catches test suites that write JUnit XML without
// using a scanner-recognised declaration pattern.  Its logic:
//
//   1. Read all *.xml files from the results directory.
//   2. Assert every one is present in the declared list (CI_XML_FILES).
//   3. Any file that is on disk but not declared is flagged as an omission.
//
// These tests exercise that logic directly against controlled temp directories
// so enforcement is independent of when in the CI pipeline this suite runs.
//
// A passive bonus check at the bottom also runs against the real test-results/
// directory if it happens to exist (e.g. after a local test run).
// ---------------------------------------------------------------------------

/**
 * Returns the basenames of any XML files in `resultsDir` that are NOT listed
 * in `declared`.  An absent or empty directory returns [].
 */
function findUndeclaredXmlFiles(
  resultsDir: string,
  declared: string[],
): string[] {
  let onDisk: string[];
  try {
    onDisk = readdirSync(resultsDir).filter((f) => f.endsWith(".xml"));
  } catch {
    return [];
  }
  const declaredSet = new Set(declared);
  return onDisk.filter((f) => !declaredSet.has(f));
}

describe("ci-guard (on-disk cross-check): logic catches undeclared XML files", () => {
  let resultsDir: string;

  before(() => {
    resultsDir = mkdtempSync(join(tmpdir(), "ci-crosscheck-"));
  });

  after(() => {
    rmSync(resultsDir, { recursive: true, force: true });
  });

  it("returns [] when the results directory does not exist", () => {
    const absent = join(resultsDir, "does-not-exist");
    const undeclared = findUndeclaredXmlFiles(absent, ["a.xml"]);
    assert.deepEqual(undeclared, []);
  });

  it("returns [] when every on-disk XML file is declared", () => {
    writeFileSync(join(resultsDir, "unit.xml"), "<testsuites/>", "utf8");
    writeFileSync(join(resultsDir, "api.xml"), "<testsuites/>", "utf8");

    const undeclared = findUndeclaredXmlFiles(resultsDir, [
      "api.xml",
      "unit.xml",
    ]);
    assert.deepEqual(undeclared, []);
  });

  it("returns the undeclared filename when a suite writes XML without a recognised declaration", () => {
    // Simulate a developer adding a new suite (mystery.xml) whose vitest config
    // uses a pattern the scanner does not recognise.  The file lands on disk
    // but is absent from CI_XML_FILES — the cross-check must surface it.
    writeFileSync(join(resultsDir, "mystery.xml"), "<testsuites/>", "utf8");

    const undeclared = findUndeclaredXmlFiles(resultsDir, [
      "api.xml",
      "unit.xml",
    ]);
    assert.deepEqual(
      undeclared,
      ["mystery.xml"],
      "Expected the cross-check to flag mystery.xml as undeclared",
    );
  });

  it("flags all undeclared files when multiple are present", () => {
    writeFileSync(join(resultsDir, "extra-a.xml"), "<testsuites/>", "utf8");
    writeFileSync(join(resultsDir, "extra-b.xml"), "<testsuites/>", "utf8");

    const undeclared = findUndeclaredXmlFiles(resultsDir, [
      "api.xml",
      "unit.xml",
    ]);
    // mystery.xml, extra-a.xml, extra-b.xml are all undeclared; sort for stability.
    assert.deepEqual([...undeclared].sort(), [
      "extra-a.xml",
      "extra-b.xml",
      "mystery.xml",
    ]);
  });
});

// Passive bonus: if test-results/ exists (e.g. after a local test run), every
// XML file in it must be declared by the scanner.  This is non-enforcing when
// the directory is absent (fresh checkout or CI step ordering).
describe("ci-guard (on-disk cross-check): real test-results/ matches scanner when present", () => {
  it("all *.xml files under test-results/ are listed in CI_XML_FILES (skips if dir absent)", () => {
    const undeclared = findUndeclaredXmlFiles(
      join(WORKSPACE_ROOT, "test-results"),
      CI_XML_FILES,
    );

    const HINT =
      `\nThis means a test suite is writing a JUnit XML file without using a\n` +
      `recognised declaration pattern:\n` +
      `  • --outputFile.junit=test-results/<name>.xml  (in a package.json script)\n` +
      `  • outputFile: { junit: "test-results/<name>.xml" }  (in a vitest.*.ts config)\n` +
      `  • outputFile: "test-results/<name>.xml"            (in a vitest.*.ts config)\n` +
      `  • ['junit', { outputFile: 'test-results/<name>.xml' }]  (reporter-tuple in a vitest.*.ts config)\n`;

    assert.deepEqual(
      undeclared,
      [],
      `Files in test-results/ that are NOT declared by the scanner: ${undeclared.join(", ")}${HINT}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Layer 6: enforcement gate — check-undeclared-xml script and ci.sh wiring
//
// The on-disk cross-check logic (Layer 5) tests the pure helper function.
// This layer tests the actual enforcement gate: the check-undeclared-xml
// script that ci.sh invokes as a build step after all tests have run.
//
// Two sub-layers:
//   6a. Script-level: spawns check-undeclared-xml directly and asserts
//       exit codes for clean and polluted results directories.
//   6b. ci.sh source audit: verifies ci.sh calls check-undeclared-xml so
//       removing or renaming the step breaks this test.
// ---------------------------------------------------------------------------

const CHECK_UNDECLARED_SCRIPT = join(__dirname, "check-undeclared-xml.ts");

function runCheckUndeclared(resultsDir: string): {
  status: number;
  stderr: string;
} {
  const result = spawnSync(TSX, [CHECK_UNDECLARED_SCRIPT], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    env: { ...process.env, TEST_RESULTS_DIR: resultsDir },
  });
  return { status: result.status ?? 1, stderr: result.stderr ?? "" };
}

describe("ci-guard (enforcement gate): check-undeclared-xml exit-code contract", () => {
  let resultsDir: string;

  before(() => {
    resultsDir = mkdtempSync(join(tmpdir(), "ci-undeclared-gate-"));
    mkdirSync(resultsDir, { recursive: true });
  });

  after(() => {
    rmSync(resultsDir, { recursive: true, force: true });
  });

  it("exits 0 when the results directory does not exist", () => {
    const absent = join(resultsDir, "does-not-exist");
    const { status } = runCheckUndeclared(absent);
    assert.equal(
      status,
      0,
      `Expected exit code 0 (absent dir) but got ${status}`,
    );
  });

  it("exits 0 when every XML file in the results directory is declared by the scanner", () => {
    // Write only files that the scanner declares for this workspace.
    for (const name of CI_XML_FILES) {
      writeFileSync(join(resultsDir, name), "<testsuites/>", "utf8");
    }

    const { status } = runCheckUndeclared(resultsDir);
    assert.equal(
      status,
      0,
      `Expected exit code 0 (all declared) but got ${status}`,
    );
  });

  it("exits 1 when an undeclared XML file is present in the results directory", () => {
    // Drop a file whose name is not in CI_XML_FILES to simulate a rogue suite.
    writeFileSync(join(resultsDir, "rogue-suite.xml"), "<testsuites/>", "utf8");

    const { status, stderr } = runCheckUndeclared(resultsDir);
    assert.equal(
      status,
      1,
      `Expected exit code 1 (undeclared file present) but got ${status}`,
    );
    assert.ok(
      stderr.includes("rogue-suite.xml"),
      `Expected stderr to mention rogue-suite.xml; got: ${stderr}`,
    );
  });

  it("exits 1 and lists all undeclared files when multiple are present", () => {
    writeFileSync(join(resultsDir, "ghost-a.xml"), "<testsuites/>", "utf8");
    writeFileSync(join(resultsDir, "ghost-b.xml"), "<testsuites/>", "utf8");

    const { status, stderr } = runCheckUndeclared(resultsDir);
    assert.equal(
      status,
      1,
      `Expected exit code 1 (multiple undeclared) but got ${status}`,
    );
    assert.ok(
      stderr.includes("ghost-a.xml"),
      `Expected stderr to mention ghost-a.xml; got: ${stderr}`,
    );
    assert.ok(
      stderr.includes("ghost-b.xml"),
      `Expected stderr to mention ghost-b.xml; got: ${stderr}`,
    );
  });

  it("exits 0 when the results directory contains only non-XML files", () => {
    const cleanDir = mkdtempSync(join(tmpdir(), "ci-undeclared-nonxml-"));
    try {
      writeFileSync(join(cleanDir, "output.json"), "{}", "utf8");
      writeFileSync(join(cleanDir, "report.txt"), "ok", "utf8");

      const { status } = runCheckUndeclared(cleanDir);
      assert.equal(
        status,
        0,
        `Expected exit code 0 (no XML files) but got ${status}`,
      );
    } finally {
      rmSync(cleanDir, { recursive: true, force: true });
    }
  });
});

describe("ci-guard (enforcement gate): ci.sh wires check-undeclared-xml as a build step", () => {
  const CI_SH = join(WORKSPACE_ROOT, "ci.sh");

  it("ci.sh calls check-undeclared-xml after the test steps", () => {
    const src = readFileSync(CI_SH, "utf8");
    assert.ok(
      src.includes("check-undeclared-xml"),
      "Expected ci.sh to invoke check-undeclared-xml as a build step. " +
        "Removing or renaming the step without updating this test is a breaking change.",
    );
  });

  it("check-undeclared-xml step appears after the last xml-producing test step in ci.sh", () => {
    const src = readFileSync(CI_SH, "utf8");
    const undeclaredIdx = src.indexOf("check-undeclared-xml");
    // test:api is the last step that writes XML files — the gate must follow it.
    const testApiIdx = src.indexOf("test:api");
    assert.ok(testApiIdx !== -1, "Expected ci.sh to contain a test:api step");
    assert.ok(
      undeclaredIdx !== -1,
      "Expected ci.sh to contain a check-undeclared-xml step",
    );
    assert.ok(
      undeclaredIdx > testApiIdx,
      "check-undeclared-xml must appear after test:api in ci.sh so all XML " +
        "files are on disk before the gate runs",
    );
  });
});

// ---------------------------------------------------------------------------
// Layer 7: vitest output-file check — findVitestConfigsWithoutOutputFile
//
// Tests the static checker that detects vitest configs referencing the junit
// reporter but missing an outputFile declaration.  A missing outputFile causes
// vitest to write JUnit XML to stdout instead of a file, so CI can never
// collect or validate the report.
//
// Sub-layers:
//   7a. Unit tests for findVitestConfigsWithoutOutputFile against a synthetic
//       temp workspace — covers the "no outputFile" case, the "has outputFile"
//       case, the "no junit at all" case, and the shared-helper import case.
//   7b. Script-level exit-code tests: spawns check-vitest-output-file.ts
//       directly against controlled temp directories.
//   7c. ci.sh source audit: verifies check-vitest-output-file is wired as a
//       build step before any test steps run.
//   7d. Real-workspace assertion: the current workspace must have zero flagged
//       vitest configs so the check stays green on every commit.
// ---------------------------------------------------------------------------

describe("ci-guard (vitest output-file check): findVitestConfigsWithoutOutputFile — unit", () => {
  let tmpRoot: string;

  before(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ci-vitest-outputfile-"));
    writeFileSync(
      join(tmpRoot, "package.json"),
      JSON.stringify({ scripts: {} }),
      "utf8",
    );
    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
      "utf8",
    );
  });

  after(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("flags a vitest config that mentions junit but has no outputFile declaration", () => {
    writeFileSync(
      join(tmpRoot, "vitest.no-output.ts"),
      [
        "export default {",
        "  test: {",
        "    reporters: ['verbose', 'junit'],",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const result = findVitestConfigsWithoutOutputFile(tmpRoot);
    assert.ok(
      result.some((p) => p.includes("vitest.no-output.ts")),
      `Expected vitest.no-output.ts to be flagged; got: [${result.join(", ")}]`,
    );
  });

  it("does not flag a vitest config with a per-reporter outputFile object", () => {
    writeFileSync(
      join(tmpRoot, "vitest.with-object.ts"),
      [
        "export default {",
        "  test: {",
        "    reporters: ['verbose', 'junit'],",
        "    outputFile: { junit: 'test-results/with-object.xml' },",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const result = findVitestConfigsWithoutOutputFile(tmpRoot);
    assert.ok(
      !result.some((p) => p.includes("vitest.with-object.ts")),
      `Expected vitest.with-object.ts to not be flagged; got: [${result.join(", ")}]`,
    );
  });

  it("does not flag a vitest config with a plain-string outputFile", () => {
    writeFileSync(
      join(tmpRoot, "vitest.with-plain.ts"),
      [
        "export default {",
        "  test: {",
        "    reporters: ['junit'],",
        '    outputFile: "test-results/with-plain.xml",',
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const result = findVitestConfigsWithoutOutputFile(tmpRoot);
    assert.ok(
      !result.some((p) => p.includes("vitest.with-plain.ts")),
      `Expected vitest.with-plain.ts to not be flagged; got: [${result.join(", ")}]`,
    );
  });

  it("does not flag a vitest config with a reporter-tuple outputFile", () => {
    writeFileSync(
      join(tmpRoot, "vitest.with-tuple.ts"),
      [
        "import { defineConfig } from 'vitest/config';",
        "export default defineConfig({",
        "  test: {",
        "    reporters: [['junit', { outputFile: 'test-results/with-tuple.xml' }]],",
        "  },",
        "});",
      ].join("\n"),
      "utf8",
    );

    const result = findVitestConfigsWithoutOutputFile(tmpRoot);
    assert.ok(
      !result.some((p) => p.includes("vitest.with-tuple.ts")),
      `Expected vitest.with-tuple.ts to not be flagged; got: [${result.join(", ")}]`,
    );
  });

  it("does not flag a vitest config that has no junit reporter reference at all", () => {
    writeFileSync(
      join(tmpRoot, "vitest.no-junit.ts"),
      [
        "export default {",
        "  test: {",
        "    reporters: ['verbose'],",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const result = findVitestConfigsWithoutOutputFile(tmpRoot);
    assert.ok(
      !result.some((p) => p.includes("vitest.no-junit.ts")),
      `Expected vitest.no-junit.ts to not be flagged (no junit reporter); got: [${result.join(", ")}]`,
    );
  });

  it("does not flag a vitest config whose outputFile is declared in a shared helper import", () => {
    writeFileSync(
      join(tmpRoot, "vitest-junit-helper.ts"),
      [
        "export const outputFile = {",
        "  junit: 'test-results/helper-declared.xml',",
        "};",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(tmpRoot, "vitest.helper-consumer.ts"),
      [
        "import { outputFile } from './vitest-junit-helper';",
        "export default { test: { reporters: ['junit'], outputFile } };",
      ].join("\n"),
      "utf8",
    );

    const result = findVitestConfigsWithoutOutputFile(tmpRoot);
    assert.ok(
      !result.some((p) => p.includes("vitest.helper-consumer.ts")),
      `Expected vitest.helper-consumer.ts to not be flagged (outputFile in shared helper); got: [${result.join(", ")}]`,
    );
  });

  it("flags configs in package subdirectories listed in pnpm-workspace.yaml", () => {
    const subDir = join(tmpRoot, "packages", "missing-output-pkg");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(
      join(subDir, "vitest.unit.ts"),
      [
        "export default {",
        "  test: { reporters: ['junit'] },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const result = findVitestConfigsWithoutOutputFile(tmpRoot);
    assert.ok(
      result.some((p) => p.includes("missing-output-pkg")),
      `Expected config in package subdir to be flagged; got: [${result.join(", ")}]`,
    );
  });

  it("returns [] for a workspace that has no vitest configs at all", () => {
    const cleanRoot = mkdtempSync(join(tmpdir(), "ci-vitest-clean-"));
    try {
      writeFileSync(
        join(cleanRoot, "package.json"),
        JSON.stringify({ scripts: {} }),
        "utf8",
      );
      writeFileSync(
        join(cleanRoot, "pnpm-workspace.yaml"),
        "packages:\n",
        "utf8",
      );
      const result = findVitestConfigsWithoutOutputFile(cleanRoot);
      assert.deepEqual(
        result,
        [],
        "Expected empty array for workspace with no vitest configs",
      );
    } finally {
      rmSync(cleanRoot, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 7b: script-level exit-code contract for check-vitest-output-file
// ---------------------------------------------------------------------------

const CHECK_VITEST_SCRIPT = join(
  __dirname,
  "check-vitest-output-file.ts",
);

function runCheckVitestOutputFile(workspaceRoot: string): {
  status: number;
  stderr: string;
} {
  const result = spawnSync(TSX, [CHECK_VITEST_SCRIPT], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    env: { ...process.env, CHECK_WORKSPACE_ROOT: workspaceRoot },
  });
  return { status: result.status ?? 1, stderr: result.stderr ?? "" };
}

describe("ci-guard (vitest output-file check): check-vitest-output-file exit-code contract", () => {
  let tmpRoot: string;

  before(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "ci-vitest-script-"));
    writeFileSync(
      join(tmpRoot, "package.json"),
      JSON.stringify({ scripts: {} }),
      "utf8",
    );
    writeFileSync(
      join(tmpRoot, "pnpm-workspace.yaml"),
      "packages:\n",
      "utf8",
    );
  });

  after(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("exits 0 when no vitest config references junit without outputFile", () => {
    writeFileSync(
      join(tmpRoot, "vitest.ok.ts"),
      [
        "export default {",
        "  test: {",
        "    reporters: ['junit'],",
        "    outputFile: { junit: 'test-results/ok.xml' },",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const { status } = runCheckVitestOutputFile(tmpRoot);
    assert.equal(
      status,
      0,
      `Expected exit code 0 (all configs have outputFile) but got ${status}`,
    );
  });

  it("exits 1 when a vitest config has junit but no outputFile", () => {
    writeFileSync(
      join(tmpRoot, "vitest.missing.ts"),
      [
        "export default {",
        "  test: {",
        "    reporters: ['verbose', 'junit'],",
        "  },",
        "};",
      ].join("\n"),
      "utf8",
    );

    const { status, stderr } = runCheckVitestOutputFile(tmpRoot);
    assert.equal(
      status,
      1,
      `Expected exit code 1 (missing outputFile) but got ${status}`,
    );
    assert.ok(
      stderr.includes("vitest.missing.ts"),
      `Expected stderr to mention vitest.missing.ts; got: ${stderr}`,
    );
  });

  it("exits 0 when there are no vitest configs at all", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "ci-vitest-empty-"));
    try {
      writeFileSync(
        join(emptyRoot, "package.json"),
        JSON.stringify({ scripts: {} }),
        "utf8",
      );
      writeFileSync(
        join(emptyRoot, "pnpm-workspace.yaml"),
        "packages:\n",
        "utf8",
      );

      const { status } = runCheckVitestOutputFile(emptyRoot);
      assert.equal(
        status,
        0,
        `Expected exit code 0 (no configs) but got ${status}`,
      );
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 7c: ci.sh source audit — check-vitest-output-file is wired correctly
// ---------------------------------------------------------------------------

describe("ci-guard (vitest output-file check): ci.sh wires check-vitest-output-file as a build step", () => {
  const CI_SH = join(WORKSPACE_ROOT, "ci.sh");

  it("ci.sh calls check-vitest-output-file", () => {
    const src = readFileSync(CI_SH, "utf8");
    assert.ok(
      src.includes("check-vitest-output-file"),
      "Expected ci.sh to invoke check-vitest-output-file as a build step. " +
        "Removing or renaming the step without updating this test is a breaking change.",
    );
  });

  it("check-vitest-output-file step appears before any test steps that write XML", () => {
    const src = readFileSync(CI_SH, "utf8");
    const vitestCheckIdx = src.indexOf("check-vitest-output-file");
    // test:unit is the first step that writes XML — the static check must precede it.
    const testUnitIdx = src.indexOf("test:unit");
    assert.ok(
      vitestCheckIdx !== -1,
      "Expected ci.sh to contain a check-vitest-output-file step",
    );
    assert.ok(testUnitIdx !== -1, "Expected ci.sh to contain a test:unit step");
    assert.ok(
      vitestCheckIdx < testUnitIdx,
      "check-vitest-output-file must appear before test:unit in ci.sh so " +
        "misconfigured suites are caught before any tests run",
    );
  });
});

// ---------------------------------------------------------------------------
// Layer 7d: real-workspace assertion — current workspace has no flagged configs
// ---------------------------------------------------------------------------

describe("ci-guard (vitest output-file check): real workspace has no vitest configs missing outputFile", () => {
  it("findVitestConfigsWithoutOutputFile returns [] for the actual workspace", () => {
    const missing = findVitestConfigsWithoutOutputFile(WORKSPACE_ROOT);
    assert.deepEqual(
      missing,
      [],
      `The following vitest configs reference junit but declare no outputFile:\n` +
        `  ${missing.join("\n  ")}\n` +
        `Add an outputFile declaration (e.g. outputFile: { junit: "test-results/<name>.xml" })\n` +
        `so CI can collect and validate the JUnit report.`,
    );
  });
});
