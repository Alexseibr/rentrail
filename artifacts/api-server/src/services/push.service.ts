import { getUserTokens } from "./push-token.service";
import { logger } from "../lib/logger";

export interface PushMessage {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUser(
  userId: string,
  message: PushMessage,
): Promise<void> {
  const tokens = await getUserTokens(userId);
  if (tokens.length === 0) return;

  const notifications = tokens
    .filter(
      (t) =>
        t.token.startsWith("ExponentPushToken[") ||
        t.token.startsWith("ExpoPushToken["),
    )
    .map((t) => ({
      to: t.token,
      title: message.title,
      body: message.body ?? "",
      data: message.data ?? {},
      sound: message.sound !== null ? (message.sound ?? "default") : null,
      ...(message.badge !== undefined ? { badge: message.badge } : {}),
    }));

  if (notifications.length === 0) return;

  const chunks: (typeof notifications)[] = [];
  for (let i = 0; i < notifications.length; i += 100) {
    chunks.push(notifications.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        logger.error(
          { status: response.status },
          "Expo Push API returned error status",
        );
        return;
      }

      const result = (await response.json()) as { data: ExpoPushTicket[] };
      for (const ticket of result.data ?? []) {
        if (ticket.status === "error") {
          const errCode = ticket.details?.error;
          if (errCode === "DeviceNotRegistered") {
            logger.info(
              { ticket },
              "Expo push: device not registered, should remove token",
            );
          } else {
            logger.warn({ ticket }, "Expo push ticket error");
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Failed to send Expo push notification");
    }
  }
}

export async function sendPushToUsers(
  userIds: string[],
  message: PushMessage,
): Promise<void> {
  await Promise.all(userIds.map((id) => sendPushToUser(id, message)));
}
