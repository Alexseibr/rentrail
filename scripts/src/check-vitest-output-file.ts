/**
 * check-vitest-output-file
 *
 * Static check: scans all vitest.*.ts config files in the workspace and
 * reports any that reference the junit reporter but have no detectable
 * outputFile declaration (either inline or via a one-level-deep relative
 * import).
 *
 * Motivation: a developer who adds `reporters: ['junit']` to a vitest config
 * but forgets to include an `outputFile` entry causes vitest to write the
 * JUnit XML to stdout rather than to a file.  The CI_XML_FILES scanner
 * (ci-xml-files.ts) then never learns about that suite, so print-test-report
 * cannot check for its report and the failure goes undetected.
 *
 * This check runs early in CI (before any tests) so the developer sees a
 * clear error message rather than discovering a silent gap after the fact.
 *
 * Exit codes:
 *   0  — every vitest config that uses junit declares an outputFile
 *   1  — at least one vitest config has junit but no outputFile declaration
 *
 * Usage (called by ci.sh):
 *   pnpm --filter @workspace/scripts run check-vitest-output-file
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findVitestConfigsWithoutOutputFile } from "./ci-xml-files.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_WORKSPACE_ROOT = join(__dirname, "../..");

// Allow tests to override the workspace root so the script can be spawned
// against a synthetic temp workspace without touching the real one.
const WORKSPACE_ROOT =
  process.env["CHECK_WORKSPACE_ROOT"] ?? DEFAULT_WORKSPACE_ROOT;

function run(): void {
  const missing = findVitestConfigsWithoutOutputFile(WORKSPACE_ROOT);

  if (missing.length === 0) {
    process.exit(0);
  }

  console.error(
    `\n✗  ${missing.length} vitest config(s) reference the junit reporter but declare no outputFile:\n`,
  );
  for (const p of missing) {
    console.error(`     ${p}`);
  }
  console.error(
    `\nWithout an outputFile declaration vitest writes JUnit XML to stdout,\n` +
      `so CI can never collect or validate the report for that suite.\n` +
      `\nAdd one of the following to the vitest config (or to a shared helper\n` +
      `it imports from):\n` +
      `\n` +
      `  outputFile: { junit: "test-results/<name>.xml" }   ← per-reporter object\n` +
      `  outputFile: "test-results/<name>.xml"               ← plain string (single reporter)\n` +
      `  ['junit', { outputFile: 'test-results/<name>.xml' }]  ← reporter-tuple\n` +
      `\nThe filename must start with test-results/ so the scanner can track it.\n`,
  );
  process.exit(1);
}

run();
