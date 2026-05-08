/**
 * Unit tests for check-map-cleanup-lib.ts
 *
 * Covers both code paths:
 *   - checkFile   (Staff App / WebView / two-layer convention)
 *   - checkWebFile (Platform Admin / Leaflet / single-layer convention)
 *
 * Run: pnpm --filter @workspace/scripts run test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkFile,
  checkWebFile,
  WEBVIEW_IMPORT_RE,
  LEAFLET_IMPORT_RE,
  hasPopupCloseFocusEffect,
  hasPopupCloseUseEffect,
  hasLeafletMapRemoveCleanup,
} from "./check-map-cleanup-lib.js";

// ---------------------------------------------------------------------------
// Helpers — minimal but realistic code snippets
// ---------------------------------------------------------------------------

const _WEBVIEW_IMPORT = `import WebView from "react-native-webview";`;
const LEAFLET_IMPORT = `import L from "leaflet";`;
const _LEAFLET_IMPORT_STAR = `import * as L from "leaflet";`;

/** A fully-compliant Staff App screen. */
function compliantWebViewScreen(popupClose = `closeMapPopup()`) {
  return `
import React, { useEffect, useCallback } from "react";
import WebView from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";

export default function MapScreen() {
  useFocusEffect(
    useCallback(() => {
      return () => {
        ${popupClose};
      };
    }, [])
  );

  useEffect(() => {
    return () => {
      ${popupClose};
    };
  }, []);

  return <WebView />;
}
`;
}

/** A fully-compliant Platform Admin Leaflet component. */
function compliantLeafletComponent(removeCall = `mapRef.current.remove()`) {
  return `
import React, { useEffect, useRef } from "react";
import L from "leaflet";

export default function FleetMap() {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const map = L.map("map-container");
    mapRef.current = map;
    return () => {
      ${removeCall};
    };
  }, []);

  return <div id="map-container" />;
}
`;
}

// ---------------------------------------------------------------------------
// WEBVIEW_IMPORT_RE
// ---------------------------------------------------------------------------

describe("WEBVIEW_IMPORT_RE", () => {
  it("matches default import: import WebView from 'react-native-webview'", () => {
    assert.ok(
      WEBVIEW_IMPORT_RE.test(`import WebView from 'react-native-webview';`),
    );
  });

  it("matches default import with double quotes", () => {
    assert.ok(
      WEBVIEW_IMPORT_RE.test(`import WebView from "react-native-webview";`),
    );
  });

  it("matches named import: import { WebView } from 'react-native-webview'", () => {
    assert.ok(
      WEBVIEW_IMPORT_RE.test(`import { WebView } from "react-native-webview";`),
    );
  });

  it("does not match MiniMapPreview import (no direct WebView)", () => {
    assert.ok(
      !WEBVIEW_IMPORT_RE.test(
        `import MiniMapPreview from "../components/MiniMapPreview";`,
      ),
    );
  });

  it("does not match partial substring 'WebViewFoo'", () => {
    assert.ok(
      !WEBVIEW_IMPORT_RE.test(`import WebViewFoo from "react-native-webview";`),
    );
  });

  it("does not match unrelated react-native import", () => {
    assert.ok(!WEBVIEW_IMPORT_RE.test(`import { View } from "react-native";`));
  });
});

// ---------------------------------------------------------------------------
// LEAFLET_IMPORT_RE
// ---------------------------------------------------------------------------

describe("LEAFLET_IMPORT_RE", () => {
  it("matches: import L from 'leaflet'", () => {
    assert.ok(LEAFLET_IMPORT_RE.test(`import L from "leaflet";`));
  });

  it("matches: import * as L from 'leaflet'", () => {
    assert.ok(LEAFLET_IMPORT_RE.test(`import * as L from "leaflet";`));
  });

  it("does not match react-leaflet import", () => {
    assert.ok(
      !LEAFLET_IMPORT_RE.test(`import { MapContainer } from "react-leaflet";`),
    );
  });

  it("does not match leaflet-geosearch import", () => {
    assert.ok(
      !LEAFLET_IMPORT_RE.test(`import GeoSearch from "leaflet-geosearch";`),
    );
  });
});

// ---------------------------------------------------------------------------
// hasPopupCloseFocusEffect (layer 1 — Staff App)
// ---------------------------------------------------------------------------

