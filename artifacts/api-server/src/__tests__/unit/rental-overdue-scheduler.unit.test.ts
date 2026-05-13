import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRentalOverdueSchedulerIntervalMs,
  startRentalOverdueScheduler,
  stopRentalOverdueScheduler,
} from "../../services/rental-overdue-scheduler";

describe("rental overdue scheduler", () => {
  afterEach(() => {
    stopRentalOverdueScheduler();
    delete process.env["RENTAL_OVERDUE_SCHEDULER_INTERVAL_MS"];
    vi.restoreAllMocks();
  });

  it("returns default interval for invalid env value", () => {
    process.env["RENTAL_OVERDUE_SCHEDULER_INTERVAL_MS"] = "invalid";
    expect(getRentalOverdueSchedulerIntervalMs()).toBe(60_000);
  });

  it("enforces minimal interval floor", () => {
    process.env["RENTAL_OVERDUE_SCHEDULER_INTERVAL_MS"] = "1000";
    expect(getRentalOverdueSchedulerIntervalMs()).toBe(5_000);
  });

  it("starts with effective minimal interval", () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    startRentalOverdueScheduler(1000);

    expect(setIntervalSpy).toHaveBeenCalledOnce();
    expect(setIntervalSpy.mock.calls[0]?.[1]).toBe(5_000);
  });
});
