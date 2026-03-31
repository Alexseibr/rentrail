import {
  db,
  saasPlans,
  saasSubscriptions,
  saasInvoices,
  saasPayments,
  companies,
} from "@workspace/db";
import { eq, and, desc, count, sql, ilike, or, gte, lte } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

type SubscriptionStatus = typeof saasSubscriptions.$inferSelect.status;
type InvoiceStatus = typeof saasInvoices.$inferSelect.status;

export async function listPlans(includeInactive = false) {
  const conditions = includeInactive ? undefined : eq(saasPlans.isActive, true);
  return db.select().from(saasPlans).where(conditions).orderBy(saasPlans.price);
}

export async function getPlan(planId: string) {
  const [plan] = await db.select().from(saasPlans).where(eq(saasPlans.id, planId)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");
  return plan;
}

export async function getPlanByCode(code: string) {
  const [plan] = await db.select().from(saasPlans).where(eq(saasPlans.code, code)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");
  return plan;
}

export async function createPlan(input: {
  name: string;
  code: string;
  description?: string;
  price: number;
  currency?: string;
  billingInterval?: "monthly" | "quarterly" | "yearly";
  limits?: Record<string, number>;
  enabledModules?: string[];
  whiteLabelAvailable?: boolean;
  supportTier?: string;
  maxBranches?: number;
  maxStations?: number;
  maxAssets?: number;
  maxUsers?: number;
}) {
  const existing = await db.select({ id: saasPlans.id }).from(saasPlans).where(eq(saasPlans.code, input.code)).limit(1);
  if (existing.length > 0) {
    throw new AppError(409, `Plan with code '${input.code}' already exists`, "PLAN_CODE_CONFLICT");
  }

  const [plan] = await db
    .insert(saasPlans)
    .values({
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      price: input.price,
      currency: input.currency ?? "USD",
      billingInterval: input.billingInterval ?? "monthly",
      limits: input.limits ?? {},
      enabledModules: input.enabledModules ?? [],
      whiteLabelAvailable: input.whiteLabelAvailable ?? false,
      supportTier: input.supportTier ?? "standard",
      maxBranches: input.maxBranches ?? -1,
      maxStations: input.maxStations ?? -1,
      maxAssets: input.maxAssets ?? -1,
      maxUsers: input.maxUsers ?? -1,
    })
    .returning();

  return plan;
}

export async function updatePlan(planId: string, input: Partial<{
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingInterval: "monthly" | "quarterly" | "yearly";
  limits: Record<string, number>;
  enabledModules: string[];
  whiteLabelAvailable: boolean;
  supportTier: string;
  maxBranches: number;
  maxStations: number;
  maxAssets: number;
  maxUsers: number;
  isActive: boolean;
}>) {
  const existing = await getPlan(planId);

  const [updated] = await db
    .update(saasPlans)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(saasPlans.id, planId))
    .returning();

  return { updated, previous: existing };
}

export interface SubscriptionListOptions {
  companyId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function listSubscriptions(opts: SubscriptionListOptions) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (opts.companyId) conditions.push(eq(saasSubscriptions.companyId, opts.companyId));
  if (opts.status) conditions.push(eq(saasSubscriptions.status, opts.status as SubscriptionStatus));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(saasSubscriptions).where(where);
  const total = totalResult?.count ?? 0;

  const rows = await db
    .select({
      subscription: saasSubscriptions,
      planName: saasPlans.name,
      planCode: saasPlans.code,
      companyName: companies.name,
    })
    .from(saasSubscriptions)
    .innerJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .innerJoin(companies, eq(companies.id, saasSubscriptions.companyId))
    .where(where)
    .orderBy(desc(saasSubscriptions.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((r) => ({
      ...r.subscription,
      planName: r.planName,
      planCode: r.planCode,
      companyName: r.companyName,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getSubscriptionDetail(subscriptionId: string) {
  const rows = await db
    .select({
      subscription: saasSubscriptions,
      plan: saasPlans,
      companyName: companies.name,
    })
    .from(saasSubscriptions)
    .innerJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .innerJoin(companies, eq(companies.id, saasSubscriptions.companyId))
    .where(eq(saasSubscriptions.id, subscriptionId))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError("Subscription not found");

  const r = rows[0];
  return {
    ...r.subscription,
    plan: r.plan,
    companyName: r.companyName,
  };
}

export async function updateSubscription(subscriptionId: string, input: Partial<{
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  notes: string | null;
}>) {
  await getSubscriptionDetail(subscriptionId);

  const [updated] = await db
    .update(saasSubscriptions)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(saasSubscriptions.id, subscriptionId))
    .returning();

  return updated;
}

const SUBSCRIPTION_TRANSITIONS: Record<string, string[]> = {
  trial: ["active", "canceled"],
  active: ["past_due", "canceled"],
  past_due: ["active", "canceled"],
  canceled: [],
};

export async function changeSubscriptionStatus(
  subscriptionId: string,
  action: "activate" | "mark_past_due" | "cancel",
  reason?: string,
) {
  const detail = await getSubscriptionDetail(subscriptionId);
  const targetStatus: SubscriptionStatus =
    action === "activate" ? "active" :
    action === "mark_past_due" ? "past_due" :
    "canceled";

  const allowed = SUBSCRIPTION_TRANSITIONS[detail.status];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new AppError(
      422,
      `Cannot transition subscription from '${detail.status}' to '${targetStatus}'`,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const updates: Record<string, unknown> = {
    status: targetStatus,
    updatedAt: new Date(),
  };

  if (action === "cancel") {
    updates.canceledAt = new Date();
    updates.cancelReason = reason ?? null;
  }

  const [updated] = await db
    .update(saasSubscriptions)
    .set(updates)
    .where(eq(saasSubscriptions.id, subscriptionId))
    .returning();

  return { updated, previousStatus: detail.status };
}

export async function createSubscriptionForCompany(
  companyId: string,
  planId: string,
  opts?: { trialEndsAt?: Date; currentPeriodStart?: Date; currentPeriodEnd?: Date; status?: SubscriptionStatus },
) {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) throw new NotFoundError("Company not found");

  const plan = await getPlan(planId);
  if (!plan.isActive) {
    throw new AppError(422, "Cannot assign an inactive plan", "PLAN_INACTIVE");
  }

  return db.transaction(async (tx) => {
    await tx
      .update(saasSubscriptions)
      .set({ status: "canceled", canceledAt: new Date(), cancelReason: "Superseded by new plan", updatedAt: new Date() })
      .where(
        and(
          eq(saasSubscriptions.companyId, companyId),
          sql`${saasSubscriptions.status} IN ('trial', 'active', 'past_due')`,
        ),
      );

    const [subscription] = await tx
      .insert(saasSubscriptions)
      .values({
        companyId,
        planId,
        status: opts?.status ?? "trial",
        trialEndsAt: opts?.trialEndsAt ?? null,
        currentPeriodStart: opts?.currentPeriodStart ?? new Date(),
        currentPeriodEnd: opts?.currentPeriodEnd ?? null,
      })
      .returning();

    await tx
      .update(companies)
      .set({ plan: plan.code, updatedAt: new Date() })
      .where(eq(companies.id, companyId));

    return subscription;
  });
}

export interface InvoiceListOptions {
  companyId?: string;
  status?: string;
  subscriptionId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function listInvoices(opts: InvoiceListOptions) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (opts.companyId) conditions.push(eq(saasInvoices.companyId, opts.companyId));
  if (opts.status) conditions.push(eq(saasInvoices.status, opts.status as InvoiceStatus));
  if (opts.subscriptionId) conditions.push(eq(saasInvoices.subscriptionId, opts.subscriptionId));
  if (opts.from) conditions.push(gte(saasInvoices.createdAt, opts.from));
  if (opts.to) conditions.push(lte(saasInvoices.createdAt, opts.to));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(saasInvoices).where(where);
  const total = totalResult?.count ?? 0;

  const rows = await db
    .select({
      invoice: saasInvoices,
      companyName: companies.name,
    })
    .from(saasInvoices)
    .innerJoin(companies, eq(companies.id, saasInvoices.companyId))
    .where(where)
    .orderBy(desc(saasInvoices.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((r) => ({ ...r.invoice, companyName: r.companyName })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getInvoiceDetail(invoiceId: string) {
  const rows = await db
    .select({
      invoice: saasInvoices,
      companyName: companies.name,
    })
    .from(saasInvoices)
    .innerJoin(companies, eq(companies.id, saasInvoices.companyId))
    .where(eq(saasInvoices.id, invoiceId))
    .limit(1);

  if (rows.length === 0) throw new NotFoundError("Invoice not found");

  const payments = await db
    .select()
    .from(saasPayments)
    .where(eq(saasPayments.invoiceId, invoiceId))
    .orderBy(desc(saasPayments.paidAt));

  return { ...rows[0].invoice, companyName: rows[0].companyName, payments };
}

export async function createInvoice(input: {
  subscriptionId?: string;
  companyId: string;
  amount: number;
  currency?: string;
  dueDate?: Date;
  notes?: string;
}) {
  const [company] = await db.select().from(companies).where(eq(companies.id, input.companyId)).limit(1);
  if (!company) throw new NotFoundError("Company not found");

  if (input.subscriptionId) {
    const [sub] = await db
      .select()
      .from(saasSubscriptions)
      .where(
        and(
          eq(saasSubscriptions.id, input.subscriptionId),
          eq(saasSubscriptions.companyId, input.companyId),
        ),
      )
      .limit(1);
    if (!sub) throw new AppError(422, "Subscription not found or does not belong to this company", "SUBSCRIPTION_COMPANY_MISMATCH");
  }

  const [invoice] = await db
    .insert(saasInvoices)
    .values({
      subscriptionId: input.subscriptionId ?? null,
      companyId: input.companyId,
      amount: input.amount,
      currency: input.currency ?? "USD",
      status: "draft",
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  return invoice;
}

export async function markInvoiceIssued(invoiceId: string) {
  const detail = await getInvoiceDetail(invoiceId);
  if (detail.status !== "draft") {
    throw new AppError(422, `Cannot issue invoice in status '${detail.status}'`, "INVALID_STATUS_TRANSITION");
  }

  const [updated] = await db
    .update(saasInvoices)
    .set({ status: "issued", issuedAt: new Date(), updatedAt: new Date() })
    .where(eq(saasInvoices.id, invoiceId))
    .returning();

  return { updated, previousStatus: detail.status };
}

export async function markInvoicePaid(invoiceId: string, payment?: { amount: number; method: string; reference?: string }) {
  const detail = await getInvoiceDetail(invoiceId);
  if (detail.status !== "issued" && detail.status !== "overdue") {
    throw new AppError(422, `Cannot mark invoice as paid from status '${detail.status}'`, "INVALID_STATUS_TRANSITION");
  }

  if (payment && payment.amount !== detail.amount) {
    throw new AppError(422, `Payment amount (${payment.amount}) must match invoice amount (${detail.amount})`, "PAYMENT_AMOUNT_MISMATCH");
  }

  const updated = await db.transaction(async (tx) => {
    const [inv] = await tx
      .update(saasInvoices)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(saasInvoices.id, invoiceId))
      .returning();

    if (payment) {
      await tx.insert(saasPayments).values({
        invoiceId,
        companyId: detail.companyId,
        amount: payment.amount,
        currency: detail.currency,
        method: payment.method,
        reference: payment.reference ?? null,
      });
    }

    return inv;
  });

  return { updated, previousStatus: detail.status };
}

export async function voidInvoice(invoiceId: string) {
  const detail = await getInvoiceDetail(invoiceId);
  if (detail.status === "paid" || detail.status === "void") {
    throw new AppError(422, `Cannot void invoice in status '${detail.status}'`, "INVALID_STATUS_TRANSITION");
  }

  const [updated] = await db
    .update(saasInvoices)
    .set({ status: "void", voidedAt: new Date(), updatedAt: new Date() })
    .where(eq(saasInvoices.id, invoiceId))
    .returning();

  return { updated, previousStatus: detail.status };
}

export interface PaymentListOptions {
  companyId?: string;
  invoiceId?: string;
  page?: number;
  limit?: number;
}

export async function listPayments(opts: PaymentListOptions) {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (opts.companyId) conditions.push(eq(saasPayments.companyId, opts.companyId));
  if (opts.invoiceId) conditions.push(eq(saasPayments.invoiceId, opts.invoiceId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(saasPayments).where(where);
  const total = totalResult?.count ?? 0;

  const rows = await db
    .select()
    .from(saasPayments)
    .where(where)
    .orderBy(desc(saasPayments.paidAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getPlanLimitsForCompany(companyId: string) {
  const sub = await db
    .select({
      subscription: saasSubscriptions,
      plan: saasPlans,
    })
    .from(saasSubscriptions)
    .innerJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(
      and(
        eq(saasSubscriptions.companyId, companyId),
        sql`${saasSubscriptions.status} IN ('trial', 'active')`,
      ),
    )
    .orderBy(desc(saasSubscriptions.createdAt))
    .limit(1);

  if (sub.length === 0) {
    return {
      plan: null,
      limits: { branches: -1, stations: -1, assets: -1, users: -1, rentals: -1 },
    };
  }

  const plan = sub[0].plan;
  return {
    plan: { id: plan.id, name: plan.name, code: plan.code },
    limits: {
      branches: plan.maxBranches,
      stations: plan.maxStations,
      assets: plan.maxAssets,
      users: plan.maxUsers,
      ...plan.limits,
    },
  };
}