describe("hasPopupCloseFocusEffect", () => {
  it("returns true for useFocusEffect with closeMapPopup in return", () => {
    const code = `
useFocusEffect(useCallback(() => {
  return () => { closeMapPopup(); };
}, []));`;
    assert.ok(hasPopupCloseFocusEffect(code));
  });

  it("returns true for useFocusEffect with 'closePopup' message string (double quotes)", () => {
    const code = `
useFocusEffect(useCallback(() => {
  return () => { webViewRef.current?.postMessage(JSON.stringify({ type: "closePopup" })); };
}, []));`;
    assert.ok(hasPopupCloseFocusEffect(code));
  });

  it("returns true for useFocusEffect with 'closePopup' message string (single quotes)", () => {
    const code = `
useFocusEffect(useCallback(() => {
  return () => { webViewRef.current?.postMessage(JSON.stringify({ type: 'closePopup' })); };
}, []));`;
    assert.ok(hasPopupCloseFocusEffect(code));
  });

  it("returns false when useFocusEffect return has no popup-close logic", () => {
    const code = `
useFocusEffect(useCallback(() => {
  return () => { console.log("cleanup"); };
}, []));`;
    assert.ok(!hasPopupCloseFocusEffect(code));
  });

  it("returns false when there is no useFocusEffect at all", () => {
    assert.ok(
      !hasPopupCloseFocusEffect(
        `useEffect(() => { return () => { closeMapPopup(); }; }, []);`,
      ),
    );
  });

  it("does not confuse useEffect popup-close with useFocusEffect", () => {
    const code = `
useFocusEffect(useCallback(() => {
  return () => { console.log("focus cleanup"); };
}, []));

useEffect(() => {
  return () => { closeMapPopup(); };
}, []);`;
    assert.ok(!hasPopupCloseFocusEffect(code));
  });

  it("returns true for deeply nested useFocusEffect body", () => {
    const code = `
useFocusEffect(
  useCallback(() => {
    const fn = () => {
      if (true) {
        doSomething();
      }
    };
    fn();
    return () => {
      closeMapPopup();
    };
  }, [dep1, dep2])
);`;
    assert.ok(hasPopupCloseFocusEffect(code));
  });
});

// ---------------------------------------------------------------------------
// hasPopupCloseUseEffect (layer 2 — Staff App)
// ---------------------------------------------------------------------------

describe("hasPopupCloseUseEffect", () => {
  it("returns true for useEffect with closeMapPopup in return", () => {
    const code = `useEffect(() => { return () => { closeMapPopup(); }; }, []);`;
    assert.ok(hasPopupCloseUseEffect(code));
  });

  it("returns true for useEffect with closePopup string (double quotes)", () => {
    const code = `useEffect(() => {
  return () => { iframe.contentWindow?.postMessage({ type: "closePopup" }, "*"); };
}, []);`;
    assert.ok(hasPopupCloseUseEffect(code));
  });

  it("returns false when useEffect return has no popup-close logic", () => {
    const code = `useEffect(() => { return () => { cleanup(); }; }, []);`;
    assert.ok(!hasPopupCloseUseEffect(code));
  });

  it("returns false with no useEffect at all", () => {
    assert.ok(!hasPopupCloseUseEffect(`function foo() { return 1; }`));
  });

  it("handles multiple useEffect calls — passes when any one has popup-close", () => {
    const code = `
useEffect(() => {
  return () => { cleanup(); };
}, []);

useEffect(() => {
  return () => { closeMapPopup(); };
}, [dep]);`;
    assert.ok(hasPopupCloseUseEffect(code));
  });

  it("handles multiple useEffect calls — fails when none has popup-close", () => {
    const code = `
useEffect(() => { return () => { cleanupA(); }; }, []);
useEffect(() => { return () => { cleanupB(); }; }, [dep]);`;
    assert.ok(!hasPopupCloseUseEffect(code));
  });

  it("does not treat useFocusEffect as useEffect (no false positive)", () => {
    const code = `
useFocusEffect(useCallback(() => {
  return () => { closeMapPopup(); };
}, []));`;
    assert.ok(!hasPopupCloseUseEffect(code));
  });

  it("handles deeply nested useEffect return with popup-close", () => {
    const code = `
useEffect(() => {
  const timer = setTimeout(() => {
    initSomething();
  }, 100);
  return () => {
    clearTimeout(timer);
    closeMapPopup();
  };
}, []);`;
    assert.ok(hasPopupCloseUseEffect(code));
  });
});

