/**
 * Fixture-based tests for the map popup cleanup checker.
 * Uses Node.js built-in test runner (node:test) — no extra dependencies needed.
 *
 * Run: pnpm --filter @workspace/scripts run test-map-cleanup
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkFile,
  hasPopupCloseFocusEffect,
  hasPopupCloseUseEffect,
  WEBVIEW_IMPORT_RE,
} from "./check-map-cleanup-lib.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WEBVIEW_IMPORT = `import WebView from "react-native-webview";`;

/** Both layers present — should pass. */
const COMPLIANT_SCREEN = `
import React, { useCallback, useEffect } from "react";
import WebView from "react-native-webview";
import { useFocusEffect } from "expo-router";

const webViewRef = { current: null };
const closeMapPopup = () => {
  webViewRef.current?.injectJavaScript("window.closeMapPopup && window.closeMapPopup(); true;");
};

export default function GoodMapScreen() {
  useFocusEffect(
    useCallback(() => {
      return () => {
        closeMapPopup();
      };
    }, []),
  );

  useEffect(() => {
    return () => {
      closeMapPopup();
    };
  }, []);

  return <WebView source={{ html: "" }} />;
}
`;

/** useFocusEffect is present but its return does NOT close a popup (no-op). */
const MISSING_LAYER1_NOOP_FOCUS_EFFECT = `
import React, { useCallback, useEffect } from "react";
import WebView from "react-native-webview";
import { useFocusEffect } from "expo-router";

const webViewRef = { current: null };
const closeMapPopup = () => {
  webViewRef.current?.injectJavaScript("window.closeMapPopup && window.closeMapPopup(); true;");
};

export default function BadLayer1Screen() {
  useFocusEffect(
    useCallback(() => {
      return () => {
        console.log("focus lost — but no popup close");
      };
    }, []),
  );

  useEffect(() => {
    return () => {
      closeMapPopup();
    };
  }, []);

  return <WebView source={{ html: "" }} />;
}
`;

/** useFocusEffect is present but no return at all in its callback. */
const MISSING_LAYER1_NO_RETURN = `
import React, { useCallback, useEffect } from "react";
import WebView from "react-native-webview";
import { useFocusEffect } from "expo-router";

const webViewRef = { current: null };
const closeMapPopup = () => {
  webViewRef.current?.injectJavaScript("window.closeMapPopup && window.closeMapPopup(); true;");
};

export default function BadLayer1Screen() {
  useFocusEffect(useCallback(() => { /* no return cleanup at all */ }, []));

  useEffect(() => {
    return () => {
      closeMapPopup();
    };
  }, []);

  return <WebView source={{ html: "" }} />;
}
`;

/** useEffect present but its return does NOT close a popup. */
const MISSING_LAYER2_NOOP_EFFECT = `
import React, { useCallback, useEffect } from "react";
import WebView from "react-native-webview";
import { useFocusEffect } from "expo-router";

const webViewRef = { current: null };
const closeMapPopup = () => {
  webViewRef.current?.injectJavaScript("window.closeMapPopup && window.closeMapPopup(); true;");
};

export default function BadLayer2Screen() {
  useFocusEffect(
    useCallback(() => {
      return () => {
        closeMapPopup();
      };
    }, []),
  );

  useEffect(() => {
    return () => {
      console.log("unmounting — but no popup close");
    };
  }, []);

  return <WebView source={{ html: "" }} />;
}
`;

/** No WebView import — the checker must skip this file entirely. */
const NON_MAP_SCREEN = `
import React, { useEffect } from "react";

export default function SettingsScreen() {
  useEffect(() => {}, []);
  return null;
}
`;

/** closeMapPopup lives only in a postMessage variant (type:"closePopup"). */
const COMPLIANT_SCREEN_POSTMESSAGE = `
import React, { useCallback, useEffect, useRef } from "react";
import WebView from "react-native-webview";
import { useFocusEffect } from "expo-router";

export default function PostMsgMapScreen() {
  const iframeRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "closePopup" }), "*");
      };
    }, []),
  );

  useEffect(() => {
    return () => {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "closePopup" }), "*");
    };
  }, []);

  return <WebView source={{ html: "" }} />;
}
`;

/**
 * Aliased import — the checker only detects `import WebView from "react-native-webview"`.
 * An aliased default import like `import RNWebView from "react-native-webview"` is
 * intentionally NOT matched, making the boundary explicit.  The convention in replit.md
 * therefore requires keeping `WebView` as the import identifier.
 */
