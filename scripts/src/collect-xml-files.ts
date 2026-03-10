/**
 * collect-xml-files
 *
 * Thin CLI runner: prints the derived CI XML basenames as a single
 * space-separated line so ci.sh can capture them with $(...).
 *
 * Usage (called by ci.sh):
 *   pnpm --filter @workspace/scripts run --silent collect-xml-files
 */

import { CI_XML_FILES } from "./ci-xml-files.js";

process.stdout.write(CI_XML_FILES.join(" ") + "\n");
