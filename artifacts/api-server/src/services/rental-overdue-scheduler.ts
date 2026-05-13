import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { db, rentals } from "@workspace/db";
import { logger } from "../lib/logger";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 5_000;
let timer: NodeJS.Timeout | null = null;

export async function markOverdueRentals(now = new Date()) {
  const updated = await db
    .update(rentals)
    .set({ status: "overdue", updatedAt: now })
    .where(
      and(
        inArray(rentals.status, ["active", "extended"]),
        isNotNull(rentals.plannedEndAt),
        lt(rentals.plannedEndAt, now),
      ),
    )
    .returning({ id: rentals.id });

  if (updated.length > 0) {
    logger.info({ count: updated.length }, "Marked rentals as overdue");
  }

  return updated.length;
}

export function startRentalOverdueScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer || process.env.NODE_ENV === "test") return;
  const effectiveInterval = Math.max(intervalMs, MIN_INTERVAL_MS);

  logger.info(
    { intervalMs: effectiveInterval },
    "Starting rental overdue scheduler",
  );

  timer = setInterval(() => {
    void markOverdueRentals().catch((err) => {
      logger.error({ err }, "Failed to mark overdue rentals");
    });
  }, effectiveInterval);
}

export function stopRentalOverdueScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export function getRentalOverdueSchedulerIntervalMs(): number {
  const raw = process.env["RENTAL_OVERDUE_SCHEDULER_INTERVAL_MS"];
  const parsed = raw ? Number(raw) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_INTERVAL_MS;
  }

  return Math.max(parsed, MIN_INTERVAL_MS);
}
