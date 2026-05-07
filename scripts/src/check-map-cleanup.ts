/**
 * check-map-cleanup (CLI entry point)
 *
 * Scans two surface areas for map cleanup compliance:
 *
 * ── Staff App (artifacts/staff-app/app/) ──────────────────────────────────
 * Any .tsx file that directly imports WebView from react-native-webview must
 * implement the two-layer popup-close contract (replit.md §Map WebView Popup
 * Cleanup Convention):
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
 * ── Platform Admin (artifacts/platform-admin/src/) ────────────────────────
 * Any .tsx file that directly imports L from "leaflet" must implement:
 *
 *   Layer 1 – useEffect unmount cleanup:
 *     useEffect whose return callback calls map.remove(), destroying the
 *     Leaflet instance and freeing all listeners / DOM nodes.
 *
 * In React Router web apps, navigating away fully unmounts the component, so
 * a single useEffect cleanup is sufficient — there is no "blur without
 * unmount" equivalent to React Navigation's useFocusEffect.
 *
 * Exit 1 if any violations are found; exit 0 otherwise.
 *
 * Pure detection logic lives in check-map-cleanup-lib.ts (separately tested).
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";
import { checkFile, checkWebFile } from "./check-map-cleanup-lib.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/src/ -> scripts/ -> workspace root
const WORKSPACE_ROOT = join(__dirname, "../..");
const STAFF_APP_SCREENS_DIR = join(WORKSPACE_ROOT, "artifacts/staff-app/app");
const PLATFORM_ADMIN_SRC_DIR = join(
  WORKSPACE_ROOT,
  "artifacts/platform-admin/src",
);

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
  const violations: Violation[] = [];

  // ── Staff App scan (WebView / two-layer contract) ────────────────────────
  const staffFiles = walkTsx(STAFF_APP_SCREENS_DIR);
  for (const file of staffFiles) {
    const content = readFileSync(file, "utf8");
    const result = checkFile(content);
    if (!result.hasWebViewImport) continue;
    if (result.missing.length > 0) {
      violations.push({
        file: relative(WORKSPACE_ROOT, file),
        missing: result.missing,
      });
    }
  }

  // ── Platform Admin scan (Leaflet / useEffect unmount contract) ───────────
  const adminFiles = walkTsx(PLATFORM_ADMIN_SRC_DIR);
  for (const file of adminFiles) {
    const content = readFileSync(file, "utf8");
    const result = checkWebFile(content);
    if (!result.hasLeafletImport) continue;
    if (result.missing.length > 0) {
      violations.push({
        file: relative(WORKSPACE_ROOT, file),
        missing: result.missing,
      });
    }
  }

  if (violations.length === 0) {
    console.log(
      "✓ Map popup cleanup check passed — all WebView/Leaflet screens comply.",
    );
    process.exit(0);
  }

  console.error(
    `\n✗ Map popup cleanup check FAILED — ${violations.length} file(s) missing required cleanup layers.\n`,
  );
  console.error(
    "Staff App screens (react-native-webview) must implement the two-layer\n" +
      "popup-close contract. Platform Admin screens (leaflet) must call\n" +
      "map.remove() in a useEffect cleanup. See replit.md for details.\n",
  );

  for (const { file, missing } of violations) {
    console.error(`  ${file}`);
    for (const m of missing) {
      console.error(`    ✗ Missing: ${m}`);
    }
    console.error();
  }

  console.error(
    "Staff App reference: artifacts/staff-app/app/maintenance/map.tsx\n" +
      "Platform Admin reference: artifacts/platform-admin/src/pages/fleet-map.tsx\n" +
      "See replit.md § Map WebView Popup Cleanup Convention for details.\n",
  );

  process.exit(1);
}

run();
