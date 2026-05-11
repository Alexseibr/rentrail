/**
 * ci-xml-files
 *
 * Single source of truth for the XML report basenames the CI pipeline is
 * expected to produce.  Derived by scanning test-command declarations rather
 * than maintained as a hand-written parallel list.
 *
 * Patterns recognised:
 *   • CLI flag        --outputFile.junit=test-results/<name>.xml  (package.json scripts)
 *   • Vitest cfg (a)  junit: "test-results/<name>.xml"            (per-reporter object key in vitest.*.ts)
 *   • Vitest cfg (b)  outputFile: "test-results/<name>.xml"       (plain string form in vitest.*.ts)
 *   • Vitest cfg (c)  ['junit', { outputFile: 'test-results/<name>.xml' }]  (reporter-tuple syntax in vitest.*.ts)
 *
 * Adding a new `pnpm test:xxx` step that declares one of these patterns
 * automatically extends the list — no separate manual edit required.
 *
 * Scope: the workspace root itself plus every package directory listed in
 * pnpm-workspace.yaml are scanned for vitest.*.ts configs.  This means a
 * config placed at e.g. artifacts/api-server/vitest.e2e.ts is detected
 * automatically without any manual registration.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Minimal but correct YAML sequence parser
// ---------------------------------------------------------------------------

/**
 * Parse the value of a top-level sequence key from a YAML document and return
 * its items as plain strings.
 *
 * Handles all three YAML scalar styles that may appear in pnpm-workspace.yaml:
 *   • Single-quoted  – 'artifacts/*'  (only escape is '' → literal ')
 *   • Double-quoted  – "artifacts/*"  (standard backslash escapes)
 *   • Bare/plain     – artifacts/*    (trailing `# comment` stripped)
 *
 * Does not support multi-line scalars or nested mappings — those are not used
 * in pnpm-workspace.yaml package lists.
 */
function parseYamlStringSequence(yaml: string, key: string): string[] {
  const keyRe = new RegExp(`^${key}\\s*:`);
  const results: string[] = [];
  let inSequence = false;

  for (const rawLine of yaml.split("\n")) {
    if (keyRe.test(rawLine)) {
      inSequence = true;
      continue;
    }
    if (!inSequence) continue;

    // A non-indented non-empty line that is not a comment ends the sequence.
    if (
      /^\S/.test(rawLine) &&
      rawLine.trim() !== "" &&
      !rawLine.trimStart().startsWith("#")
    ) {
      break;
    }

    // Sequence item: leading whitespace then "- ".
    const trimmed = rawLine.trimStart();
    if (!trimmed.startsWith("- ") && trimmed !== "-") continue;

    const scalar = trimmed.slice(2).trimStart();
    if (scalar === "") continue;

    if (scalar.startsWith("'")) {
      // Single-quoted scalar: '' is an escaped single quote inside the value.
      let i = 1;
      let value = "";
      while (i < scalar.length) {
        if (scalar[i] === "'") {
          if (scalar[i + 1] === "'") {
            value += "'";
            i += 2;
          } else {
            break; // closing quote
          }
        } else {
          value += scalar[i];
          i++;
        }
      }
      if (value.length > 0 || i < scalar.length) results.push(value);
    } else if (scalar.startsWith('"')) {
      // Double-quoted scalar: standard backslash escapes.
      let i = 1;
      let value = "";
      while (i < scalar.length) {
        if (scalar[i] === "\\") {
          const next = scalar[i + 1] ?? "";
          switch (next) {
            case "n":
              value += "\n";
              break;
            case "t":
              value += "\t";
              break;
            case "r":
              value += "\r";
              break;
            case "\\":
              value += "\\";
              break;
            case '"':
              value += '"';
              break;
            default:
              value += next;
          }
          i += 2;
        } else if (scalar[i] === '"') {
          break; // closing quote
        } else {
          value += scalar[i];
          i++;
        }
      }
      if (value.length > 0 || i < scalar.length) results.push(value);
    } else {
      // Bare/plain scalar: a ` #` (space then hash) starts an inline comment.
      const commentIdx = scalar.search(/\s+#/);
      const value =
        commentIdx === -1 ? scalar.trimEnd() : scalar.slice(0, commentIdx);
      if (value.length > 0) results.push(value);
    }
  }

  return results;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/src/ -> scripts/ -> workspace root
const WORKSPACE_ROOT = join(__dirname, "../..");

/**
 * Parse pnpm-workspace.yaml and return the resolved absolute paths of every
 * package directory declared under the `packages:` key.  Glob patterns ending
 * in `/*` are expanded one level; exact paths are used as-is.  Directories
 * that do not exist on disk are silently skipped.
 *
 * Falls back to an empty array when the yaml file is absent or unreadable so
 * the caller always gets a safe iterable.
 */
function resolveWorkspacePackageDirs(workspaceRoot: string): string[] {
  let yaml: string;
  try {
    yaml = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");
  } catch {
    return [];
  }

  const patterns = parseYamlStringSequence(yaml, "packages");

  const dirs: string[] = [];
  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      // Wildcard: expand one directory level.
      const base = join(workspaceRoot, pattern.slice(0, -2));
      try {
        for (const entry of readdirSync(base, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            dirs.push(join(base, entry.name));
          }
        }
      } catch {
        // Directory doesn't exist or isn't readable — skip silently.
      }
    } else {
      // Exact path — include if it resolves to an existing directory.
      const dir = join(workspaceRoot, pattern);
      try {
        if (statSync(dir).isDirectory()) dirs.push(dir);
      } catch {
        // skip non-existent paths
      }
    }
  }

  return dirs;
}