// ---------------------------------------------------------------------------
// checkFile — Staff App two-layer compliance
// ---------------------------------------------------------------------------

describe("checkFile", () => {
  it("non-WebView file passes with no flags set", () => {
    const result = checkFile(
      `import React from "react"; export default function Foo() { return null; }`,
    );
    assert.equal(result.hasWebViewImport, false);
    assert.equal(result.layer1Ok, true);
    assert.equal(result.layer2Ok, true);
    assert.deepEqual(result.missing, []);
  });

  it("compliant screen with closeMapPopup passes both layers", () => {
    const result = checkFile(compliantWebViewScreen("closeMapPopup()"));
    assert.equal(result.hasWebViewImport, true);
    assert.equal(result.layer1Ok, true);
    assert.equal(result.layer2Ok, true);
    assert.deepEqual(result.missing, []);
  });

  it("compliant screen with closePopup message passes both layers", () => {
    const code = `
import WebView from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
export default function S() {
  useFocusEffect(useCallback(() => {
    return () => { ref.current?.postMessage(JSON.stringify({ type: "closePopup" })); };
  }, []));
  useEffect(() => {
    return () => { ref.current?.postMessage(JSON.stringify({ type: "closePopup" })); };
  }, []);
  return <WebView ref={ref} />;
}`;
    const result = checkFile(code);
    assert.equal(result.layer1Ok, true);
    assert.equal(result.layer2Ok, true);
    assert.equal(result.missing.length, 0);
  });

  it("missing layer 1 only — reports useFocusEffect missing", () => {
    const code = `
import WebView from "react-native-webview";
import { useEffect } from "react";
export default function S() {
  useEffect(() => {
    return () => { closeMapPopup(); };
  }, []);
  return <WebView />;
}`;
    const result = checkFile(code);
    assert.equal(result.hasWebViewImport, true);
    assert.equal(result.layer1Ok, false);
    assert.equal(result.layer2Ok, true);
    assert.equal(result.missing.length, 1);
    assert.ok(result.missing[0].includes("useFocusEffect"));
  });

  it("missing layer 2 only — reports useEffect missing", () => {
    const code = `
import WebView from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
export default function S() {
  useFocusEffect(useCallback(() => {
    return () => { closeMapPopup(); };
  }, []));
  return <WebView />;
}`;
    const result = checkFile(code);
    assert.equal(result.hasWebViewImport, true);
    assert.equal(result.layer1Ok, true);
    assert.equal(result.layer2Ok, false);
    assert.equal(result.missing.length, 1);
    assert.ok(result.missing[0].includes("useEffect"));
  });

  it("missing both layers — reports two items", () => {
    const code = `
import WebView from "react-native-webview";
export default function S() {
  return <WebView />;
}`;
    const result = checkFile(code);
    assert.equal(result.hasWebViewImport, true);
    assert.equal(result.layer1Ok, false);
    assert.equal(result.layer2Ok, false);
    assert.equal(result.missing.length, 2);
  });

  it("useEffect with unrelated cleanup does not satisfy layer 2", () => {
    const code = `
import WebView from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
export default function S() {
  useFocusEffect(useCallback(() => {
    return () => { closeMapPopup(); };
  }, []));
  useEffect(() => {
    return () => { clearTimeout(t); };
  }, []);
  return <WebView />;
}`;
    const result = checkFile(code);
    assert.equal(result.layer1Ok, true);
    assert.equal(result.layer2Ok, false);
  });

  it("MiniMapPreview import (no direct WebView) is treated as non-WebView file", () => {
    const code = `
import MiniMapPreview from "../components/MiniMapPreview";
export default function S() { return <MiniMapPreview />; }`;
    const result = checkFile(code);
    assert.equal(result.hasWebViewImport, false);
    assert.deepEqual(result.missing, []);
  });
});

// ---------------------------------------------------------------------------
// hasLeafletMapRemoveCleanup — Platform Admin
// ---------------------------------------------------------------------------

