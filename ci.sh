#!/usr/bin/env bash
# ci.sh — Full CI pipeline with structured test report
#
# A trap ensures the JUnit XML report always prints at the end, even when a
# test step fails. All steps are run with set -euo pipefail so any failure
# causes an immediate non-zero exit, which then triggers the trap.
#
# Usage: bash ci.sh  (called by `pnpm run ci`)

set -euo pipefail

# Ensure the test-results directory exists before any test command runs.
mkdir -p test-results

# Derive the expected XML basenames from test-command declarations.
# collect-xml-files scans package.json --outputFile.junit flags and vitest
# config outputFile.junit entries — adding a new test suite automatically
# extends the guard without a separate manual edit to this file.
EXPECTED_XMLS=$(pnpm --filter @workspace/scripts run --silent collect-xml-files)

# Always print the structured XML test report on exit, pass or fail.
# print-test-report exits non-zero if any expected file is absent, catching a
# silently-crashed test runner before it would otherwise go undetected.
trap "pnpm --filter @workspace/scripts run print-test-report -- $EXPECTED_XMLS" EXIT

echo ""
echo "▶ [1/12] typecheck"
pnpm run typecheck

echo ""
echo "▶ [2/12] type-coverage"
pnpm run type-coverage

echo ""
echo "▶ [3/12] check-map-cleanup"
pnpm run check-map-cleanup

echo ""
echo "▶ [4/12] codegen:check"
pnpm run codegen:check

echo ""
echo "▶ [5/12] scripts: test"
pnpm --filter @workspace/scripts run test

echo ""
echo "▶ [6/12] scripts: test-map-cleanup"
pnpm --filter @workspace/scripts run test-map-cleanup

echo ""
echo "▶ [7/12] test:unit"
pnpm run test:unit

echo ""
echo "▶ [8/12] test:integration (standalone config, bail on first failure)"
pnpm run test:integration

echo ""
echo "▶ [9/12] test:api"
pnpm run test:api

echo ""
echo "▶ [10/12] check-undeclared-xml"
pnpm --filter @workspace/scripts run check-undeclared-xml

echo ""
echo "▶ [11/12] format:check"
pnpm run format:check

echo ""
echo "▶ [12/12] lint:eslint"
pnpm run lint:eslint

echo ""
echo "✓ All CI checks passed."
