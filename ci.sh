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

# Always print the structured XML test report on exit, pass or fail.
trap 'pnpm --filter @workspace/scripts run print-test-report' EXIT

echo ""
echo "▶ [1/11] typecheck"
pnpm run typecheck

echo ""
echo "▶ [2/11] type-coverage"
pnpm run type-coverage

echo ""
echo "▶ [3/11] check-map-cleanup"
pnpm run check-map-cleanup

echo ""
echo "▶ [4/11] codegen:check"
pnpm run codegen:check

echo ""
echo "▶ [5/11] scripts: test"
pnpm --filter @workspace/scripts run test

echo ""
echo "▶ [6/11] scripts: test-map-cleanup"
pnpm --filter @workspace/scripts run test-map-cleanup

echo ""
echo "▶ [7/11] test:unit"
pnpm run test:unit

echo ""
echo "▶ [8/11] test:integration (standalone config, bail on first failure)"
pnpm run test:integration

echo ""
echo "▶ [9/11] test:api"
pnpm run test:api

echo ""
echo "▶ [10/11] format:check"
pnpm run format:check

echo ""
echo "▶ [11/11] lint:eslint"
pnpm run lint:eslint

echo ""
echo "✓ All CI checks passed."