/**
 * Scan the workspace and return the sorted, deduplicated set of XML basename
 * strings that CI test commands are declared to write into test-results/.
 *
 * Two sources are consulted:
 *   1. Root package.json scripts — CLI flag `--outputFile.junit=…`
 *   2. vitest.*.ts config files at the workspace root AND at the root of every
 *      package directory listed in pnpm-workspace.yaml.
 */
export function collectCiXmlFiles(
  workspaceRoot: string = WORKSPACE_ROOT,
): string[] {
  const files = new Set<string>();

  // 1. Scan package.json scripts for --outputFile.junit=test-results/<name>.xml
  const pkgPath = join(workspaceRoot, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const CLI_FLAG_RE = /--outputFile\.junit=test-results\/(\S+?\.xml)/g;
  for (const cmd of Object.values(pkg.scripts ?? {})) {
    for (const m of cmd.matchAll(CLI_FLAG_RE)) {
      const name = m[1];
      if (name !== undefined) files.add(name);
    }
  }

  // 2a. Per-reporter object key:  outputFile: { junit: "test-results/<name>.xml" }
  //     Matches both quoted ("junit") and unquoted (junit) property names.
  const JUNIT_KEY_RE = /\bjunit\b\s*:\s*["']test-results\/([^"']+?\.xml)["']/g;

  // 2b. Plain string form:  outputFile: "test-results/<name>.xml"
  //     Used when a single reporter writes all output to one file.
  const OUTPUT_FILE_RE =
    /\boutputFile\s*:\s*["']test-results\/([^"']+?\.xml)["']/g;

  // 2c. Reporter-tuple form:  ['junit', { outputFile: 'test-results/<name>.xml' }]
  //     Note: OUTPUT_FILE_RE (2b) already matches `outputFile: '...'` appearing
  //     anywhere — including inside a tuple options object — so in practice these
  //     two regexes overlap for the tuple case.  TUPLE_RE is kept as a distinct
  //     pass to (a) document the pattern explicitly in both code and tests, and
  //     (b) guard against a future tightening of OUTPUT_FILE_RE that might require
  //     surrounding context.  The Set-based deduplication in collectCiXmlFiles()
  //     means double-matching the same basename has no behavioral effect.
  const TUPLE_RE =
    /\[\s*["']junit["']\s*,\s*\{[^}]*\boutputFile\s*:\s*["']test-results\/([^"']+?\.xml)["']/g;

  /**
   * Scan a single directory for vitest.*.ts files and collect declared XML
   * basenames into `files`.
   */
  function scanDir(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const f of entries) {
      if (!/^vitest\..+\.ts$/.test(f)) continue;
      const content = readFileSync(join(dir, f), "utf8");
      for (const m of content.matchAll(JUNIT_KEY_RE)) {
        const name = m[1];
        if (name !== undefined) files.add(name);
      }
      for (const m of content.matchAll(OUTPUT_FILE_RE)) {
        const name = m[1];
        if (name !== undefined) files.add(name);
      }
      for (const m of content.matchAll(TUPLE_RE)) {
        const name = m[1];
        if (name !== undefined) files.add(name);
      }
    }
  }

  // 2. Scan vitest.*.ts config files at the workspace root …
  scanDir(workspaceRoot);

  // … and at the root of every workspace package directory.
  for (const pkgDir of resolveWorkspacePackageDirs(workspaceRoot)) {
    scanDir(pkgDir);
  }

  return [...files].sort();
}

/** The derived list of XML basenames CI is expected to produce. */
export const CI_XML_FILES: string[] = collectCiXmlFiles();
