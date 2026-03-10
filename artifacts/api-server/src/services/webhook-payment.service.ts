/**
 * Webhook processor for payment gateways.
 * Each gateway calls our server when payment status changes.
 * We verify the call, update DB, and notify the client via push.
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { db, payments } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  onRentalPaymentHeld,
  onRentalPaymentCaptured,
  onRentalPaymentVoided,
} from "./notification.service";

type PaymentStatus = typeof payments.$inferSelect.status;

async function findPaymentByProviderIdAndProvider(
  providerPaymentId: string,
  provider: string,
) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, providerPaymentId))
    .limit(1);

  if (!payment || payment.provider !== provider) return null;
  return payment;
}

async function updatePaymentStatus(
  paymentId: string,
  newStatus: PaymentStatus,
  paidAt?: Date,
) {
  const [updated] = await db
    .update(payments)
    .set({
      status: newStatus,
      paidAt: paidAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId))
    .returning();
  return updated;
}

async function notifyForStatus(
  prevStatus: PaymentStatus,
  newStatus: PaymentStatus,
  payment: typeof payments.$inferSelect,
) {
  if (prevStatus === newStatus) return;

  const rentalId = payment.rentalId;
  if (!rentalId || !payment.companyId || !payment.clientId) return;

  if (newStatus === "authorized") {
    await onRentalPaymentHeld(
      payment.companyId,
      payment.clientId,
      payment.id,
      rentalId,
    );
  } else if (newStatus === "paid") {
    await onRentalPaymentCaptured(
      payment.companyId,
      payment.clientId,
      payment.id,
      rentalId,
    );
  } else if (newStatus === "voided") {
    await onRentalPaymentVoided(
      payment.companyId,
      payment.clientId,
      payment.id,
      rentalId,
    );
  }
}

// ─── ЮKassa ──────────────────────────────────────────────────────────────────

function mapYukassaStatus(event: string): PaymentStatus | null {
  switch (event) {
    case "payment.waiting_for_capture":
      return "authorized";
    case "payment.succeeded":
      return "paid";
    case "payment.canceled":
      return "voided";
    case "refund.succeeded":
      return "refunded";
    default:
      return null;
  }
}

async function refetchYukassaPayment(
  providerPaymentId: string,
): Promise<Record<string, unknown> | null> {
  const shopId = process.env["YUKASSA_SHOP_ID"];
  const secretKey = process.env["YUKASSA_SECRET_KEY"];
  if (!shopId || !secretKey) return null;

  try {
    const auth =
      "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
    const res = await fetch(
      `https://api.yookassa.ru/v3/payments/${providerPaymentId}`,
      {
        headers: { Authorization: auth },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function processYukassaWebhook(
  body: unknown,
): Promise<{ ok: boolean }> {
  const payload = body as Record<string, unknown>;
  if (payload.type !== "notification") return { ok: true };

  const event = payload.event as string;
  const obj = payload.object as Record<string, unknown> | undefined;
  const providerPaymentId = obj?.id as string | undefined;

  if (!providerPaymentId || !event) {
    logger.warn(
      { event, providerPaymentId },
      "YuKassa webhook: missing fields",
    );
    return { ok: true };
  }

  const newStatus = mapYukassaStatus(event);
  if (!newStatus) {
    logger.info({ event }, "YuKassa webhook: unhandled event type");
    return { ok: true };
  }

  const verified = await refetchYukassaPayment(providerPaymentId);
  if (!verified) {
    logger.warn(
      { providerPaymentId },
      "YuKassa webhook: could not re-fetch payment for verification",
    );
    return { ok: false };
  }

  const payment = await findPaymentByProviderIdAndProvider(
    providerPaymentId,
    "yukassa",
  );
  if (!payment) {
    logger.info(
      { providerPaymentId },
      "YuKassa webhook: payment not found in DB (may be external)",
    );
    return { ok: true };
  }

  const updated = await updatePaymentStatus(
    payment.id,
    newStatus,
    newStatus === "paid" ? new Date() : undefined,
  );

  if (updated) {
    await notifyForStatus(payment.status as PaymentStatus, newStatus, payment);
    logger.info(
      { paymentId: payment.id, from: payment.status, to: newStatus },
      "YuKassa webhook: payment status updated",
    );
  }

  return { ok: true };
}

// ─── Тинькофф ────────────────────────────────────────────────────────────────

function buildTinkoffToken(
  params: Record<string, string | number | boolean | undefined>,
  secretKey: string,
): string {
  const kvPairs = Object.entries(params)
    .filter(
      ([k, v]) =>
        k !== "Token" && k !== "Receipt" && k !== "DATA" && v !== undefined,
    )
    .map(([k, v]) => [k, String(v)] as [string, string]);

  kvPairs.push(["Password", secretKey]);
  kvPairs.sort(([a], [b]) => a.localeCompare(b));

  const str = kvPairs.map(([, v]) => v).join("");
  return createHash("sha256").update(str).digest("hex");
}

function mapTinkoffStatus(status: string): PaymentStatus | null {
  switch (status) {
    case "AUTHORIZED":
      return "authorized";
    case "CONFIRMED":
      return "paid";
    case "CANCELED":
    case "REVERSED":
      return "voided";
    case "REJECTED":
      return "failed";
    case "REFUNDED":
    case "PARTIAL_REFUNDED":
      return "refunded";
    default:
      return null;
  }
}

export function verifyTinkoffToken(
  body: Record<string, unknown>,
  secretKey: string,
): boolean {
  const flat: Record<string, string | number | boolean | undefined> = {};
  for (const [k, v] of Object.entries(body)) {
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      flat[k] = v;
    }
  }
  const expected = buildTinkoffToken(flat, secretKey);
  const received = body["Token"] as string | undefined;
  if (!received) return false;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export async function processTinkoffWebhook(
  body: unknown,
): Promise<{ ok: boolean }> {
  const secretKey = process.env["TINKOFF_SECRET_KEY"];
  if (!secretKey) {
    logger.error("Tinkoff webhook: TINKOFF_SECRET_KEY not configured");
    return { ok: false };
  }

  const params = body as Record<string, unknown>;
  if (!verifyTinkoffToken(params, secretKey)) {
    logger.warn("Tinkoff webhook: invalid token signature");
    return { ok: false };
  }

  const status = params["Status"] as string | undefined;
  const paymentId = params["PaymentId"]
    ? String(params["PaymentId"])
    : undefined;

  if (!status || !paymentId) {
    logger.warn(params, "Tinkoff webhook: missing Status or PaymentId");
    return { ok: true };
  }

  const newStatus = mapTinkoffStatus(status);
  if (!newStatus) {
    logger.info({ status }, "Tinkoff webhook: unhandled status");
    return { ok: true };
  }

  const payment = await findPaymentByProviderIdAndProvider(
    paymentId,
    "tinkoff",
  );
  if (!payment) {
    logger.info({ paymentId }, "Tinkoff webhook: payment not found in DB");
    return { ok: true };
  }

  const updated = await updatePaymentStatus(
    payment.id,
    newStatus,
    newStatus === "paid" ? new Date() : undefined,
  );

  if (updated) {
    await notifyForStatus(payment.status as PaymentStatus, newStatus, payment);
    logger.info(
      { paymentId: payment.id, from: payment.status, to: newStatus },
      "Tinkoff webhook: payment status updated",
    );
  }

  return { ok: true };
}

// ─── CloudPayments ────────────────────────────────────────────────────────────

export function verifyCloudpaymentsHmac(
  rawBody: Buffer,
  hmacHeader: string,
): boolean {
  const apiSecret = process.env["CLOUDPAYMENTS_API_SECRET"];
  if (!apiSecret) return false;

  try {
    const computed = createHmac("sha256", apiSecret)
      .update(rawBody)
      .digest("base64");
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

function mapCloudpaymentsStatus(status: string): PaymentStatus | null {
  switch (status) {
    case "Authorized":
      return "authorized";
    case "Completed":
      return "paid";
    case "Cancelled":
      return "voided";
    case "Declined":
      return "failed";
    default:
      return null;
  }
}

export async function processCloudpaymentsWebhook(
  body: unknown,
  rawBody: Buffer,
  hmacHeader: string | undefined,
): Promise<{ ok: boolean; code: number }> {
  if (hmacHeader && !verifyCloudpaymentsHmac(rawBody, hmacHeader)) {
    logger.warn("CloudPayments webhook: invalid HMAC signature");
    return { ok: false, code: 13 };
  }

  const params = body as Record<string, unknown>;
  const transactionId = params["TransactionId"]
    ? String(params["TransactionId"])
    : undefined;
  const status = params["Status"] as string | undefined;

  if (!transactionId) {
    return { ok: true, code: 0 };
  }

  const newStatus = status ? mapCloudpaymentsStatus(status) : null;
  if (!newStatus) {
    logger.info({ status }, "CloudPayments webhook: unhandled status");
    return { ok: true, code: 0 };
  }

  const payment = await findPaymentByProviderIdAndProvider(
    transactionId,
    "cloudpayments",
  );
  if (!payment) {
    logger.info(
      { transactionId },
      "CloudPayments webhook: payment not found in DB",
    );
    return { ok: true, code: 0 };
  }

  const updated = await updatePaymentStatus(
    payment.id,
    newStatus,
    newStatus === "paid" ? new Date() : undefined,
  );

  if (updated) {
    await notifyForStatus(payment.status as PaymentStatus, newStatus, payment);
    logger.info(
      { paymentId: payment.id, from: payment.status, to: newStatus },
      "CloudPayments webhook: payment status updated",
    );
  }

  return { ok: true, code: 0 };
}