describe("hasLeafletMapRemoveCleanup", () => {
  it("returns true for useEffect with map.remove() in return", () => {
    const code = `
useEffect(() => {
  const map = L.map("container");
  return () => { map.remove(); };
}, []);`;
    assert.ok(hasLeafletMapRemoveCleanup(code));
  });

  it("returns true for useEffect with chained ref.remove() in return", () => {
    const code = `
useEffect(() => {
  return () => { mapRef.current.remove(); };
}, []);`;
    assert.ok(hasLeafletMapRemoveCleanup(code));
  });

  it("returns false when useEffect return does not call .remove()", () => {
    const code = `
useEffect(() => {
  return () => { cleanup(); };
}, []);`;
    assert.ok(!hasLeafletMapRemoveCleanup(code));
  });

  it("returns false with no useEffect at all", () => {
    assert.ok(!hasLeafletMapRemoveCleanup(LEAFLET_IMPORT));
  });

  it("handles multiple useEffect calls — passes when any one has .remove()", () => {
    const code = `
useEffect(() => {
  return () => { cleanup(); };
}, []);

useEffect(() => {
  const map = L.map("c");
  return () => { map.remove(); };
}, []);`;
    assert.ok(hasLeafletMapRemoveCleanup(code));
  });

  it("handles multiple useEffect calls — fails when none has .remove()", () => {
    const code = `
useEffect(() => { return () => { cleanA(); }; }, []);
useEffect(() => { return () => { cleanB(); }; }, [dep]);`;
    assert.ok(!hasLeafletMapRemoveCleanup(code));
  });

  it("handles deeply nested body before remove() call", () => {
    const code = `
useEffect(() => {
  const map = L.map("container");
  map.setView([0, 0], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  const marker = L.marker([0, 0]).addTo(map);
  return () => {
    marker.remove();
    map.remove();
  };
}, []);`;
    assert.ok(hasLeafletMapRemoveCleanup(code));
  });
});

// ---------------------------------------------------------------------------
// checkWebFile — Platform Admin single-layer compliance
// ---------------------------------------------------------------------------

describe("checkWebFile", () => {
  it("non-Leaflet file passes with no flags set", () => {
    const result = checkWebFile(
      `import React from "react"; export default function Foo() { return null; }`,
    );
    assert.equal(result.hasLeafletImport, false);
    assert.equal(result.layer1Ok, true);
    assert.deepEqual(result.missing, []);
  });

  it("compliant component with import L from 'leaflet' passes", () => {
    const result = checkWebFile(
      compliantLeafletComponent("mapRef.current.remove()"),
    );
    assert.equal(result.hasLeafletImport, true);
    assert.equal(result.layer1Ok, true);
    assert.deepEqual(result.missing, []);
  });

  it("compliant component with import * as L from 'leaflet' passes", () => {
    const code = compliantLeafletComponent("mapRef.current.remove()").replace(
      `import L from "leaflet";`,
      `import * as L from "leaflet";`,
    );
    const result = checkWebFile(code);
    assert.equal(result.hasLeafletImport, true);
    assert.equal(result.layer1Ok, true);
    assert.deepEqual(result.missing, []);
  });

  it("missing map.remove() — reports layer 1 missing", () => {
    const code = `
import L from "leaflet";
import { useEffect } from "react";
export default function FleetMap() {
  useEffect(() => {
    const map = L.map("c");
    return () => { /* forgot remove */ };
  }, []);
  return <div id="c" />;
}`;
    const result = checkWebFile(code);
    assert.equal(result.hasLeafletImport, true);
    assert.equal(result.layer1Ok, false);
    assert.equal(result.missing.length, 1);
    assert.ok(result.missing[0].includes("map.remove()"));
  });

  it("Leaflet import but no useEffect at all — reports layer 1 missing", () => {
    const code = `
import L from "leaflet";
export default function FleetMap() {
  const map = L.map("c");
  return <div id="c" />;
}`;
    const result = checkWebFile(code);
    assert.equal(result.hasLeafletImport, true);
    assert.equal(result.layer1Ok, false);
    assert.equal(result.missing.length, 1);
  });

  it("react-leaflet import does not trigger Leaflet checks", () => {
    const code = `
import { MapContainer, TileLayer } from "react-leaflet";
export default function FleetMap() { return <MapContainer />; }`;
    const result = checkWebFile(code);
    assert.equal(result.hasLeafletImport, false);
    assert.equal(result.layer1Ok, true);
    assert.deepEqual(result.missing, []);
  });
});