const ALIASED_WEBVIEW_IMPORT = `
import React, { useCallback, useEffect } from "react";
import RNWebView from "react-native-webview";
import { useFocusEffect } from "expo-router";

const closeMapPopup = () => {};

export default function AliasedMapScreen() {
  useFocusEffect(useCallback(() => { return () => { closeMapPopup(); }; }, []));
  useEffect(() => { return () => { closeMapPopup(); }; }, []);
  return <RNWebView source={{ html: "" }} />;
}
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("WEBVIEW_IMPORT_RE matches default import", () => {
  assert.ok(WEBVIEW_IMPORT_RE.test(`import WebView from "react-native-webview";`));
  assert.ok(WEBVIEW_IMPORT_RE.test(`import WebView from 'react-native-webview';`));
});

test("WEBVIEW_IMPORT_RE does NOT match aliased import (checker boundary is explicit)", () => {
  // By design the checker only recognises the canonical `WebView` identifier.
  // The convention in replit.md requires keeping `WebView` as the name so screens
  // remain visible to the check.  This test documents that limitation.
  assert.ok(!WEBVIEW_IMPORT_RE.test(`import RNWebView from "react-native-webview";`));
  const result = checkFile(ALIASED_WEBVIEW_IMPORT);
  assert.equal(result.hasWebViewImport, false, "aliased import is outside checker scope");
});

test("WEBVIEW_IMPORT_RE does not match unrelated imports", () => {
  assert.ok(!WEBVIEW_IMPORT_RE.test(`import { View } from "react-native";`));
  assert.ok(!WEBVIEW_IMPORT_RE.test(`import MiniMapPreview from "@/components/MiniMapPreview";`));
});

test("hasPopupCloseFocusEffect: detects closeMapPopup in useFocusEffect return", () => {
  assert.ok(hasPopupCloseFocusEffect(COMPLIANT_SCREEN));
});

test("hasPopupCloseFocusEffect: detects postMessage closePopup in useFocusEffect return", () => {
  assert.ok(hasPopupCloseFocusEffect(COMPLIANT_SCREEN_POSTMESSAGE));
});

test("hasPopupCloseFocusEffect: rejects no-op useFocusEffect return", () => {
  assert.ok(!hasPopupCloseFocusEffect(MISSING_LAYER1_NOOP_FOCUS_EFFECT));
});

test("hasPopupCloseFocusEffect: rejects useFocusEffect with no return cleanup", () => {
  assert.ok(!hasPopupCloseFocusEffect(MISSING_LAYER1_NO_RETURN));
});

test("hasPopupCloseUseEffect: detects closeMapPopup in useEffect return", () => {
  assert.ok(hasPopupCloseUseEffect(COMPLIANT_SCREEN));
});

test("hasPopupCloseUseEffect: detects postMessage closePopup in useEffect return", () => {
  assert.ok(hasPopupCloseUseEffect(COMPLIANT_SCREEN_POSTMESSAGE));
});

test("hasPopupCloseUseEffect: rejects no-op useEffect return", () => {
  assert.ok(!hasPopupCloseUseEffect(MISSING_LAYER2_NOOP_EFFECT));
});

test("checkFile: compliant screen — both layers pass, no missing entries", () => {
  const result = checkFile(COMPLIANT_SCREEN);
  assert.equal(result.hasWebViewImport, true);
  assert.equal(result.layer1Ok, true);
  assert.equal(result.layer2Ok, true);
  assert.deepEqual(result.missing, []);
});

test("checkFile: compliant postMessage screen — both layers pass", () => {
  const result = checkFile(COMPLIANT_SCREEN_POSTMESSAGE);
  assert.equal(result.layer1Ok, true);
  assert.equal(result.layer2Ok, true);
  assert.deepEqual(result.missing, []);
});

test("checkFile: non-map screen is skipped — hasWebViewImport false, no violations", () => {
  const result = checkFile(NON_MAP_SCREEN);
  assert.equal(result.hasWebViewImport, false);
  assert.deepEqual(result.missing, []);
});

test("checkFile: screen missing layer 1 (no-op focus effect) — reports layer 1 missing", () => {
  const result = checkFile(MISSING_LAYER1_NOOP_FOCUS_EFFECT);
  assert.equal(result.hasWebViewImport, true);
  assert.equal(result.layer1Ok, false);
  assert.equal(result.layer2Ok, true);
  assert.equal(result.missing.length, 1);
  assert.ok(result.missing[0].includes("layer 1"));
});

test("checkFile: screen missing layer 1 (no return in useFocusEffect) — reports layer 1 missing", () => {
  const result = checkFile(MISSING_LAYER1_NO_RETURN);
  assert.equal(result.layer1Ok, false);
  assert.equal(result.layer2Ok, true);
});

test("checkFile: screen missing layer 2 (no-op useEffect) — reports layer 2 missing", () => {
  const result = checkFile(MISSING_LAYER2_NOOP_EFFECT);
  assert.equal(result.hasWebViewImport, true);
  assert.equal(result.layer1Ok, true);
  assert.equal(result.layer2Ok, false);
  assert.equal(result.missing.length, 1);
  assert.ok(result.missing[0].includes("layer 2"));
});
