import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const startedAt = new Date().toISOString();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

router.get("/health/full", async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    uptime: process.uptime(),
    startedAt,
    env: process.env.NODE_ENV ?? "development",
    version: process.env.APP_VERSION ?? "dev",
    checks,
  });
});

export default router;
