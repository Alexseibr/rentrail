/**
 * Unit tests for print-test-report-lib.ts
 *
 * Covers:
 *   - attrValue: attribute extraction from XML attribute strings
 *   - parseXml: all-passing suites, mixed pass/fail, multiple suites,
 *               <testsuites> wrapper, self-closing testcase tags,
 *               attribute-vs-body failure messages, long (multi-line) messages,
 *               malformed flag
 *   - buildGithubSummaryMarkdown: summary table, ⚠️ malformed section,
 *               ✅ all-passed, ❌ failed tests table
 *
 * Run: pnpm --filter @workspace/scripts run test
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  attrValue,
  parseXml,
  buildGithubSummaryMarkdown,
} from "./print-test-report-lib.js";

// ---------------------------------------------------------------------------
// attrValue
// ---------------------------------------------------------------------------

describe("attrValue", () => {
  it("extracts a simple string attribute", () => {
    assert.equal(attrValue(`name="Suite A"`, "name"), "Suite A");
  });

  it("extracts a numeric attribute", () => {
    assert.equal(attrValue(`tests="42"`, "tests"), "42");
  });

  it("extracts the correct attribute when multiple are present", () => {
    const attrs = `name="My Suite" tests="10" failures="2" errors="0" skipped="1"`;
    assert.equal(attrValue(attrs, "name"), "My Suite");
    assert.equal(attrValue(attrs, "tests"), "10");
    assert.equal(attrValue(attrs, "failures"), "2");
    assert.equal(attrValue(attrs, "skipped"), "1");
  });

  it("returns undefined for a missing attribute", () => {
    assert.equal(attrValue(`name="Suite A"`, "tests"), undefined);
  });

  it("returns empty string for an empty attribute value", () => {
    assert.equal(attrValue(`message=""`, "message"), "");
  });

  it("does not match a partial attribute name (word-boundary check)", () => {
    assert.equal(attrValue(`classname="com.example"`, "name"), undefined);
  });
});

// ---------------------------------------------------------------------------
// Helpers — XML builders
// ---------------------------------------------------------------------------

function makeSuite(
  opts: {
    name?: string;
    tests?: number;
    failures?: number;
    errors?: number;
    skipped?: number;
    body?: string;
  } = {},
): string {
  const name = opts.name ?? "Test Suite";
  const tests = opts.tests ?? 0;
  const failures = opts.failures ?? 0;
  const errors = opts.errors ?? 0;
  const skipped = opts.skipped ?? 0;
  const body = opts.body ?? "";
  return `<testsuite name="${name}" tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}">${body}</testsuite>`;
}

function makePassingTestcase(name: string): string {
  return `<testcase name="${name}" classname="foo" time="0.1" />`;
}

function makeFailingTestcase(
  name: string,
  messageAttr: string,
  bodyText = "",
): string {
  const attr = messageAttr ? ` message="${messageAttr}"` : "";
  return `<testcase name="${name}" classname="foo"><failure${attr}>${bodyText}</failure></testcase>`;
}

function makeErrorTestcase(
  name: string,
  messageAttr: string,
  bodyText = "",
): string {
  const attr = messageAttr ? ` message="${messageAttr}"` : "";
  return `<testcase name="${name}" classname="foo"><error${attr}>${bodyText}</error></testcase>`;
}

// ---------------------------------------------------------------------------
// parseXml — all-passing suites
// ---------------------------------------------------------------------------

describe("parseXml — all-passing suite", () => {
  it("returns the suite summary with zero failed tests", () => {
    const xml = makeSuite({
      name: "All Green",
      tests: 3,
      body:
        makePassingTestcase("test one") +
        makePassingTestcase("test two") +
        makePassingTestcase("test three"),
    });
    const { suites, failed } = parseXml(xml);
    assert.equal(suites.length, 1);
    assert.equal(suites[0]?.name, "All Green");
    assert.equal(suites[0]?.total, 3);
    assert.equal(suites[0]?.failures, 0);
    assert.equal(failed.length, 0);
  });

  it("returns empty arrays for completely empty XML", () => {
    const { suites, failed } = parseXml("");
    assert.deepEqual(suites, []);
    assert.deepEqual(failed, []);
  });

  it("ignores XML that has no <testsuite> element", () => {
    const { suites, failed } = parseXml(
      `<?xml version="1.0"?><report><summary/></report>`,
    );
    assert.deepEqual(suites, []);
    assert.deepEqual(failed, []);
  });
});

// ---------------------------------------------------------------------------
// parseXml — mixed pass/fail
// ---------------------------------------------------------------------------

describe("parseXml — mixed pass/fail", () => {
  it("correctly identifies the one failing test in a suite with passing tests", () => {
    const xml = makeSuite({
      name: "Mixed Suite",
      tests: 3,
      failures: 1,
      body:
        makePassingTestcase("passes fine") +
        makeFailingTestcase("breaks badly", "Expected 1 got 2") +
        makePassingTestcase("also passes"),
    });
    const { suites, failed } = parseXml(xml);
    assert.equal(suites.length, 1);
    assert.equal(suites[0]?.failures, 1);
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.name, "breaks badly");
    assert.equal(failed[0]?.suite, "Mixed Suite");
    assert.equal(failed[0]?.message, "Expected 1 got 2");
  });

  it("captures all failing tests when multiple fail", () => {
    const xml = makeSuite({
      name: "Two Failures",
      tests: 4,
      failures: 2,
      body:
        makePassingTestcase("ok") +
        makeFailingTestcase("fail A", "reason A") +
        makeFailingTestcase("fail B", "reason B") +
        makePassingTestcase("ok2"),
    });
    const { failed } = parseXml(xml);
    assert.equal(failed.length, 2);
    assert.equal(failed[0]?.name, "fail A");
    assert.equal(failed[1]?.name, "fail B");
  });
});

// ---------------------------------------------------------------------------
// parseXml — multiple suites
// ---------------------------------------------------------------------------

describe("parseXml — multiple suites", () => {
  it("accumulates suites and failures from several <testsuite> elements", () => {
    const xml =
      makeSuite({
        name: "Suite Alpha",
        tests: 2,
        failures: 1,
        body:
          makePassingTestcase("a1") +
          makeFailingTestcase("a2 fails", "alpha error"),
      }) +
      makeSuite({
        name: "Suite Beta",
        tests: 3,
        failures: 0,
        body:
          makePassingTestcase("b1") +
          makePassingTestcase("b2") +
          makePassingTestcase("b3"),
      }) +
      makeSuite({
        name: "Suite Gamma",
        tests: 1,
        failures: 1,
        body: makeFailingTestcase("g1 fails", "gamma error"),
      });

    const { suites, failed } = parseXml(xml);

    assert.equal(suites.length, 3);
    assert.equal(suites[0]?.name, "Suite Alpha");
    assert.equal(suites[1]?.name, "Suite Beta");
    assert.equal(suites[2]?.name, "Suite Gamma");

    assert.equal(failed.length, 2);
    assert.equal(failed[0]?.suite, "Suite Alpha");
    assert.equal(failed[1]?.suite, "Suite Gamma");
  });
});

// ---------------------------------------------------------------------------
// parseXml — <testsuites> wrapper element
// ---------------------------------------------------------------------------

describe("parseXml — <testsuites> wrapper", () => {
  it("parses suites correctly when wrapped in a <testsuites> root element", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="all tests" tests="4" failures="1" time="1.234">
  ${makeSuite({
    name: "Inner Suite",
    tests: 4,
    failures: 1,
    body:
      makePassingTestcase("p1") +
      makePassingTestcase("p2") +
      makePassingTestcase("p3") +
      makeFailingTestcase("f1", "wrapped failure"),
  })}
</testsuites>`;

    const { suites, failed } = parseXml(xml);
    assert.equal(suites.length, 1);
    assert.equal(suites[0]?.name, "Inner Suite");
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.message, "wrapped failure");
  });

  it("does NOT treat the <testsuites> wrapper itself as a suite", () => {
    const xml = `<testsuites name="wrapper" tests="1" failures="0">
  ${makeSuite({ name: "Real Suite", tests: 1, body: makePassingTestcase("p1") })}
</testsuites>`;
    const { suites } = parseXml(xml);
    assert.equal(suites.length, 1);
    assert.equal(suites[0]?.name, "Real Suite");
  });

  it("handles multiple <testsuite> elements inside <testsuites>", () => {
    const xml = `<testsuites>
  ${makeSuite({ name: "S1", tests: 1, body: makePassingTestcase("t1") })}
  ${makeSuite({ name: "S2", tests: 1, failures: 1, body: makeFailingTestcase("t2", "err") })}
</testsuites>`;
    const { suites, failed } = parseXml(xml);
    assert.equal(suites.length, 2);
    assert.equal(failed.length, 1);
  });
});

// ---------------------------------------------------------------------------
// parseXml — self-closing testcase tags
// ---------------------------------------------------------------------------

describe("parseXml — self-closing testcase tags", () => {
  it("does not count a self-closing <testcase /> as a failure", () => {
    const xml = makeSuite({
      name: "Self-Closing Suite",
      tests: 2,
      failures: 1,
      body: `<testcase name="passing" classname="foo" time="0.01" />
             <testcase name="failing" classname="foo"><failure message="oops"/></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.name, "failing");
  });

  it("handles a suite of only self-closing passing testcases without error", () => {
    const body = Array.from({ length: 5 }, (_, i) =>
      makePassingTestcase(`test ${i}`),
    ).join("\n");
    const xml = makeSuite({ name: "All Self-Closing", tests: 5, body });
    const { suites, failed } = parseXml(xml);
    assert.equal(suites.length, 1);
    assert.equal(failed.length, 0);
  });

  it("correctly handles adjacent self-closing and open/close testcases", () => {
    const xml = makeSuite({
      name: "Mixed Tags",
      tests: 4,
      failures: 1,
      body: `<testcase name="sc1" />
             <testcase name="sc2" />
             <testcase name="fail1"><failure message="fail here"/></testcase>
             <testcase name="sc3" />`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.name, "fail1");
  });
});

// ---------------------------------------------------------------------------
// parseXml — failure message: attribute vs. body text
// ---------------------------------------------------------------------------

describe("parseXml — attribute vs. body failure messages", () => {
  it("prefers the message attribute when present and non-empty", () => {
    const xml = makeSuite({
      name: "Attr Suite",
      tests: 1,
      failures: 1,
      body: `<testcase name="t1"><failure message="from attribute">body text here</failure></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed[0]?.message, "from attribute");
  });

  it("falls back to body text when message attribute is absent", () => {
    const xml = makeSuite({
      name: "Body Suite",
      tests: 1,
      failures: 1,
      body: `<testcase name="t1"><failure>First line of body
Second line not included</failure></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed[0]?.message, "First line of body");
  });

  it("falls back to body text when message attribute is empty string", () => {
    const xml = makeSuite({
      name: "Empty Attr Suite",
      tests: 1,
      failures: 1,
      body: `<testcase name="t1"><failure message="">body fallback text</failure></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed[0]?.message, "body fallback text");
  });

  it("falls back to body text when message attribute is whitespace only", () => {
    const xml = makeSuite({
      name: "Whitespace Attr Suite",
      tests: 1,
      failures: 1,
      body: `<testcase name="t1"><failure message="   ">body fallback</failure></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed[0]?.message, "body fallback");
  });

  it("returns empty string message when both attribute and body are absent", () => {
    const xml = makeSuite({
      name: "Empty Suite",
      tests: 1,
      failures: 1,
      body: `<testcase name="t1"><failure></failure></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed[0]?.message, "");
  });
});

// ---------------------------------------------------------------------------
// parseXml — long (multi-line) failure messages truncated to first line
// ---------------------------------------------------------------------------

describe("parseXml — long failure messages", () => {
  it("takes only the first line of a multi-line body text", () => {
    const longBody = `AssertionError: values are not equal
  + actual: 42
  - expected: 99
  at Object.<anonymous> (test.ts:15:5)
  at processTicksAndRejections (internal/process/task_queues.js:95:5)`;

    const xml = makeSuite({
      name: "Long Msg Suite",
      tests: 1,
      failures: 1,
      body: `<testcase name="long fail"><failure>${longBody}</failure></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed[0]?.message, "AssertionError: values are not equal");
  });

  it("message attribute is used as-is even when it is very long", () => {
    const longAttr = "x".repeat(300);
    const xml = makeSuite({
      name: "Long Attr Suite",
      tests: 1,
      failures: 1,
      body: `<testcase name="long attr fail"><failure message="${longAttr}">ignored body</failure></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed[0]?.message, longAttr);
  });
});

// ---------------------------------------------------------------------------
// parseXml — <error> element (not <failure>)
// ---------------------------------------------------------------------------

describe("parseXml — <error> element", () => {
  it("reports a test with <error> child as failed", () => {
    const xml = makeSuite({
      name: "Error Suite",
      tests: 1,
      errors: 1,
      body: makeErrorTestcase("erroring test", "something crashed"),
    });
    const { failed } = parseXml(xml);
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.name, "erroring test");
    assert.equal(failed[0]?.message, "something crashed");
  });

  it("prefers <failure> over <error> when both are present", () => {
    const xml = makeSuite({
      name: "Both Suite",
      tests: 1,
      failures: 1,
      body: `<testcase name="both"><failure message="failure wins"></failure><error message="error loses"></error></testcase>`,
    });
    const { failed } = parseXml(xml);
    assert.equal(failed[0]?.message, "failure wins");
  });
});

// ---------------------------------------------------------------------------
// parseXml — malformed / unexpected-root-element (warning detection)
// ---------------------------------------------------------------------------

describe("parseXml — malformed or unexpected XML warns and returns empty", () => {
  it("emits a console.warn when a non-empty XML string yields no suites", () => {
    const warnSpy = mock.method(console, "warn", () => undefined);
    try {
      const { suites, failed, malformed } = parseXml(
        `<?xml version="1.0"?><report><summary/></report>`,
      );
      assert.equal(warnSpy.mock.calls.length, 1);
      const msg: unknown = warnSpy.mock.calls[0]?.arguments[0];
      assert.ok(
        typeof msg === "string" && msg.includes("[print-test-report]"),
        `Expected warning to mention [print-test-report], got: ${String(msg)}`,
      );
      assert.deepEqual(suites, []);
      assert.deepEqual(failed, []);
      assert.equal(malformed, true);
    } finally {
      warnSpy.mock.restore();
    }
  });

  it("emits a console.warn for truncated XML that cuts off mid-element", () => {
    const warnSpy = mock.method(console, "warn", () => undefined);
    try {
      const { suites, failed, malformed } = parseXml(
        `<?xml version="1.0"?><testsuites><testsuite name="S"`,
      );
      assert.equal(warnSpy.mock.calls.length, 1);
      assert.deepEqual(suites, []);
      assert.deepEqual(failed, []);
      assert.equal(malformed, true);
    } finally {
      warnSpy.mock.restore();
    }
  });

  it("emits a console.warn for XML with only a processing instruction and no suites", () => {
    const warnSpy = mock.method(console, "warn", () => undefined);
    try {
      const { suites, malformed } = parseXml(
        `<?xml version="1.0" encoding="UTF-8"?>`,
      );
      assert.equal(warnSpy.mock.calls.length, 1);
      assert.deepEqual(suites, []);
      assert.equal(malformed, true);
    } finally {
      warnSpy.mock.restore();
    }
  });

  it("does NOT emit a console.warn for a completely empty string", () => {
    const warnSpy = mock.method(console, "warn", () => undefined);
    try {
      const { suites, failed, malformed } = parseXml("");
      assert.equal(warnSpy.mock.calls.length, 0);
      assert.deepEqual(suites, []);
      assert.deepEqual(failed, []);
      assert.equal(malformed, false);
    } finally {
      warnSpy.mock.restore();
    }
  });

  it("does NOT emit a console.warn for a whitespace-only string", () => {
    const warnSpy = mock.method(console, "warn", () => undefined);
    try {
      const { suites, malformed } = parseXml("   \n\t  ");
      assert.equal(warnSpy.mock.calls.length, 0);
      assert.deepEqual(suites, []);
      assert.equal(malformed, false);
    } finally {
      warnSpy.mock.restore();
    }
  });

  it("does NOT emit a console.warn when suites are successfully parsed", () => {
    const warnSpy = mock.method(console, "warn", () => undefined);
    try {
      const xml = makeSuite({
        name: "Good Suite",
        tests: 1,
        body: makePassingTestcase("t1"),
      });
      const { suites, malformed } = parseXml(xml);
      assert.equal(warnSpy.mock.calls.length, 0);
      assert.equal(suites.length, 1);
      assert.equal(malformed, false);
    } finally {
      warnSpy.mock.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// buildGithubSummaryMarkdown
// ---------------------------------------------------------------------------

describe("buildGithubSummaryMarkdown — structure", () => {
  it("includes the ## Test Report heading", () => {
    const md = buildGithubSummaryMarkdown(["r.xml"], 5, 0, 0, [], []);
    assert.ok(md.includes("## Test Report"), "Missing heading");
  });

  it("includes a stats table row with the supplied file name and counts", () => {
    const md = buildGithubSummaryMarkdown(["results.xml"], 10, 2, 1, [], []);
    assert.ok(md.includes("results.xml"), "Missing file name in table");
    assert.ok(md.includes("10"), "Missing test count");
    assert.ok(md.includes("2"), "Missing failure count");
    assert.ok(md.includes("1"), "Missing error count");
  });

  it("shows ✅ all-passed message when there are no failures", () => {
    const md = buildGithubSummaryMarkdown(["ok.xml"], 3, 0, 0, [], []);
    assert.ok(md.includes("✅ All tests passed."), "Missing all-passed line");
    assert.ok(!md.includes("❌"), "Should not contain failure heading");
  });
});

describe("buildGithubSummaryMarkdown — failed tests section", () => {
  it("includes failed test name and suite in the table", () => {
    const failed = [
      { suite: "My Suite", name: "breaks badly", message: "Expected 1 got 2" },
    ];
    const md = buildGithubSummaryMarkdown(["r.xml"], 1, 1, 0, failed, []);
    assert.ok(
      md.includes("### ❌ Failed tests (1)"),
      "Missing failures heading",
    );
    assert.ok(md.includes("breaks badly"), "Missing test name");
    assert.ok(md.includes("My Suite"), "Missing suite name");
    assert.ok(md.includes("Expected 1 got 2"), "Missing message");
  });

  it("truncates long failure messages to 100 characters in the table", () => {
    const longMsg = "x".repeat(150);
    const failed = [{ suite: "S", name: "t", message: longMsg }];
    const md = buildGithubSummaryMarkdown(["r.xml"], 1, 1, 0, failed, []);
    assert.ok(!md.includes(longMsg), "Long message should be truncated");
    assert.ok(md.includes("..."), "Truncation marker expected");
  });

  it("escapes pipe characters in failure messages to avoid breaking the table", () => {
    const failed = [{ suite: "S", name: "t", message: "a | b | c" }];
    const md = buildGithubSummaryMarkdown(["r.xml"], 1, 1, 0, failed, []);
    assert.ok(md.includes("a \\| b \\| c"), "Pipes should be escaped");
  });

  it("lists multiple failed tests", () => {
    const failed = [
      { suite: "S", name: "fail A", message: "reason A" },
      { suite: "S", name: "fail B", message: "reason B" },
    ];
    const md = buildGithubSummaryMarkdown(["r.xml"], 2, 2, 0, failed, []);
    assert.ok(md.includes("fail A"), "Missing fail A");
    assert.ok(md.includes("fail B"), "Missing fail B");
  });
});

describe("buildGithubSummaryMarkdown — malformed files section", () => {
  it("includes a ⚠️ section when malformed files are provided", () => {
    const md = buildGithubSummaryMarkdown(
      ["good.xml", "bad.xml"],
      5,
      0,
      0,
      [],
      ["bad.xml"],
    );
    assert.ok(
      md.includes("### ⚠️ Malformed XML files"),
      "Missing malformed heading",
    );
    assert.ok(md.includes("`bad.xml`"), "Missing malformed file name");
  });

  it("lists multiple malformed files", () => {
    const md = buildGithubSummaryMarkdown(
      ["a.xml", "b.xml", "c.xml"],
      0,
      0,
      0,
      [],
      ["a.xml", "c.xml"],
    );
    assert.ok(md.includes("`a.xml`"), "Missing a.xml");
    assert.ok(md.includes("`c.xml`"), "Missing c.xml");
  });

  it("does NOT include the ⚠️ section when no malformed files are provided", () => {
    const md = buildGithubSummaryMarkdown(["ok.xml"], 3, 0, 0, [], []);
    assert.ok(!md.includes("⚠️"), "Should not contain warning emoji");
    assert.ok(
      !md.includes("Malformed XML files"),
      "Should not contain malformed section",
    );
  });

  it("shows both the malformed warning and the failed tests table when both are present", () => {
    const failed = [{ suite: "S", name: "t1", message: "oops" }];
    const md = buildGithubSummaryMarkdown(
      ["good.xml", "bad.xml"],
      2,
      1,
      0,
      failed,
      ["bad.xml"],
    );
    assert.ok(
      md.includes("⚠️ Malformed XML files"),
      "Missing malformed section",
    );
    assert.ok(md.includes("❌ Failed tests"), "Missing failed section");
  });
});

// ---------------------------------------------------------------------------
// parseXml — suite attribute defaults
// ---------------------------------------------------------------------------

describe("parseXml — suite attribute defaults", () => {
  it("defaults missing name to 'unknown'", () => {
    const xml = `<testsuite tests="1"></testsuite>`;
    const { suites } = parseXml(xml);
    assert.equal(suites[0]?.name, "unknown");
  });

  it("defaults missing numeric attributes to 0", () => {
    const xml = `<testsuite name="Minimal"></testsuite>`;
    const { suites } = parseXml(xml);
    assert.equal(suites[0]?.total, 0);
    assert.equal(suites[0]?.failures, 0);
    assert.equal(suites[0]?.errors, 0);
    assert.equal(suites[0]?.skipped, 0);
  });

  it("parses skipped count correctly", () => {
    const xml = makeSuite({ name: "Skip Suite", tests: 5, skipped: 2 });
    const { suites } = parseXml(xml);
    assert.equal(suites[0]?.skipped, 2);
  });
});
