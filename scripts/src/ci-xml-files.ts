/**
 * ci-xml-files
 *
 * Single source of truth for the XML report basenames the CI pipeline is
 * expected to produce.  Derived by scanning test-command declarations rather
 * than maintained as a hand-written parallel list.
 *
 * Patterns recognised:
 *   • CLI flag    --outputFile.junit=test-results/<name>.xml  (package.json scripts)
 *   • Vitest cfg  junit: "test-results/<name>.xml"            (vitest.*.ts files)
 *
 * Adding a new `pnpm test:xxx` step that declares one of these patterns
 * automatically extends the list — no separate manual edit required.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/src/ -> scripts/ -> workspace root
const WORKSPACE_ROOT = join(__dirname, "../..");

/**
 * Scan the workspace and return the sorted, deduplicated set of XML basename
 * strings that CI test commands are declared to write into test-results/.
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

  // 2. Scan vitest.*.ts config files for outputFile.junit entries.
  //    Matches both quoted ("junit") and unquoted (junit) object keys.
  const CONFIG_RE = /\bjunit\b\s*:\s*["']test-results\/([^"']+?\.xml)["']/g;
  const vitestConfigs = readdirSync(workspaceRoot).filter((f) =>
    /^vitest\..+\.ts$/.test(f),
  );
  for (const configFile of vitestConfigs) {
    const content = readFileSync(join(workspaceRoot, configFile), "utf8");
    for (const m of content.matchAll(CONFIG_RE)) {
      const name = m[1];
      if (name !== undefined) files.add(name);
    }
  }

  return [...files].sort();
}

/** The derived list of XML basenames CI is expected to produce. */
export const CI_XML_FILES: string[] = collectCiXmlFiles();
