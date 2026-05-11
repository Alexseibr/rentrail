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
 *   • Vitest cfg (d)  any of the above inside a file reachable via a chain of
 *                     relative imports starting from a vitest.*.ts config —
 *                     followed recursively up to MAX_IMPORT_DEPTH (3) levels
 *                     deep.  A per-config visited set prevents infinite loops
 *                     from circular import chains.  Only relative specifiers
 *                     (starting with `.` or `..`) are followed; bare module
 *                     specifiers (e.g. `vitest/config`) are skipped.
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
// Minimal but correct YAML scalar helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single-quoted YAML scalar starting at index 0 of `s` (the opening
 * quote must already have been consumed, i.e. `s` begins with the content or
 * the next `'`).
 *
 * Returns the decoded string value and the index in `s` immediately after the
 * closing quote (or `s.length` when the closing quote is missing).
 */
function parseSingleQuotedScalar(s: string): { value: string; end: number } {
  let i = 0;
  let value = "";
  while (i < s.length) {
    if (s[i] === "'") {
      if (s[i + 1] === "'") {
        value += "'";
        i += 2;
      } else {
        i++; // skip closing quote
        break;
      }
    } else {
      value += s[i];
      i++;
    }
  }
  return { value, end: i };
}

/**
 * Parse a double-quoted YAML scalar starting at index 0 of `s` (the opening
 * quote must already have been consumed).
 *
 * Handles the common backslash escapes: \\n, \\t, \\r, \\\\, and \\".
 *
 * Returns the decoded string value and the index in `s` immediately after the
 * closing quote (or `s.length` when the closing quote is missing).
 */
function parseDoubleQuotedScalar(s: string): { value: string; end: number } {
  let i = 0;
  let value = "";
  while (i < s.length) {
    if (s[i] === "\\") {
      const next = s[i + 1] ?? "";
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
    } else if (s[i] === '"') {
      i++; // skip closing quote
      break;
    } else {
      value += s[i];
      i++;
    }
  }
  return { value, end: i };
}

/**
 * Parse a bare/plain YAML scalar.  An inline comment (` #…`) is stripped;
 * trailing whitespace is trimmed.
 */
