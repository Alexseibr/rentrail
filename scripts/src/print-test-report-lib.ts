/**
 * print-test-report-lib
 *
 * Pure XML-parsing logic extracted from print-test-report.ts so it can be
 * unit-tested independently of filesystem I/O and process.exit.
 *
 * Exported: attrValue, parseXml, buildGithubSummaryMarkdown, checkExpectedFiles,
 * and the shared result interfaces.
 */

export interface FailedTest {
  suite: string;
  name: string;
  message: string;
}

export interface SuiteSummary {
  name: string;
  total: number;
  failures: number;
  errors: number;
  skipped: number;
}

export interface ParseResult {
  suites: SuiteSummary[];
  failed: FailedTest[];
  /** True when the XML was non-empty but contained no <testsuite> elements. */
  malformed: boolean;
}

/**
 * Extract the value of a named attribute from an XML attribute string.
 *
 * e.g. attrValue(`name="Suite A" tests="5"`, "tests") → "5"
 */
export function attrValue(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`);
  const m = re.exec(attrs);
  return m !== null ? m[1] : undefined;
}

/**
 * Parse a JUnit XML string and return suite summaries and failed test details.
 *
 * Handles:
 *  - <testsuites> outer wrapper (matched by \b to skip the wrapper)
 *  - Self-closing <testcase … /> (passing tests stripped before scanning)
 *  - <failure> and <error> child elements
 *  - message attribute vs. element body for failure reason
 */
export function parseXml(xml: string): ParseResult {
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

  const malformed = suites.length === 0 && xml.trim().length > 0;

  if (malformed) {
    console.warn(
      "[print-test-report] WARNING: XML input was non-empty but contained no" +
        " <testsuite> elements. The file may be malformed, truncated, or use an" +
        " unexpected root element. Summary will be empty.",
    );
  }

  return { suites, failed, malformed };
}

/**
 * Build the Markdown string that is appended to the GitHub Actions job summary
 * ($GITHUB_STEP_SUMMARY). Pure function — no I/O, fully unit-testable.
 *
 * @param fileNames     - All XML report file names that were processed.
 * @param totalTests    - Sum of all test counts across every suite.
 * @param totalFailures - Sum of all failure counts across every suite.
 * @param totalErrors   - Sum of all error counts across every suite.
 * @param allFailed     - Every individual failed/errored test case.
 * @param malformedFiles - File names that produced a malformed-XML warning.
 */
export function buildGithubSummaryMarkdown(
  fileNames: string[],
  totalTests: number,
  totalFailures: number,
  totalErrors: number,
  allFailed: FailedTest[],
  malformedFiles: string[],
): string {
  const lines: string[] = [];
  lines.push("## Test Report");
  lines.push("");
  lines.push(
    `| XML reports | Tests | Failures | Errors |`,
    `|---|---|---|---|`,
    `| ${fileNames.join(", ")} | ${totalTests} | ${totalFailures} | ${totalErrors} |`,
  );
  lines.push("");

  if (malformedFiles.length > 0) {
    lines.push("### ⚠️ Malformed XML files");
    lines.push("");
    lines.push(
      "The following report files were non-empty but contained no" +
        " `<testsuite>` elements. They may be truncated or use an unexpected" +
        " format. Their results are **not** included in the summary above.",
    );
    lines.push("");
    for (const f of malformedFiles) {
      lines.push(`- \`${f}\``);
    }
    lines.push("");
  }

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
  return lines.join("\n") + "\n";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

/**
 * Check that every expected XML report file is present in resultsDir.
 *
 * Returns an array of filenames (basename only) that are absent. An empty
 * array means all expected files were found.
 *
 * This is a pure function over the provided file-existence predicate so it
 * can be unit-tested without touching the real filesystem.
 */
export function checkExpectedFiles(
  expectedFileNames: string[],
  fileExists: (path: string) => boolean,
  resultsDir: string,
): string[] {
  return expectedFileNames.filter(
    (name) => !fileExists(`${resultsDir}/${name}`),
  );
}
