import { db, notifications, userCompanyMemberships } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { sendPushToUser, sendPushToUsers } from "./push.service";

type NotificationType = typeof notifications.$inferSelect.type;

interface CreateNotificationParams {
  companyId?: string;
  branchId?: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sendPush?: boolean;
}

export async function createNotification(params: CreateNotificationParams) {
  const [notification] = await db
    .insert(notifications)
    .values({
      companyId: params.companyId ?? null,
      branchId: params.branchId ?? null,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      data: params.data ?? null,
    })
    .returning();

  if (params.sendPush !== false) {
    sendPushToUser(params.userId, {
      title: params.title,
      body: params.body,
      data: {
        notificationId: notification.id,
        type: params.type,
        ...params.data,
      },
    }).catch(() => {});
  }

  return notification;
}

async function notifyCompanyUsers(
  companyId: string,
  type: NotificationType,
  title: string,
  body?: string,
  data?: Record<string, unknown>,
  sendPush = true,
) {
  const memberships = await db
    .select({ userId: userCompanyMemberships.userId })
    .from(userCompanyMemberships)
    .where(
      and(
        eq(userCompanyMemberships.companyId, companyId),
        eq(userCompanyMemberships.status, "active"),
      ),
    );

  for (const m of memberships) {
    await createNotification({
      companyId,
      userId: m.userId,
      type,
      title,
      body,
      data,
      sendPush,
    });
  }
}

export async function onInquiryCreated(
  companyId: string,
  inquiryId: string,
  fullName: string,
) {
  await notifyCompanyUsers(
    companyId,
    "inquiry_created",
    "Новая заявка",
    `Новая заявка на аренду от ${fullName}`,
    { inquiryId },
  );
}

export async function onB2BRequestCreated(
  companyId: string,
  requestId: string,
  companyName: string,
) {
  await notifyCompanyUsers(
    companyId,
    "b2b_request_created",
    "Новый B2B запрос",
    `B2B запрос от ${companyName}`,
    { requestId },
  );
}

export async function onRentalStarted(
  companyId: string,
  userId: string,
  rentalId: string,
) {
  await createNotification({
    companyId,
    userId,
    type: "rental_started",
    title: "Аренда началась",
    body: "Ваш транспорт разблокирован. Удачной поездки!",
    data: { rentalId },
  });
}

export async function onRentalEnded(
  companyId: string,
  userId: string,
  rentalId: string,
) {
  await createNotification({
    companyId,
    userId,
    type: "rental_ended",
    title: "Аренда завершена",
    body: "Аренда успешно завершена. Спасибо!",
    data: { rentalId },
  });
}

export async function onPaymentPaid(
  companyId: string,
  userId: string,
  paymentId: string,
) {
  await createNotification({
    companyId,
    userId,
    type: "payment_paid",
    title: "Оплата получена",
    data: { paymentId },
  });
}

export async function onIncidentCreated(
  companyId: string,
  userId: string,
  incidentId: string,
) {
  await createNotification({
    companyId,
    userId,
    type: "incident_created",
    title: "Новый инцидент",
    data: { incidentId },
  });
}

export async function onMaintenanceCreated(
  companyId: string,
  userId: string,
  maintenanceId: string,
) {
  await createNotification({
    companyId,
    userId,
    type: "maintenance_created",
    title: "Запланировано ТО",
    data: { maintenanceId },
  });
}

export async function onGeofenceEnter(
  companyId: string,
  notifyUserIds: string[],
  geofenceId: string,
  geofenceName: string,
  geofenceType: string,
  assetId?: string,
) {
  const typeLabel = geofenceType === "no_ride_zone" ? "запретная зона" : "зона";
  const title = `Въезд в ${typeLabel}: ${geofenceName}`;
  if (notifyUserIds.length === 0) {
    await notifyCompanyUsers(companyId, "geofence_enter", title, undefined, {
      geofenceId,
      geofenceName,
      geofenceType,
      assetId,
    });
  } else {
    for (const userId of notifyUserIds) {
      await createNotification({
        companyId,
        userId,
        type: "geofence_enter",
        title,
        data: { geofenceId, geofenceName, geofenceType, assetId },
      });
    }
  }
}

export async function onGeofenceExit(
  companyId: string,
  notifyUserIds: string[],
  geofenceId: string,
  geofenceName: string,
  geofenceType: string,
  assetId?: string,
) {
  const typeLabel = geofenceType === "operating_zone" ? "рабочая зона" : "зона";
  const title = `Выезд из зоны: ${geofenceName}`;
  const body =
    geofenceType === "operating_zone"
      ? "Транспорт покинул рабочую зону"
      : undefined;
  if (notifyUserIds.length === 0) {
    await notifyCompanyUsers(companyId, "geofence_exit", title, body, {
      geofenceId,
      geofenceName,
      geofenceType,
      assetId,
    });
  } else {
    for (const userId of notifyUserIds) {
      await createNotification({
        companyId,
        userId,
        type: "geofence_exit",
        title,
        body,
        data: { geofenceId, geofenceName, geofenceType, assetId },
      });
    }
  }
}

export async function onSpeedLimitExceeded(
  companyId: string,
  notifyUserIds: string[],
  assetId: string,
  currentSpeed: number,
  limitKmh: number,
) {
  const title = "Превышение скорости";
  const body = `Скорость ${currentSpeed} км/ч превышает лимит ${limitKmh} км/ч`;
  if (notifyUserIds.length === 0) {
    await notifyCompanyUsers(companyId, "speed_limit_exceeded", title, body, {
      assetId,
      currentSpeed,
      limitKmh,
    });
  } else {
    const ids = notifyUserIds;
    for (const userId of ids) {
      await createNotification({
        companyId,
        userId,
        type: "speed_limit_exceeded",
        title,
        body,
        data: { assetId, currentSpeed, limitKmh },
      });
    }
  }
}

export async function onRentalPaymentHeld(
  companyId: string,
  userId: string,
  paymentId: string,
  rentalId: string,
) {
  await createNotification({
    companyId,
    userId,
    type: "rental_payment_held",
    title: "Залог заблокирован",
    body: "Сумма залога успешно заблокирована на вашей карте.",
    data: { paymentId, rentalId },
  });
}

export async function onRentalPaymentCaptured(
  companyId: string,
  userId: string,
  paymentId: string,
  rentalId: string,
) {
  await createNotification({
    companyId,
    userId,
    type: "rental_payment_captured",
    title: "Оплата списана",
    body: "Стоимость аренды успешно списана с вашей карты.",
    data: { paymentId, rentalId },
  });
}

export async function onRentalPaymentVoided(
  companyId: string,
  userId: string,
  paymentId: string,
  rentalId: string,
) {
  await createNotification({
    companyId,
    userId,
    type: "rental_payment_voided",
    title: "Залог разблокирован",
    body: "Залог успешно возвращён на вашу карту.",
    data: { paymentId, rentalId },
  });
}

export async function listUserNotifications(
  userId: string,
  companyId?: string,
) {
  const conditions = [eq(notifications.userId, userId)];
  if (companyId) conditions.push(eq(notifications.companyId, companyId));
  return db
    .select()
    .from(notifications)
    .where(and(...conditions));
}

export async function markRead(id: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning();
  return updated;
}

export async function markAllRead(userId: string, companyId?: string) {
  const conditions = [
    eq(notifications.userId, userId),
    isNull(notifications.readAt),
  ];
  if (companyId) conditions.push(eq(notifications.companyId, companyId));
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conditions));
}

export { sendPushToUser, sendPushToUsers };
