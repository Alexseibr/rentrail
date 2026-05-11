/**
 * print-test-report
 *
 * Reads every JUnit XML file in test-results/ and prints a human-readable
 * summary of any failed test cases. Designed to run as a post-step in CI so
 * failures are immediately visible without scrolling through verbose output.
 *
 * When running inside GitHub Actions (GITHUB_STEP_SUMMARY is set), a Markdown
 * version of the same summary is appended to the job summary page so failed
 * test names appear in the structured CI UI without having to open raw logs.
 *
 * Always exits 0 — the actual failure exit codes come from the test commands
 * themselves. This script only reports.
 */

import { readFileSync, readdirSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseXml,
  buildGithubSummaryMarkdown,
  type FailedTest,
} from "./print-test-report-lib.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/src/ -> scripts/ -> workspace root
const WORKSPACE_ROOT = join(__dirname, "../..");
const RESULTS_DIR = join(WORKSPACE_ROOT, "test-results");

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

/**
 * Append Markdown to $GITHUB_STEP_SUMMARY so failed test names and any
 * malformed-XML warnings appear in the structured GitHub Actions job summary
 * UI (the "Summary" tab on a workflow run page). No-ops when the env var is
 * absent (local / non-GitHub CI).
 */
function writeGithubSummary(
  fileNames: string[],
  totalTests: number,
  totalFailures: number,
  totalErrors: number,
  allFailed: FailedTest[],
  malformedFiles: string[],
): void {
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (!summaryPath) return;

  const markdown = buildGithubSummaryMarkdown(
    fileNames,
    totalTests,
    totalFailures,
    totalErrors,
    allFailed,
    malformedFiles,
  );
  appendFileSync(summaryPath, markdown);
}

function run(): void {
  if (!existsSync(RESULTS_DIR)) {
    console.log(
      "\nℹ  No test-results/ directory found — no XML reports to display.\n",
    );
    return;
  }

  const fileNames = readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith(".xml"))
    .sort();

  const xmlFiles = fileNames.map((f) => join(RESULTS_DIR, f));

  if (xmlFiles.length === 0) {
    console.log(
      "\nℹ  No XML report files found in test-results/ — no report to display.\n",
    );
    return;
  }

  let totalTests = 0;
  let totalFailures = 0;
  let totalErrors = 0;
  const allFailed: FailedTest[] = [];
  const malformedFiles: string[] = [];

  for (const file of xmlFiles) {
    const fileName = fileNames[xmlFiles.indexOf(file)] ?? file;
    const xml = readFileSync(file, "utf8");
    const { suites, failed, malformed } = parseXml(xml);

    if (malformed) {
      malformedFiles.push(fileName);
    }

    for (const s of suites) {
      totalTests += s.total;
      totalFailures += s.failures;
      totalErrors += s.errors;
    }

    allFailed.push(...failed);
  }

  // ── stdout summary (visible in local runs and raw CI logs) ───────────────

  const divider = "─".repeat(60);

  console.log("");
  console.log(divider);
  console.log("  Test Report Summary");
  console.log(divider);
  console.log(`  XML reports  : ${fileNames.join(", ")}`);
  console.log(`  Total tests  : ${totalTests}`);
  console.log(`  Failures     : ${totalFailures}`);
  console.log(`  Errors       : ${totalErrors}`);
  console.log(divider);

  if (allFailed.length === 0) {
    console.log("  ✓ All tests passed.");
    console.log(divider);
    console.log("");
  } else {
    console.log(`\n  Failed tests (${allFailed.length}):\n`);

    for (const { suite, name, message } of allFailed) {
      console.log(`  ✗  ${name}`);
      console.log(`     Suite  : ${suite}`);
      if (message.length > 0) {
        console.log(`     Reason : ${truncate(message, 120)}`);
      }
      console.log("");
    }

    console.log(divider);
    console.log("");
  }

  if (malformedFiles.length > 0) {
    console.log(
      `  ⚠  Malformed XML (${malformedFiles.length}): ${malformedFiles.join(", ")}`,
    );
    console.log(divider);
    console.log("");
  }

  // ── GitHub Actions job summary (structured UI, appears in Summary tab) ───

  writeGithubSummary(
    fileNames,
    totalTests,
    totalFailures,
    totalErrors,
    allFailed,
    malformedFiles,
  );
}

run();
