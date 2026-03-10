/**
 * check-undeclared-xml
 *
 * Enforcement gate: reads every *.xml file that is present in test-results/
 * and verifies that each one is listed in the declared set produced by
 * collect-xml-files (i.e. CI_XML_FILES from ci-xml-files.ts).
 *
 * Motivation: a developer can still run a test suite that writes a JUnit XML
 * file using a pattern the scanner does not recognise (a custom script
 * wrapper, a Makefile-based runner, a raw CLI invocation not stored in any
 * package.json).  The scanner-based CI_XML_FILES list would then be missing
 * that file, which means it would never be checked by print-test-report and
 * could silently harbour failures.  This gate catches such omissions.
 *
 * Exit codes:
 *   0  — every *.xml in test-results/ is declared (or the directory is absent)
 *   1  — at least one *.xml is present on disk but absent from the declared list
 *
 * Environment:
 *   TEST_RESULTS_DIR  — override the results directory (used by tests)
 *
 * Usage (called by ci.sh):
 *   pnpm --filter @workspace/scripts run check-undeclared-xml
 */

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CI_XML_FILES } from "./ci-xml-files.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = join(__dirname, "../..");

const RESULTS_DIR =
  process.env["TEST_RESULTS_DIR"] ?? join(WORKSPACE_ROOT, "test-results");

function run(): void {
  let onDisk: string[];
  try {
    onDisk = readdirSync(RESULTS_DIR).filter((f) => f.endsWith(".xml"));
  } catch {
    // Directory absent — nothing to check.
    process.exit(0);
  }

  const declared = new Set(CI_XML_FILES);
  const undeclared = onDisk.filter((f) => !declared.has(f));

  if (undeclared.length === 0) {
    process.exit(0);
  }

  console.error(
    `\n✗  ${undeclared.length} XML file(s) found in test-results/ that are NOT listed by the scanner:\n`,
  );
  for (const name of undeclared) {
    console.error(`     ${name}`);
  }
  console.error(
    `\nThis means a test suite is writing a JUnit XML file without using a\n` +
      `recognised declaration pattern:\n` +
      `  • --outputFile.junit=test-results/<name>.xml  (in a package.json script)\n` +
      `  • outputFile: { junit: "test-results/<name>.xml" }  (in a vitest.*.ts config)\n` +
      `  • outputFile: "test-results/<name>.xml"            (in a vitest.*.ts config)\n` +
      `  • ['junit', { outputFile: 'test-results/<name>.xml' }]  (reporter-tuple)\n` +
      `\nAdd one of the above to your test configuration so the scanner can track it.\n`,
  );
  process.exit(1);
}

run();
