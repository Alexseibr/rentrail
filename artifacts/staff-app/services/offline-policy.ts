export type QueueableAction =
  | "mark_inquiry_contacted"
  | "create_incident"
  | "edit_incident"
  | "create_maintenance"
  | "change_asset_status"
  | "upload_attachment";

export type OnlineOnlyAction =
  | "login"
  | "rental_start"
  | "rental_return"
  | "payment_process"
  | "device_command"
  | "create_rental"
  | "scan_resolve";

const QUEUEABLE_ACTIONS: Set<string> = new Set<QueueableAction>([
  "mark_inquiry_contacted",
  "create_incident",
  "edit_incident",
  "create_maintenance",
  "change_asset_status",
  "upload_attachment",
]);

const ONLINE_ONLY_ACTIONS: Set<string> = new Set<OnlineOnlyAction>([
  "login",
  "rental_start",
  "rental_return",
  "payment_process",
  "device_command",
  "create_rental",
  "scan_resolve",
]);

export function isQueueable(action: string): boolean {
  return QUEUEABLE_ACTIONS.has(action);
}

export function isOnlineOnly(action: string): boolean {
  return ONLINE_ONLY_ACTIONS.has(action);
}

export function getQueueableActions(): QueueableAction[] {
  return Array.from(QUEUEABLE_ACTIONS) as QueueableAction[];
}

export function getActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    mark_inquiry_contacted: "Mark inquiry as contacted",
    create_incident: "Create incident report",
    edit_incident: "Edit incident",
    create_maintenance: "Create maintenance task",
    change_asset_status: "Change asset status",
    upload_attachment: "Upload photo/attachment",
    login: "Login (requires internet)",
    rental_start: "Start rental (requires internet)",
    rental_return: "Return rental (requires internet)",
    payment_process: "Process payment (requires internet)",
    device_command: "Send device command (requires internet)",
    create_rental: "Create rental (requires internet)",
    scan_resolve: "Scan & resolve (requires internet)",
  };
  return descriptions[action] ?? action;
}
