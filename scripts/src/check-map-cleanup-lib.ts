/**
 * Pure detection logic for the map popup cleanup convention.
 * Exported so it can be unit-tested independently of filesystem I/O.
 *
 * --- Staff App (React Native / WebView) convention ---
 * Convention (documented in replit.md):
 *   Any screen that directly imports WebView from react-native-webview must
 *   implement a two-layer popup-close contract:
 *
 *   Layer 1 – useFocusEffect blur callback:
 *     useFocusEffect whose return function performs popup-close logic.
 *     Covers screen blur / tab switch / navigation away.
 *
 *   Layer 2 – useEffect unmount cleanup:
 *     useEffect whose return function performs popup-close logic.
 *     Covers full component unmount independently.
 *
 *   "popup-close logic" means a call to `closeMapPopup` or posting a message
 *   with type `"closePopup"` / `'closePopup'` to the WebView / iframe.
 *
 * Screens that use MiniMapPreview are exempt — they inherit both layers
 * automatically and never have a direct WebView import.
 *
 * --- Platform Admin (React / Leaflet) convention ---
 *   Any component that directly imports L from "leaflet" must implement:
 *
 *   Layer 1 – useEffect unmount cleanup:
 *     useEffect whose return function calls `.remove()` on the Leaflet map
 *     instance.  In React Router web apps, components fully unmount on
 *     navigation, so a single useEffect cleanup is sufficient — there is no
 *     "blur without unmount" equivalent to React Navigation's useFocusEffect.
 */

/** Matches a direct WebView import from react-native-webview. */
export const WEBVIEW_IMPORT_RE =
  /import\s+(?:WebView|\{[^}]*\bWebView\b[^}]*\})\s+from\s+["']react-native-webview["']/;

/**
 * Extract the full argument list (including the outer parens) of a hook call
 * starting at `matchIndex`, using balanced-parenthesis counting.
 *
 * This avoids a fixed character window that can "bleed" past the hook's own
 * closing paren and pick up code from subsequent hooks.
 *
 * The implementation is intentionally simple — it counts `(` and `)` without
 * attempting to parse strings or comments.  For well-formed TypeScript source
 * this is sufficient and far less brittle than a full parser.
 */
function extractCallBody(content: string, matchIndex: number): string {
  let i = matchIndex;
  // Advance to the first opening paren of the call
  while (i < content.length && content[i] !== "(") i++;
  if (i >= content.length) return "";

  let depth = 0;
  const start = i;

  for (let j = i; j < content.length; j++) {
    const ch = content[j];
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) {
        return content.slice(start, j + 1);
      }
    }
  }

  // Unterminated call — return what we have
  return content.slice(start);
}

/**
 * Within an extracted hook body, detect a `return () => { ... }` cleanup
 * block that contains popup-close logic.
 */
