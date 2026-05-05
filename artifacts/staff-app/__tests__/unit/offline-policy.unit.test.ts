import { describe, it, expect } from "vitest";

type QueueableAction =
  | "mark_inquiry_contacted"
  | "create_incident"
  | "edit_incident"
  | "change_incident_status"
  | "create_maintenance"
  | "change_asset_status"
  | "upload_attachment"
  | "change_work_order_status"
  | "change_maintenance_status"
  | "vehicle_command";

type OnlineOnlyAction =
  | "login"
  | "rental_start"
  | "rental_return"
  | "payment_process"
  | "create_rental"
  | "scan_resolve";

const QUEUEABLE_ACTIONS: Set<string> = new Set<QueueableAction>([
  "mark_inquiry_contacted",
  "create_incident",
  "edit_incident",
  "change_incident_status",
  "create_maintenance",
  "change_asset_status",
  "upload_attachment",
  "change_work_order_status",
  "change_maintenance_status",
  "vehicle_command",
]);

const ONLINE_ONLY_ACTIONS: Set<string> = new Set<OnlineOnlyAction>([
  "login",
  "rental_start",
  "rental_return",
  "payment_process",
  "create_rental",
  "scan_resolve",
]);

function isQueueable(action: string): boolean {
  return QUEUEABLE_ACTIONS.has(action);
}

function isOnlineOnly(action: string): boolean {
  return ONLINE_ONLY_ACTIONS.has(action);
}

describe("Offline Action Policy", () => {
  describe("queueable actions", () => {
    const queueable = [
      "mark_inquiry_contacted",
      "create_incident",
      "edit_incident",
      "change_incident_status",
      "create_maintenance",
      "change_asset_status",
      "upload_attachment",
      "change_work_order_status",
      "change_maintenance_status",
      "vehicle_command",
    ];

    it.each(queueable)("%s is queueable", (action) => {
      expect(isQueueable(action)).toBe(true);
      expect(isOnlineOnly(action)).toBe(false);
    });
  });

  describe("online-only actions", () => {
    const onlineOnly = [
      "login",
      "rental_start",
      "rental_return",
      "payment_process",
      "create_rental",
      "scan_resolve",
    ];

    it.each(onlineOnly)("%s is online-only", (action) => {
      expect(isOnlineOnly(action)).toBe(true);
      expect(isQueueable(action)).toBe(false);
    });
  });

  describe("unknown actions", () => {
    it("unknown action is not queueable", () => {
      expect(isQueueable("random_action")).toBe(false);
    });

    it("unknown action is not online-only", () => {
      expect(isOnlineOnly("random_action")).toBe(false);
    });
  });

  describe("no overlap between sets", () => {
    it("queueable and online-only are disjoint", () => {
      for (const action of QUEUEABLE_ACTIONS) {
        expect(ONLINE_ONLY_ACTIONS.has(action)).toBe(false);
      }
      for (const action of ONLINE_ONLY_ACTIONS) {
        expect(QUEUEABLE_ACTIONS.has(action)).toBe(false);
      }
    });
  });

  describe("queue size limits", () => {
    it("queueable set is small and bounded (MVP pragmatic)", () => {
      expect(QUEUEABLE_ACTIONS.size).toBeLessThanOrEqual(15);
      expect(QUEUEABLE_ACTIONS.size).toBe(10);
    });
  });
});
