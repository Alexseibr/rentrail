import { db, notifications, userCompanyMemberships } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

type NotificationType = typeof notifications.$inferSelect.type;

interface CreateNotificationParams {
  companyId?: string;
  branchId?: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams) {
  const [notification] = await db.insert(notifications).values({
    companyId: params.companyId ?? null,
    branchId: params.branchId ?? null,
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    data: params.data ?? null,
  }).returning();
  return notification;
}

async function notifyCompanyUsers(companyId: string, type: NotificationType, title: string, body?: string, data?: Record<string, unknown>) {
  const memberships = await db
    .select({ userId: userCompanyMemberships.userId })
    .from(userCompanyMemberships)
    .where(and(eq(userCompanyMemberships.companyId, companyId), eq(userCompanyMemberships.status, "active")));

  for (const m of memberships) {
    await createNotification({ companyId, userId: m.userId, type, title, body, data });
  }
}

export async function onInquiryCreated(companyId: string, inquiryId: string, fullName: string) {
  await notifyCompanyUsers(companyId, "inquiry_created", "New inquiry received", `New rental inquiry from ${fullName}`, { inquiryId });
}

export async function onB2BRequestCreated(companyId: string, requestId: string, companyName: string) {
  await notifyCompanyUsers(companyId, "b2b_request_created", "New B2B request", `New B2B request from ${companyName}`, { requestId });
}

export async function onRentalStarted(companyId: string, userId: string, rentalId: string) {
  await createNotification({ companyId, userId, type: "rental_started", title: "Rental started", data: { rentalId } });
}

export async function onPaymentPaid(companyId: string, userId: string, paymentId: string) {
  await createNotification({ companyId, userId, type: "payment_paid", title: "Payment received", data: { paymentId } });
}

export async function onIncidentCreated(companyId: string, userId: string, incidentId: string) {
  await createNotification({ companyId, userId, type: "incident_created", title: "New incident reported", data: { incidentId } });
}

export async function onMaintenanceCreated(companyId: string, userId: string, maintenanceId: string) {
  await createNotification({ companyId, userId, type: "maintenance_created", title: "Maintenance scheduled", data: { maintenanceId } });
}

export async function listUserNotifications(userId: string, companyId?: string) {
  const conditions = [eq(notifications.userId, userId)];
  if (companyId) conditions.push(eq(notifications.companyId, companyId));
  return db.select().from(notifications).where(and(...conditions));
}

export async function markRead(id: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning();
  return updated;
}

export async function markAllRead(userId: string, companyId?: string) {
  const conditions = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (companyId) conditions.push(eq(notifications.companyId, companyId));
  await db.update(notifications).set({ readAt: new Date() }).where(and(...conditions));
}
