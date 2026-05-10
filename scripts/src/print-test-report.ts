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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/src/ -> scripts/ -> workspace root
const WORKSPACE_ROOT = join(__dirname, "../..");
const RESULTS_DIR = join(WORKSPACE_ROOT, "test-results");

interface FailedTest {
  suite: string;
  name: string;
  message: string;
}

interface SuiteSummary {
  name: string;
  total: number;
  failures: number;
  errors: number;
  skipped: number;
}

interface ParseResult {
  suites: SuiteSummary[];
  failed: FailedTest[];
}

function attrValue(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`);
  const m = re.exec(attrs);
  return m !== null ? m[1] : undefined;
}

function parseXml(xml: string): ParseResult {
  const suites: SuiteSummary[] = [];
  const failed: FailedTest[] = [];

  // \b prevents matching <testsuites> (the outer wrapper element)
  const suiteRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g;
  let suiteMatch: RegExpExecArray | null;

  while ((suiteMatch = suiteRe.exec(xml)) !== null) {
    const attrs = suiteMatch[1] ?? "";
    const body = suiteMatch[2] ?? "";

    const name = attrValue(attrs, "name") ?? "unknown";
    const total = parseInt(attrValue(attrs, "tests") ?? "0", 10);
    const failures = parseInt(attrValue(attrs, "failures") ?? "0", 10);
    const errors = parseInt(attrValue(attrs, "errors") ?? "0", 10);
    const skipped = parseInt(attrValue(attrs, "skipped") ?? "0", 10);

    suites.push({ name, total, failures, errors, skipped });

    // Strip self-closing <testcase ... /> elements (passing tests) before
    // scanning for failures. Without this, the [^>]* in the open-tag match
    // would consume the `/` of `/>`, then the regex `>` would match the
    // closing `>`, and the body would span across to the *next* </testcase>.
    const bodyWithoutPassing = body.replace(/<testcase[^>]*\/>/g, "");

    const testcaseRe = /<testcase([^>]*)>([\s\S]*?)<\/testcase>/g;
    let tcMatch: RegExpExecArray | null;

    while ((tcMatch = testcaseRe.exec(bodyWithoutPassing)) !== null) {
      const tcAttrs = tcMatch[1] ?? "";
      const tcBody = tcMatch[2] ?? "";

      const hasFailure = tcBody.includes("<failure");
      const hasError = tcBody.includes("<error");
      if (!hasFailure && !hasError) continue;

      const testName = attrValue(tcAttrs, "name") ?? "unknown test";

      // Match whichever element is present: <failure> takes priority, then <error>
      const nodeTag = hasFailure ? "failure" : "error";
      const nodeRe = new RegExp(
        `<${nodeTag}([^>]*)>([\\s\\S]*?)<\\/${nodeTag}>`,
      );
      const nodeMatch = nodeRe.exec(tcBody);
      let message = "";

      if (nodeMatch !== null) {
        const fromAttr = attrValue(nodeMatch[1] ?? "", "message");
        if (fromAttr !== undefined && fromAttr.trim().length > 0) {
          message = fromAttr.trim();
        } else {
          message = (nodeMatch[2] ?? "").trim().split("\n")[0] ?? "";
        }
      }

      failed.push({ suite: name, name: testName, message });
    }
  }

  return { suites, failed };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

/**
 * Append Markdown to $GITHUB_STEP_SUMMARY so failed test names appear in the
 * structured GitHub Actions job summary UI (the "Summary" tab on a workflow
 * run page). No-ops when the env var is absent (local / non-GitHub CI).
 */
function writeGithubSummary(
  fileNames: string[],
  totalTests: number,
  totalFailures: number,
  totalErrors: number,
  allFailed: FailedTest[],
): void {
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (!summaryPath) return;

  const lines: string[] = [];
  lines.push("## Test Report");
  lines.push("");
  lines.push(
    `| XML reports | Tests | Failures | Errors |`,
    `|---|---|---|---|`,
    `| ${fileNames.join(", ")} | ${totalTests} | ${totalFailures} | ${totalErrors} |`,
  );
  lines.push("");

  if (allFailed.length === 0) {
    lines.push("✅ All tests passed.");
  } else {
    lines.push(`### ❌ Failed tests (${allFailed.length})`);
    lines.push("");
    lines.push("| Test | Suite | Reason |", "|---|---|---|");
    for (const { suite, name, message } of allFailed) {
      const safeMessage = truncate(message.replace(/\|/g, "\\|"), 100);
      lines.push(`| ${name} | ${suite} | ${safeMessage} |`);
    }
  }

  lines.push("");
  appendFileSync(summaryPath, lines.join("\n") + "\n");
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

  for (const file of xmlFiles) {
    const xml = readFileSync(file, "utf8");
    const { suites, failed } = parseXml(xml);

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

  // ── GitHub Actions job summary (structured UI, appears in Summary tab) ───

  writeGithubSummary(
    fileNames,
    totalTests,
    totalFailures,
    totalErrors,
    allFailed,
  );
}

run();
