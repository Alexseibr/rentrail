import { db, payments, rentals, clients } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";
import { getGateway, isValidProvider, type PaymentGatewayProvider } from "./payment-gateway";
import { onRentalPaymentHeld, onRentalPaymentCaptured, onRentalPaymentVoided } from "./notification.service";

type PaymentType = typeof payments.$inferSelect.type;
type PaymentStatus = typeof payments.$inferSelect.status;

async function getRentalOrThrow(rentalId: string, companyId: string) {
  const [rental] = await db
    .select()
    .from(rentals)
    .where(and(eq(rentals.id, rentalId), eq(rentals.companyId, companyId)))
    .limit(1);
  if (!rental) throw new NotFoundError("Rental not found");
  return rental;
}

async function getClientInfo(clientId: string) {
  const [client] = await db
    .select({ email: clients.email, phone: clients.phone, fullName: clients.fullName })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return client ?? null;
}

export interface HoldParams {
  provider: string;
  amountKopecks: number;
  currency?: string;
  savedMethodToken?: string;
  returnUrl?: string;
  description?: string;
}

export async function holdDeposit(rentalId: string, companyId: string, params: HoldParams, userId?: string) {
  if (!isValidProvider(params.provider)) {
    throw new AppError(400, `Unknown payment provider: ${params.provider}`, "INVALID_PROVIDER");
  }

  const existing = await db
    .select({ id: payments.id, status: payments.status, type: payments.type })
    .from(payments)
    .where(and(eq(payments.rentalId, rentalId), eq(payments.companyId, companyId)))
    .limit(1);

  const activeHold = existing.find((p) => p.type === "deposit_hold" && p.status === "authorized");
  if (activeHold) {
    throw new AppError(409, "Active deposit hold already exists for this rental", "HOLD_EXISTS");
  }

  const rental = await getRentalOrThrow(rentalId, companyId);
  const clientInfo = await getClientInfo(rental.clientId);
  const currency = params.currency ?? "RUB";

  const gateway = getGateway(params.provider as PaymentGatewayProvider);
  const result = await gateway.createHold({
    amount: params.amountKopecks,
    currency,
    description: params.description ?? `Аренда #${rentalId.slice(0, 8)} — залог`,
    orderId: rentalId,
    customerEmail: clientInfo?.email ?? undefined,
    customerPhone: clientInfo?.phone ?? undefined,
    savedMethodToken: params.savedMethodToken,
    returnUrl: params.returnUrl,
  });

  const [payment] = await db
    .insert(payments)
    .values({
      companyId,
      branchId: rental.branchId,
      clientId: rental.clientId,
      rentalId,
      type: "deposit_hold" as PaymentType,
      status: result.status === "authorized" ? ("authorized" as PaymentStatus) : ("pending" as PaymentStatus),
      amount: String(params.amountKopecks / 100),
      currency,
      provider: params.provider,
      providerPaymentId: result.providerPaymentId,
      metadata: {
        confirmationUrl: result.confirmationUrl,
        savedMethodToken: result.savedMethodToken,
        rawResponse: result.rawResponse,
        requestedByUserId: userId,
      },
    })
    .returning();

  if (result.status === "authorized" || result.status === "paid") {
    await onRentalPaymentHeld(companyId, rental.clientId, payment.id, rentalId);
  }

  return { payment, confirmationUrl: result.confirmationUrl, savedMethodToken: result.savedMethodToken };
}

export interface CaptureParams {
  finalAmountKopecks: number;
  currency?: string;
  description?: string;
}

