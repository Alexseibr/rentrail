/**
 * Unit tests for parseYamlStringMap in ci-xml-files.ts.
 *
 * Covers:
 *   - Bare key / bare value (semver version strings, special pnpm tokens)
 *   - Double-quoted key / bare value  (scoped npm packages)
 *   - Single-quoted key / bare value
 *   - Bare key / double-quoted value
 *   - Bare key / single-quoted value
 *   - Inline comments stripped from bare values
 *   - Inline comments NOT stripped when value is quoted
 *   - Multiple entries returned together
 *   - Stops at the next top-level (non-indented) YAML key
 *   - Skips blank and comment-only lines inside the mapping
 *   - Handles the real catalog: section of pnpm-workspace.yaml correctly
 *   - Handles the real overrides: section (including "-" suppression tokens)
 *   - Returns an empty object for an unknown key
 *   - Last-write wins for duplicate keys (both entries present, last takes effect)
 *
 * Run: pnpm --filter @workspace/scripts run test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlStringMap } from "./ci-xml-files.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = join(__dirname, "../..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function yaml(...lines: string[]): string {
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Bare key and bare value
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — bare key, bare value", () => {
  it("parses a single bare key/value pair", () => {
    const src = yaml("catalog:", "  react: 19.1.0");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), { react: "19.1.0" });
  });

  it("parses a semver range as a bare value", () => {
    const src = yaml("catalog:", "  zod: ^3.25.0");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), { zod: "^3.25.0" });
  });

  it("parses the pnpm suppress-optional-dep token '-' as a bare value", () => {
    const src = yaml("overrides:", "  esbuild>@esbuild/aix-ppc64: -");
    assert.deepEqual(parseYamlStringMap(src, "overrides"), {
      "esbuild>@esbuild/aix-ppc64": "-",
    });
  });

  it("parses the literal '-' token used to suppress optional deps", () => {
    const src = yaml("overrides:", '  "esbuild>@esbuild/aix-ppc64": "-"');
    assert.deepEqual(parseYamlStringMap(src, "overrides"), {
      "esbuild>@esbuild/aix-ppc64": "-",
    });
  });

  it("parses multiple bare key/value entries", () => {
    const src = yaml(
      "catalog:",
      "  react: 19.1.0",
      "  zod: ^3.25.0",
      "  clsx: ^2.1.1",
    );
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      react: "19.1.0",
      zod: "^3.25.0",
      clsx: "^2.1.1",
    });
  });
});

// ---------------------------------------------------------------------------
// Double-quoted key
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — double-quoted key", () => {
  it("strips double quotes from a scoped package key", () => {
    const src = yaml("catalog:", '  "@types/node": ^25.3.3');
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      "@types/node": "^25.3.3",
    });
  });

  it("handles a double-quoted key that contains a backslash-escaped double quote", () => {
    const src = yaml("catalog:", '  "key\\"with\\"quotes": 1.0.0');
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      'key"with"quotes': "1.0.0",
    });
  });

  it("handles double-quoted key with a colon inside (e.g. override dep path)", () => {
    const src = yaml(
      "overrides:",
      '  "@esbuild-kit/esm-loader": npm:tsx@^4.21.0',
    );
    assert.deepEqual(parseYamlStringMap(src, "overrides"), {
      "@esbuild-kit/esm-loader": "npm:tsx@^4.21.0",
    });
  });

  it("handles double-quoted key with child dep path separator >", () => {
    const src = yaml("overrides:", '  "esbuild>@esbuild/linux-arm64": "-"');
    assert.deepEqual(parseYamlStringMap(src, "overrides"), {
      "esbuild>@esbuild/linux-arm64": "-",
    });
  });
});

// ---------------------------------------------------------------------------
// Single-quoted key
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — single-quoted key", () => {
  it("strips single quotes from a scoped package key", () => {
    const src = yaml("catalog:", "  '@types/react': ^19.2.0");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      "@types/react": "^19.2.0",
    });
  });

  it("decodes an escaped single quote ('') inside a single-quoted key", () => {
    const src = yaml("catalog:", "  'it''s-pkg': 1.0.0");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      "it's-pkg": "1.0.0",
    });
  });
});

// ---------------------------------------------------------------------------
// Quoted values
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — quoted value", () => {
  it("strips double quotes from a value", () => {
    const src = yaml("catalog:", '  react: "19.1.0"');
    assert.deepEqual(parseYamlStringMap(src, "catalog"), { react: "19.1.0" });
  });

  it("strips single quotes from a value", () => {
    const src = yaml("catalog:", "  react: '19.1.0'");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), { react: "19.1.0" });
  });

  it("preserves an inline comment that appears inside a double-quoted value", () => {
    const src = yaml("catalog:", '  react: "19.1.0 # not a comment"');
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      react: "19.1.0 # not a comment",
    });
  });

  it("preserves an inline comment that appears inside a single-quoted value", () => {
    const src = yaml("catalog:", "  react: '19.1.0 # not a comment'");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      react: "19.1.0 # not a comment",
    });
  });
});

// ---------------------------------------------------------------------------
// Inline comments on bare values
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — inline comments on bare values", () => {
  it("strips a trailing inline comment from a bare value", () => {
    const src = yaml("catalog:", "  react: 19.1.0 # pinned LTS");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), { react: "19.1.0" });
  });

  it("strips a trailing inline comment separated by multiple spaces", () => {
    const src = yaml("catalog:", "  zod: ^3.25.0   # use latest patch");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), { zod: "^3.25.0" });
  });

  it("does not treat a hash that is part of the value as a comment (no leading space)", () => {
    const src = yaml("catalog:", "  npm-alias: npm:pkg@#hash");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      "npm-alias": "npm:pkg@#hash",
    });
  });
});

// ---------------------------------------------------------------------------
// Blank and comment-only lines inside the mapping
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — blank and comment-only lines", () => {
  it("skips blank lines between entries", () => {
    const src = yaml("catalog:", "  react: 19.1.0", "", "  zod: ^3.25.0");
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      react: "19.1.0",
      zod: "^3.25.0",
    });
  });

  it("skips comment-only lines between entries", () => {
    const src = yaml(
      "catalog:",
      "  react: 19.1.0",
      "  # a comment",
      "  zod: ^3.25.0",
    );
    assert.deepEqual(parseYamlStringMap(src, "catalog"), {
      react: "19.1.0",
      zod: "^3.25.0",
    });
  });
});

// ---------------------------------------------------------------------------
// Section boundary detection
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — stops at the next top-level key", () => {
  it("does not include entries from the next top-level section", () => {
    const src = yaml(
      "catalog:",
      "  react: 19.1.0",
      "",
      "overrides:",
      "  esbuild: 0.27.3",
    );
    const catalog = parseYamlStringMap(src, "catalog");
    assert.deepEqual(catalog, { react: "19.1.0" });
    assert.ok(
      !("esbuild" in catalog),
      "entries from overrides: must not leak into catalog:",
    );
  });

  it("reads the second section correctly when the first section has ended", () => {
    const src = yaml(
      "catalog:",
      "  react: 19.1.0",
      "",
      "overrides:",
      "  esbuild: 0.27.3",
    );
    assert.deepEqual(parseYamlStringMap(src, "overrides"), {
      esbuild: "0.27.3",
    });
  });

  it("returns an empty object for an unknown section key", () => {
    const src = yaml("catalog:", "  react: 19.1.0");
    assert.deepEqual(parseYamlStringMap(src, "nonexistent"), {});
  });
});

// ---------------------------------------------------------------------------
// Real pnpm-workspace.yaml — catalog: section
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — real pnpm-workspace.yaml catalog:", () => {
  const workspaceYaml = readFileSync(
    join(WORKSPACE_ROOT, "pnpm-workspace.yaml"),
    "utf8",
  );

  it("returns a non-empty object for the catalog: section", () => {
    const catalog = parseYamlStringMap(workspaceYaml, "catalog");
    assert.ok(
      Object.keys(catalog).length > 0,
      "catalog: section must have at least one entry",
    );
  });

  it("parses react version correctly from catalog:", () => {
    const catalog = parseYamlStringMap(workspaceYaml, "catalog");
    assert.ok("react" in catalog, 'Expected "react" to be present in catalog:');
    assert.match(
      catalog["react"]!,
      /^\d/,
      `react version should start with a digit, got: ${catalog["react"]}`,
    );
  });

  it("parses scoped package names with double quotes correctly", () => {
    const catalog = parseYamlStringMap(workspaceYaml, "catalog");
    const scopedKeys = Object.keys(catalog).filter((k) => k.startsWith("@"));
    assert.ok(
      scopedKeys.length > 0,
      "Expected at least one scoped @-package in catalog:",
    );
    for (const k of scopedKeys) {
      assert.ok(k.startsWith("@"), `Scoped key must start with @, got: ${k}`);
      assert.ok(
        !k.startsWith('"') && !k.startsWith("'"),
        `Quotes must be stripped from key, got: ${k}`,
      );
    }
  });

  it("all catalog values are non-empty strings", () => {
    const catalog = parseYamlStringMap(workspaceYaml, "catalog");
    for (const [k, v] of Object.entries(catalog)) {
      assert.ok(
        v.length > 0,
        `Expected non-empty value for catalog key "${k}"`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Real pnpm-workspace.yaml — overrides: section
// ---------------------------------------------------------------------------

describe("parseYamlStringMap — real pnpm-workspace.yaml overrides:", () => {
  const workspaceYaml = readFileSync(
    join(WORKSPACE_ROOT, "pnpm-workspace.yaml"),
    "utf8",
  );

  it("returns a non-empty object for the overrides: section", () => {
    const overrides = parseYamlStringMap(workspaceYaml, "overrides");
    assert.ok(
      Object.keys(overrides).length > 0,
      "overrides: section must have at least one entry",
    );
  });

  it('parses the "-" suppression token for optional native deps', () => {
    const overrides = parseYamlStringMap(workspaceYaml, "overrides");
    const suppressions = Object.values(overrides).filter((v) => v === "-");
    assert.ok(
      suppressions.length > 0,
      'Expected at least one "-" suppression value in overrides:',
    );
  });

  it("parses quoted keys with > dep-path separator without including the quotes", () => {
    const overrides = parseYamlStringMap(workspaceYaml, "overrides");
    const depPathKeys = Object.keys(overrides).filter((k) => k.includes(">"));
    assert.ok(
      depPathKeys.length > 0,
      "Expected at least one key with > dep-path separator in overrides:",
    );
    for (const k of depPathKeys) {
      assert.ok(
        !k.startsWith('"') && !k.startsWith("'"),
        `Quotes must be stripped from override key, got: ${k}`,
      );
    }
  });

  it("parses the @esbuild-kit/esm-loader npm: alias correctly", () => {
    const overrides = parseYamlStringMap(workspaceYaml, "overrides");
    assert.ok(
      "@esbuild-kit/esm-loader" in overrides,
      'Expected "@esbuild-kit/esm-loader" to appear in overrides:',
    );
    assert.match(
      overrides["@esbuild-kit/esm-loader"]!,
      /^npm:/,
      "esm-loader override should be an npm: alias",
    );
  });

  it("all overrides values are non-empty strings", () => {
    const overrides = parseYamlStringMap(workspaceYaml, "overrides");
    for (const [k, v] of Object.entries(overrides)) {
      assert.ok(
        v.length > 0,
        `Expected non-empty value for overrides key "${k}"`,
      );
    }
  });
});