function parseBareScalar(s: string): string {
  const commentIdx = s.search(/\s+#/);
  return commentIdx === -1 ? s.trimEnd() : s.slice(0, commentIdx);
}

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

// ---------------------------------------------------------------------------
// Minimal but correct YAML mapping parser
// ---------------------------------------------------------------------------

/**
 * Parse the value of a top-level mapping key from a YAML document and return
 * its entries as a plain `Record<string, string>`.
 *
 * Suitable for reading the `catalog:` and `overrides:` sections of
 * pnpm-workspace.yaml without a third-party YAML library.
 *
 * Handles all three YAML scalar styles for both keys and values:
 *   • Single-quoted  – '@scope/pkg': ^1.0.0
 *   • Double-quoted  – "@scope/pkg": ^1.0.0
 *   • Bare/plain     – react: 19.1.0   (trailing `# comment` stripped)
 *
 * Keys containing a colon (common for scoped npm packages like
 * `@scope/pkg>@scope/dep`) must be quoted in the YAML source; bare keys stop
 * at the first `:` followed by a space or end-of-line, which is the standard
 * YAML key delimiter.
 *
 * Does not support multi-line scalars or nested mappings — those are not used
 * in the catalog/overrides sections.
 */
export function parseYamlStringMap(
  yaml: string,
  key: string,
): Record<string, string> {
  const keyRe = new RegExp(`^${key}\\s*:`);
  const results: Record<string, string> = {};
  let inMap = false;

  for (const rawLine of yaml.split("\n")) {
    if (keyRe.test(rawLine)) {
      inMap = true;
      continue;
    }
    if (!inMap) continue;

    // A non-indented non-empty line that is not a comment ends the mapping.
    if (
      /^\S/.test(rawLine) &&
      rawLine.trim() !== "" &&
      !rawLine.trimStart().startsWith("#")
    ) {
      break;
    }

    // Skip blank lines and comment-only lines.
    const trimmed = rawLine.trimStart();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Parse the entry key (single-quoted, double-quoted, or bare).
    let rest = trimmed;
    let entryKey: string;

    if (rest.startsWith("'")) {
      const { value, end } = parseSingleQuotedScalar(rest.slice(1));
      entryKey = value;
      rest = rest.slice(1 + end).trimStart();
    } else if (rest.startsWith('"')) {
      const { value, end } = parseDoubleQuotedScalar(rest.slice(1));
      entryKey = value;
      rest = rest.slice(1 + end).trimStart();
    } else {
      // Bare key: the delimiter is `: ` (colon + space) or `:\n` (colon at EOL).
      // We look for `:` followed by whitespace or end of string.
      const colonIdx = rest.search(/:\s|:$/);
      if (colonIdx === -1) continue; // malformed — skip
      entryKey = rest.slice(0, colonIdx).trimEnd();
      rest = rest.slice(colonIdx);
    }

    // Expect the `: ` separator after the key.
    if (!rest.startsWith(":")) continue; // malformed — skip
    rest = rest.slice(1).trimStart();

    // Parse the entry value (single-quoted, double-quoted, or bare).
    let entryValue: string;

    if (rest.startsWith("'")) {
      const { value } = parseSingleQuotedScalar(rest.slice(1));
      entryValue = value;
    } else if (rest.startsWith('"')) {
      const { value } = parseDoubleQuotedScalar(rest.slice(1));
      entryValue = value;
    } else {
      entryValue = parseBareScalar(rest);
    }

    if (entryKey.length > 0) {
      results[entryKey] = entryValue;
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

// ---------------------------------------------------------------------------
// Module-level shared helpers (used by both collectCiXmlFiles and
// findVitestConfigsWithoutOutputFile)
// ---------------------------------------------------------------------------

/**
 * Matches both `import ... from './path'` and `export ... from './path'`.
 * Only relative specifiers (starting with `.`) are followed; bare module
 * specifiers are left to the package manager.
 *
 * Global flag is required for matchAll.  matchAll clones the regex internally
 * so it never mutates lastIndex on the module-level instance.
 */
const RELATIVE_IMPORT_RE = /\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g;

/**
 * Resolve a relative import specifier from `fromDir` to an absolute file
 * path.  Tries the specifier as-is, then with `.ts`, then with `/index.ts`
 * appended (matching Node/TypeScript module resolution for local files).
 * Returns `null` when no candidate exists on disk.
 */
function resolveRelativeImport(
  fromDir: string,
  specifier: string,
): string | null {
  const candidates = [
    join(fromDir, specifier),
    join(fromDir, specifier + ".ts"),
    join(fromDir, specifier + "/index.ts"),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

// Non-global variants of the outputFile-detecting patterns.  Used with
// .test() which must not share state with the global regexes used by matchAll.
const JUNIT_KEY_TEST_RE = /\bjunit\b\s*:\s*["']test-results\/[^"']+?\.xml["']/;
const OUTPUT_FILE_TEST_RE =
  /\boutputFile\s*:\s*["']test-results\/[^"']+?\.xml["']/;
const TUPLE_TEST_RE =
  /\[\s*["']junit["']\s*,\s*\{[^}]*\boutputFile\s*:\s*["']test-results\/[^"']+?\.xml["']/;

/** Maximum import-chain depth for the outputFile presence check. */
const OUTPUT_FILE_CHECK_MAX_DEPTH = 3;

/**
 * Returns true when `filePath` (or any relative import it makes, followed
 * recursively up to OUTPUT_FILE_CHECK_MAX_DEPTH levels) contains a recognised
 * outputFile declaration pattern for the junit reporter.
 *
 * Mirrors the recursive depth used by collectCiXmlFiles so the two checks
 * stay consistent as import chains grow deeper.
 */
function fileHasOutputFile(
  filePath: string,
  visited: Set<string>,
  depth: number,
): boolean {
  if (depth > OUTPUT_FILE_CHECK_MAX_DEPTH) return false;
  if (visited.has(filePath)) return false;
  visited.add(filePath);

  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return false;
  }

  if (
    JUNIT_KEY_TEST_RE.test(content) ||
    OUTPUT_FILE_TEST_RE.test(content) ||
    TUPLE_TEST_RE.test(content)
  ) {
    return true;
  }

  const fileDir = dirname(filePath);
  for (const m of content.matchAll(RELATIVE_IMPORT_RE)) {
    const specifier = m[1];
    if (specifier === undefined) continue;
    const helperPath = resolveRelativeImport(fileDir, specifier);
    if (helperPath === null) continue;
    if (fileHasOutputFile(helperPath, visited, depth + 1)) return true;
  }

  return false;
}

/**
 * Returns true when `filePath` (or any relative import it makes, followed
 * recursively up to OUTPUT_FILE_CHECK_MAX_DEPTH levels) contains a recognised
 * outputFile declaration pattern for the junit reporter.
 */
function configHasOutputFile(filePath: string): boolean {
  return fileHasOutputFile(filePath, new Set<string>(), 0);
}

/**
 * Scan the workspace and return the sorted, deduplicated set of XML basename
 * strings that CI test commands are declared to write into test-results/.
 *
 * Two sources are consulted:
 *   1. package.json scripts — CLI flag `--outputFile.junit=…` — read from
 *      the workspace root AND from every package directory listed in
 *      pnpm-workspace.yaml.
 *   2. vitest.*.ts config files at the workspace root AND at the root of every
 *      package directory listed in pnpm-workspace.yaml.
 */
export function collectCiXmlFiles(
  workspaceRoot: string = WORKSPACE_ROOT,
): string[] {
  const files = new Set<string>();

  const CLI_FLAG_RE = /--outputFile\.junit=test-results\/(\S+?\.xml)/g;

  /**
   * Scan a single package.json for --outputFile.junit CLI flags and collect
   * declared XML basenames into `files`.  Silently skips missing files.
   */
  function scanPkgJson(dir: string): void {
    let raw: string;
    try {
      raw = readFileSync(join(dir, "package.json"), "utf8");
    } catch {
      return;
    }
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    for (const cmd of Object.values(pkg.scripts ?? {})) {
      for (const m of cmd.matchAll(CLI_FLAG_RE)) {
        const name = m[1];
        if (name !== undefined) files.add(name);
      }
    }
  }

  // 1. Scan package.json scripts for --outputFile.junit=test-results/<name>.xml
  //    at the workspace root …
  scanPkgJson(workspaceRoot);

  // … and at the root of every workspace package directory.
  for (const pkgDir of resolveWorkspacePackageDirs(workspaceRoot)) {
    scanPkgJson(pkgDir);
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
   * Apply all outputFile-detecting regexes to `content` and add any matched
   * XML basenames into `files`.
   */
  function scanFileContent(content: string): void {
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

  /**
   * Maximum number of import-chain hops to follow from a vitest config file.
   * Depth 0 = the config itself; depth 1 = its direct imports; and so on.
   * A cap of 3 covers all practical helper-extraction patterns while bounding
   * the worst-case file-system traversal.
   */
  const MAX_IMPORT_DEPTH = 3;

  /**
   * Recursively scan `filePath` for outputFile declarations and follow its
   * relative imports up to `MAX_IMPORT_DEPTH` levels deep.
   *
   * @param filePath - Absolute path to the file to scan.
   * @param visited  - Set of already-visited absolute paths for this config
   *                   chain; prevents infinite loops from circular imports.
   * @param depth    - Current recursion depth (0 = starting file).
   */
  function scanFileRecursive(
    filePath: string,
    visited: Set<string>,
    depth: number,
  ): void {
    if (depth > MAX_IMPORT_DEPTH) return;
    if (visited.has(filePath)) return;
    visited.add(filePath);

    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      return;
    }

    scanFileContent(content);

    const fileDir = dirname(filePath);
    for (const m of content.matchAll(RELATIVE_IMPORT_RE)) {
      const specifier = m[1];
      if (specifier === undefined) continue;
      const resolvedPath = resolveRelativeImport(fileDir, specifier);
      if (resolvedPath === null) continue;
      scanFileRecursive(resolvedPath, visited, depth + 1);
    }
  }

  /**
   * Scan a single directory for vitest.*.ts files and collect declared XML
   * basenames into `files`.  For each config file, relative imports are
   * followed recursively up to MAX_IMPORT_DEPTH levels deep so that
   * outputFile declarations extracted into shared helpers — even through
   * multi-level import chains — are detected automatically.
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
      const configPath = join(dir, f);
      scanFileRecursive(configPath, new Set<string>(), 0);
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

// ---------------------------------------------------------------------------
// Output-file declaration check for vitest configs
// ---------------------------------------------------------------------------

/**
 * Scan the workspace and return the sorted absolute paths of vitest.*.ts
 * config files that reference the junit reporter but lack a detectable
 * outputFile declaration — either inline in the config or in a relative
 * helper imported up to OUTPUT_FILE_CHECK_MAX_DEPTH levels deep.
 *
 * A missing outputFile means vitest will write the JUnit XML to stdout rather
 * than to a file, so CI will never collect or validate the report.  Flagging
 * these configs early (as a static check) lets the developer fix the omission
 * before it silently causes a missing-report gap in CI.
 *
 * Only configs that explicitly reference "junit" as a reporter are checked;
 * workspace-grouper files (e.g. vitest.workspace.ts using defineWorkspace)
 * that have no junit reporter are naturally excluded.
 */
export function findVitestConfigsWithoutOutputFile(
  workspaceRoot: string = WORKSPACE_ROOT,
): string[] {
  const JUNIT_REPORTER_RE = /["']junit["']/;
  const missing: string[] = [];

  function checkDir(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const f of entries) {
      if (!/^vitest\..+\.ts$/.test(f)) continue;
      const configPath = join(dir, f);
      let content: string;
      try {
        content = readFileSync(configPath, "utf8");
      } catch {
        continue;
      }
      // Only check configs that reference the junit reporter.
      if (!JUNIT_REPORTER_RE.test(content)) continue;
      // Flag when no outputFile declaration is found in the config or its helpers.
      if (!configHasOutputFile(configPath)) {
        missing.push(configPath);
      }
    }
  }

  checkDir(workspaceRoot);
  for (const pkgDir of resolveWorkspacePackageDirs(workspaceRoot)) {
    checkDir(pkgDir);
  }

  return missing.sort();
}
