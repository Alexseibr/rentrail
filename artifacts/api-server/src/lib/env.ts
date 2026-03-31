import { z } from "zod/v4";

const envSchema = z.object({
  PORT: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(8).optional(),

  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DEFAULT_OBJECT_STORAGE_BUCKET_ID: z.string().optional(),
  PRIVATE_OBJECT_DIR: z.string().optional(),
  PUBLIC_OBJECT_SEARCH_PATHS: z.string().optional(),

  TELEMETRY_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `  ${i.path.join(".")}: ${i.message}`,
    );
    throw new Error(
      `Environment validation failed:\n${issues.join("\n")}`,
    );
  }
  return result.data;
}

export function getEnvProfile(): string {
  return process.env.NODE_ENV ?? "development";
}
