/**
 * check-map-cleanup (CLI entry point)
 *
 * Scans every .tsx file under artifacts/staff-app/app/ that directly imports
 * WebView from react-native-webview and verifies it implements the two-layer
 * popup-close contract required by the Map WebView Popup Cleanup Convention
 * documented in replit.md:
 *
 *   Layer 1 – useFocusEffect blur callback:
 *     useFocusEffect whose return callback performs popup-close logic.
 *     Covers screen blur / tab switch / navigation away.
 *
 *   Layer 2 – useEffect unmount cleanup:
 *     useEffect whose return callback performs popup-close logic.
 *     Covers full component unmount independently.
 *
 * "popup-close logic" means calling `closeMapPopup()` or posting a message
 * with type `"closePopup"` / `'closePopup'` to the WebView/iframe.
 *
 * Screens that use MiniMapPreview are exempt — they inherit both layers
 * automatically and never have a direct WebView import.
 *
 * Exit 1 if any violations are found; exit 0 otherwise.
 *
 * Pure detection logic lives in check-map-cleanup-lib.ts (separately tested).
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";
import { checkFile } from "./check-map-cleanup-lib.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/src/ -> scripts/ -> workspace root
const WORKSPACE_ROOT = join(__dirname, "../..");
const STAFF_APP_SCREENS_DIR = join(WORKSPACE_ROOT, "artifacts/staff-app/app");

// Recursively collect .tsx files
function walkTsx(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkTsx(full));
    } else if (full.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

interface Violation {
  file: string;
  missing: string[];
}

function run(): void {
  const files = walkTsx(STAFF_APP_SCREENS_DIR);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const result = checkFile(content);

    if (!result.hasWebViewImport) continue;

    if (result.missing.length > 0) {
      violations.push({ file: relative(WORKSPACE_ROOT, file), missing: result.missing });
    }
  }

  if (violations.length === 0) {
    console.log("✓ Map popup cleanup check passed — all WebView screens comply.");
    process.exit(0);
  }

  console.error(
    `\n✗ Map popup cleanup check FAILED — ${violations.length} file(s) missing required cleanup layers.\n`,
  );
  console.error(
    "Each screen that embeds a Leaflet map WebView directly must implement the\n" +
      "two-layer popup-close contract documented in replit.md.\n",
  );

  for (const { file, missing } of violations) {
    console.error(`  ${file}`);
    for (const m of missing) {
      console.error(`    ✗ Missing: ${m}`);
    }
    console.error();
  }

  console.error(
    "Reference implementation: artifacts/staff-app/app/maintenance/map.tsx\n" +
      "See replit.md § Map WebView Popup Cleanup Convention for details.\n",
  );

  process.exit(1);
}

run();