// ---------------------------------------------------------------------------
// Edge cases — aliases and unusual spacing
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("useFocusEffect detected even with extra whitespace before paren", () => {
    const code = `
import WebView from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
export default function S() {
  useFocusEffect  (useCallback(() => {
    return () => { closeMapPopup(); };
  }, []));
  useEffect(() => {
    return () => { closeMapPopup(); };
  }, []);
  return <WebView />;
}`;
    const result = checkFile(code);
    assert.equal(result.layer1Ok, true);
  });

  it("useEffect detected even with extra whitespace before paren", () => {
    const code = `
import WebView from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
export default function S() {
  useFocusEffect(useCallback(() => {
    return () => { closeMapPopup(); };
  }, []));
  useEffect  (() => {
    return () => { closeMapPopup(); };
  }, []);
  return <WebView />;
}`;
    const result = checkFile(code);
    assert.equal(result.layer2Ok, true);
  });

  it("balanced-paren extractor handles nested parens in hook body", () => {
    const code = `
import WebView from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
export default function S() {
  useFocusEffect(useCallback(() => {
    const fn = nested(arg1(arg2), arg3);
    return () => { closeMapPopup(fn, extra()); };
  }, [a, b, c]));
  useEffect(() => {
    return () => { closeMapPopup(); };
  }, []);
  return <WebView />;
}`;
    const result = checkFile(code);
    assert.equal(result.layer1Ok, true);
    assert.equal(result.layer2Ok, true);
  });

  it("second useEffect's popup-close does not bleed into first useEffect body check", () => {
    // First useEffect has no popup-close; second does.
    // hasPopupCloseUseEffect should still return true (any one is sufficient).
    // But the per-body extraction should not let the second body's content
    // satisfy the first body's check.
    const code = `
useEffect(() => {
  return () => { unrelatedCleanup(); };
}, []);

useEffect(() => {
  return () => { closeMapPopup(); };
}, []);`;
    // The function only needs ONE useEffect to have it, so true is correct here.
    assert.ok(hasPopupCloseUseEffect(code));
  });

  it("checkFile: two useEffects — popup-close only in second still satisfies layer 2", () => {
    const code = `
import WebView from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
export default function S() {
  useFocusEffect(useCallback(() => {
    return () => { closeMapPopup(); };
  }, []));
  useEffect(() => {
    return () => { unrelatedCleanup(); };
  }, []);
  useEffect(() => {
    return () => { closeMapPopup(); };
  }, [dep]);
  return <WebView />;
}`;
    const result = checkFile(code);
    assert.equal(result.layer1Ok, true);
    assert.equal(result.layer2Ok, true);
  });

  it("WebView import aliased to RNWebView is NOT detected — convention requires 'WebView' identifier", () => {
    // The convention explicitly requires importing as WebView (not an alias)
    // so that the static regex check works. Aliased imports are not detected.
    const code = `import RNWebView from "react-native-webview";`;
    assert.ok(!WEBVIEW_IMPORT_RE.test(code));
  });

  it("Leaflet import aliased to 'Leaflet' (not 'L') is NOT detected — convention requires 'L' identifier", () => {
    // The convention requires importing as L or * as L.
    // Any other alias is out-of-convention and not detected.
    const code = `import Leaflet from "leaflet";`;
    assert.ok(!LEAFLET_IMPORT_RE.test(code));
  });

  it("checkFile: aliased WebView import is treated as non-WebView file (exempt from check)", () => {
    // A file that imports react-native-webview under a different name won't be
    // flagged. The convention document requires using 'WebView' as the identifier.
    const code = `
import RNWebView from "react-native-webview";
export default function S() { return <RNWebView />; }`;
    const result = checkFile(code);
    assert.equal(result.hasWebViewImport, false);
    assert.deepEqual(result.missing, []);
  });

  it("checkWebFile: aliased Leaflet import ('Leaflet') is treated as non-Leaflet file (exempt from check)", () => {
    // A file that imports leaflet under a different alias won't be flagged.
    // The convention requires 'L' or '* as L'.
    const code = `
import Leaflet from "leaflet";
export default function FleetMap() {
  const map = Leaflet.map("c");
  return <div id="c" />;
}`;
    const result = checkWebFile(code);
    assert.equal(result.hasLeafletImport, false);
    assert.deepEqual(result.missing, []);
  });
});