const RETURN_WITH_POPUP_CLOSE =
  /return\s*\(\s*\)\s*=>\s*\{[\s\S]{0,800}?(?:closeMapPopup|["']closePopup["'])/;

/**
 * Layer 1 check — the file must contain a `useFocusEffect` call whose own
 * body (bounded by balanced parentheses) has a `return () => { ... }` cleanup
 * that performs popup-close logic.
 *
 * Checking only within the balanced call body prevents false positives where
 * a later `useEffect` with popup-close logic is picked up instead.
 */
export function hasPopupCloseFocusEffect(content: string): boolean {
  const focusEffectRE = /(?<!\w)useFocusEffect\s*\(/g;

  let match: RegExpExecArray | null;
  while ((match = focusEffectRE.exec(content)) !== null) {
    const body = extractCallBody(content, match.index);
    if (RETURN_WITH_POPUP_CLOSE.test(body)) {
      return true;
    }
  }
  return false;
}

/**
 * Layer 2 check — the file must contain a `useEffect` call (distinct from
 * `useFocusEffect`) whose own body (bounded by balanced parentheses) has a
 * `return () => { ... }` cleanup that performs popup-close logic.
 *
 * Note: "useEffect" is NOT a substring of "useFocusEffect" so the regex
 * correctly matches only standalone `useEffect` calls.
 */
export function hasPopupCloseUseEffect(content: string): boolean {
  const useEffectRE = /(?<!\w)useEffect\s*\(/g;

  let match: RegExpExecArray | null;
  while ((match = useEffectRE.exec(content)) !== null) {
    const body = extractCallBody(content, match.index);
    if (RETURN_WITH_POPUP_CLOSE.test(body)) {
      return true;
    }
  }
  return false;
}

export interface CheckResult {
  hasWebViewImport: boolean;
  layer1Ok: boolean;
  layer2Ok: boolean;
  missing: string[];
}

/** Analyse a single Staff App file's content and return a structured result. */
export function checkFile(content: string): CheckResult {
  const hasWebViewImport = WEBVIEW_IMPORT_RE.test(content);

  if (!hasWebViewImport) {
    return {
      hasWebViewImport: false,
      layer1Ok: true,
      layer2Ok: true,
      missing: [],
    };
  }

  const layer1Ok = hasPopupCloseFocusEffect(content);
  const layer2Ok = hasPopupCloseUseEffect(content);
  const missing: string[] = [];

  if (!layer1Ok) {
    missing.push(
      "useFocusEffect blur cleanup — return a popup-close callback from useFocusEffect (layer 1)",
    );
  }
  if (!layer2Ok) {
    missing.push(
      "useEffect unmount cleanup — return a popup-close callback from useEffect (layer 2)",
    );
  }

  return { hasWebViewImport, layer1Ok, layer2Ok, missing };
}

// ---------------------------------------------------------------------------
// Platform Admin (web / Leaflet) detection
// ---------------------------------------------------------------------------

/**
 * Matches a direct Leaflet import used in Platform Admin web components.
 * Covers the canonical forms:
 *   import L from "leaflet"
 *   import * as L from "leaflet"
 */
export const LEAFLET_IMPORT_RE =
  /import\s+(?:L|\*\s+as\s+L)\s+from\s+["']leaflet["']/;

/**
 * Within an extracted useEffect body, detect a `return () => { ... }` cleanup
 * that calls `.remove()` — the Leaflet method that destroys the map instance
 * and frees all associated event listeners and DOM nodes.
 */
const RETURN_WITH_MAP_REMOVE =
  /return\s*\(\s*\)\s*=>\s*\{[\s\S]{0,400}?\.remove\s*\(\s*\)/;

/**
 * Web Layer check — the file must contain a `useEffect` call whose own body
 * (bounded by balanced parentheses) has a `return () => { ... }` cleanup that
 * calls `.remove()` on the Leaflet map instance.
 */
export function hasLeafletMapRemoveCleanup(content: string): boolean {
  const useEffectRE = /(?<!\w)useEffect\s*\(/g;

  let match: RegExpExecArray | null;
  while ((match = useEffectRE.exec(content)) !== null) {
    const body = extractCallBody(content, match.index);
    if (RETURN_WITH_MAP_REMOVE.test(body)) {
      return true;
    }
  }
  return false;
}

export interface WebCheckResult {
  hasLeafletImport: boolean;
  layer1Ok: boolean;
  missing: string[];
}

/**
 * Analyse a single Platform Admin web file's content for Leaflet map cleanup
 * compliance and return a structured result.
 *
 * In a React Router web app, navigating away fully unmounts the component, so
 * a single `useEffect` cleanup (calling `map.remove()`) is the only required
 * layer — there is no "blur without unmount" equivalent.
 */
export function checkWebFile(content: string): WebCheckResult {
  const hasLeafletImport = LEAFLET_IMPORT_RE.test(content);

  if (!hasLeafletImport) {
    return { hasLeafletImport: false, layer1Ok: true, missing: [] };
  }

  const layer1Ok = hasLeafletMapRemoveCleanup(content);
  const missing: string[] = [];

  if (!layer1Ok) {
    missing.push(
      "useEffect unmount cleanup — call map.remove() in a useEffect return callback to destroy the Leaflet instance on unmount (layer 1)",
    );
  }

  return { hasLeafletImport, layer1Ok, missing };
}