export async function capturePayment(rentalId: string, companyId: string, params: CaptureParams, userId?: string) {
  const rental = await getRentalOrThrow(rentalId, companyId);

  const [holdPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.rentalId, rentalId),
        eq(payments.companyId, companyId),
        eq(payments.type, "deposit_hold" as PaymentType),
        eq(payments.status, "authorized" as PaymentStatus),
      ),
    )
    .limit(1);

  if (!holdPayment) {
    throw new AppError(404, "No authorized hold found for this rental", "NO_HOLD");
  }

  if (!holdPayment.provider || !holdPayment.providerPaymentId) {
    throw new AppError(500, "Hold payment missing provider data", "MISSING_PROVIDER_DATA");
  }

  if (!isValidProvider(holdPayment.provider)) {
    throw new AppError(500, `Invalid provider stored: ${holdPayment.provider}`, "INVALID_PROVIDER");
  }

  const gateway = getGateway(holdPayment.provider as PaymentGatewayProvider);
  const currency = params.currency ?? holdPayment.currency;
  const result = await gateway.capturePayment({
    providerPaymentId: holdPayment.providerPaymentId,
    amount: params.finalAmountKopecks,
    currency,
  });

  await db
    .update(payments)
    .set({ status: "paid" as PaymentStatus, paidAt: new Date(), updatedAt: new Date() })
    .where(eq(payments.id, holdPayment.id));

  const [capturePayment] = await db
    .insert(payments)
    .values({
      companyId,
      branchId: rental.branchId,
      clientId: rental.clientId,
      rentalId,
      type: "rental_payment" as PaymentType,
      status: result.status === "paid" ? ("paid" as PaymentStatus) : ("pending" as PaymentStatus),
      amount: String(params.finalAmountKopecks / 100),
      currency,
      provider: holdPayment.provider,
      providerPaymentId: result.providerPaymentId,
      paidAt: result.status === "paid" ? new Date() : null,
      metadata: { holdPaymentId: holdPayment.id, requestedByUserId: userId, rawResponse: result.rawResponse },
    })
    .returning();

  await onRentalPaymentCaptured(companyId, rental.clientId, capturePayment.id, rentalId);

  return capturePayment;
}

export async function voidHold(rentalId: string, companyId: string, userId?: string) {
  const rental = await getRentalOrThrow(rentalId, companyId);

  const [holdPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.rentalId, rentalId),
        eq(payments.companyId, companyId),
        eq(payments.type, "deposit_hold" as PaymentType),
        eq(payments.status, "authorized" as PaymentStatus),
      ),
    )
    .limit(1);

  if (!holdPayment) {
    throw new AppError(404, "No authorized hold found for this rental", "NO_HOLD");
  }

  if (!holdPayment.provider || !holdPayment.providerPaymentId) {
    throw new AppError(500, "Hold payment missing provider data", "MISSING_PROVIDER_DATA");
  }

  if (!isValidProvider(holdPayment.provider)) {
    throw new AppError(500, `Invalid provider stored: ${holdPayment.provider}`, "INVALID_PROVIDER");
  }

  const gateway = getGateway(holdPayment.provider as PaymentGatewayProvider);
  await gateway.voidPayment({ providerPaymentId: holdPayment.providerPaymentId });

  await db
    .update(payments)
    .set({ status: "voided" as PaymentStatus, updatedAt: new Date() })
    .where(eq(payments.id, holdPayment.id));

  await onRentalPaymentVoided(companyId, rental.clientId, holdPayment.id, rentalId);
  void userId;

  return holdPayment;
}

export async function getRentalPayments(rentalId: string, companyId: string) {
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.rentalId, rentalId), eq(payments.companyId, companyId)));
}

export async function refreshPaymentStatus(paymentId: string, companyId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.companyId, companyId)))
    .limit(1);

  if (!payment) throw new NotFoundError("Payment not found");
  if (!payment.provider || !payment.providerPaymentId) throw new AppError(400, "Payment has no provider data", "NO_PROVIDER");
  if (!isValidProvider(payment.provider)) throw new AppError(400, `Invalid provider: ${payment.provider}`, "INVALID_PROVIDER");

  const gateway = getGateway(payment.provider as PaymentGatewayProvider);
  const result = await gateway.getPaymentStatus(payment.providerPaymentId);

  const newStatus: PaymentStatus =
    result.status === "authorized" ? "authorized"
    : result.status === "paid" ? "paid"
    : result.status === "voided" ? "voided"
    : result.status === "refunded" ? "refunded"
    : result.status === "failed" ? "failed"
    : (payment.status as PaymentStatus);

  const [updated] = await db
    .update(payments)
    .set({
      status: newStatus,
      paidAt: newStatus === "paid" && !payment.paidAt ? new Date() : payment.paidAt,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId))
    .returning();

  return updated;
}
