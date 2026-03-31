import app from "./app";
import { logger } from "./lib/logger";
import { validateEnv, getEnvProfile } from "./lib/env";

try {
  const env = validateEnv();
  logger.info({ profile: getEnvProfile() }, "Environment validated");
} catch (err) {
  logger.fatal({ err }, "Environment validation failed — aborting startup");
  process.exit(1);
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
