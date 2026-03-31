import { Router } from "express";
import { z } from "zod/v4";
import { authenticate } from "../middlewares/authenticate";
import { requirePlatformRole } from "../middlewares/platform-authorize";
import { validate } from "../middlewares/validate";
import { createPlatformAuditLog } from "../lib/platform-audit";
import * as billingService from "../services/billing.service";

const router = Router();

const idParams = z.object({ id: z.string().uuid() });

const billingRoles = requirePlatformRole("superAdmin", "platformAdmin", "platformFinance");

const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  price: z.number().int().min(0),
  currency: z.string().max(10).optional(),
  billingInterval: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  limits: z.record(z.string(), z.number()).optional(),
  enabledModules: z.array(z.string()).optional(),
  whiteLabelAvailable: z.boolean().optional(),
  supportTier: z.string().max(50).optional(),
  maxBranches: z.number().int().optional(),
  maxStations: z.number().int().optional(),
  maxAssets: z.number().int().optional(),
  maxUsers: z.number().int().optional(),
});

const updatePlanSchema = createPlanSchema.partial().omit({ code: true }).extend({
  isActive: z.boolean().optional(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const subscriptionListQuery = listQuery.extend({
  companyId: z.string().uuid().optional(),
  status: z.enum(["trial", "active", "past_due", "canceled"]).optional(),
});

const invoiceListQuery = listQuery.extend({
  companyId: z.string().uuid().optional(),
  subscriptionId: z.string().uuid().optional(),
  status: z.enum(["draft", "issued", "paid", "void", "overdue"]).optional(),
});

const paymentListQuery = listQuery.extend({
  companyId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
});

const subscriptionActionSchema = z.object({
  reason: z.string().optional(),
});

const updateSubscriptionSchema = z.object({
  currentPeriodStart: z.coerce.date().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  trialEndsAt: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const createInvoiceSchema = z.object({
  subscriptionId: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  amount: z.number().int().min(0),
  currency: z.string().max(10).optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const markPaidSchema = z.object({
  amount: z.number().int().min(0),
  method: z.string().min(1).max(50),
  reference: z.string().max(255).optional(),
});

const setPlanSchema = z.object({
  planId: z.string().uuid(),
  trialEndsAt: z.coerce.date().optional(),
  currentPeriodStart: z.coerce.date().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
});

const planListQuery = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
});

router.get(
  "/platform/billing/plans",
  authenticate,
  billingRoles,
  validate({ query: planListQuery }),
  async (req, res) => {
    await createPlatformAuditLog(req, { action: "billing.plan.list", entityType: "saas_plan" });
    const plans = await billingService.listPlans(req.query.includeInactive === "true");
    res.json({ data: plans });
  },
);

router.post(
  "/platform/billing/plans",
  authenticate,
  billingRoles,
  validate({ body: createPlanSchema }),
  async (req, res) => {
    const plan = await billingService.createPlan(req.body);
    await createPlatformAuditLog(req, {
      action: "billing.plan.create",
      entityType: "saas_plan",
      entityId: plan.id,
      after: plan,
    });
    res.status(201).json({ data: plan });
  },
);

router.patch(
  "/platform/billing/plans/:id",
  authenticate,
  billingRoles,
  validate({ params: idParams, body: updatePlanSchema }),
  async (req, res) => {
    const { updated, previous } = await billingService.updatePlan(req.params.id, req.body);
    await createPlatformAuditLog(req, {
      action: "billing.plan.update",
      entityType: "saas_plan",
      entityId: updated.id,
      before: previous,
      after: updated,
    });
    res.json({ data: updated });
  },
);

router.get(
  "/platform/billing/subscriptions",
  authenticate,
  billingRoles,
  validate({ query: subscriptionListQuery }),
  async (req, res) => {
    await createPlatformAuditLog(req, { action: "billing.subscription.list", entityType: "saas_subscription" });
    const result = await billingService.listSubscriptions({
      companyId: req.query.companyId as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ data: result });
  },
);

router.get(
  "/platform/billing/subscriptions/:id",
  authenticate,
  billingRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const detail = await billingService.getSubscriptionDetail(req.params.id);
    await createPlatformAuditLog(req, {
      action: "billing.subscription.view",
      entityType: "saas_subscription",
      entityId: req.params.id,
      targetCompanyId: detail.companyId,
    });
    res.json({ data: detail });
  },
);

router.patch(
  "/platform/billing/subscriptions/:id",
  authenticate,
  billingRoles,
  validate({ params: idParams, body: updateSubscriptionSchema }),
  async (req, res) => {
    const updated = await billingService.updateSubscription(req.params.id, req.body);
    await createPlatformAuditLog(req, {
      action: "billing.subscription.update",
      entityType: "saas_subscription",
      entityId: updated.id,
      targetCompanyId: updated.companyId,
      after: updated,
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/billing/subscriptions/:id/activate",
  authenticate,
  billingRoles,
  validate({ params: idParams, body: subscriptionActionSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await billingService.changeSubscriptionStatus(req.params.id, "activate", req.body.reason);
    await createPlatformAuditLog(req, {
      action: "billing.subscription.activate",
      entityType: "saas_subscription",
      entityId: updated.id,
      targetCompanyId: updated.companyId,
      before: { status: previousStatus },
      after: { status: updated.status },
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/billing/subscriptions/:id/past-due",
  authenticate,
  billingRoles,
  validate({ params: idParams, body: subscriptionActionSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await billingService.changeSubscriptionStatus(req.params.id, "mark_past_due", req.body.reason);
    await createPlatformAuditLog(req, {
      action: "billing.subscription.past_due",
      entityType: "saas_subscription",
      entityId: updated.id,
      targetCompanyId: updated.companyId,
      before: { status: previousStatus },
      after: { status: updated.status },
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/billing/subscriptions/:id/cancel",
  authenticate,
  billingRoles,
  validate({ params: idParams, body: subscriptionActionSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await billingService.changeSubscriptionStatus(req.params.id, "cancel", req.body.reason);
    await createPlatformAuditLog(req, {
      action: "billing.subscription.cancel",
      entityType: "saas_subscription",
      entityId: updated.id,
      targetCompanyId: updated.companyId,
      before: { status: previousStatus },
      after: { status: updated.status },
      reasonText: req.body.reason ?? null,
    });
    res.json({ data: updated });
  },
);

router.get(
  "/platform/billing/invoices",
  authenticate,
  billingRoles,
  validate({ query: invoiceListQuery }),
  async (req, res) => {
    await createPlatformAuditLog(req, { action: "billing.invoice.list", entityType: "saas_invoice" });
    const result = await billingService.listInvoices({
      companyId: req.query.companyId as string | undefined,
      status: req.query.status as string | undefined,
      subscriptionId: req.query.subscriptionId as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ data: result });
  },
);

router.get(
  "/platform/billing/invoices/:id",
  authenticate,
  billingRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const detail = await billingService.getInvoiceDetail(req.params.id);
    await createPlatformAuditLog(req, {
      action: "billing.invoice.view",
      entityType: "saas_invoice",
      entityId: req.params.id,
      targetCompanyId: detail.companyId,
    });
    res.json({ data: detail });
  },
);

router.post(
  "/platform/billing/invoices",
  authenticate,
  billingRoles,
  validate({ body: createInvoiceSchema }),
  async (req, res) => {
    const invoice = await billingService.createInvoice(req.body);
    await createPlatformAuditLog(req, {
      action: "billing.invoice.create",
      entityType: "saas_invoice",
      entityId: invoice.id,
      targetCompanyId: invoice.companyId,
      after: invoice,
    });
    res.status(201).json({ data: invoice });
  },
);

router.post(
  "/platform/billing/invoices/:id/issue",
  authenticate,
  billingRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const { updated, previousStatus } = await billingService.markInvoiceIssued(req.params.id);
    await createPlatformAuditLog(req, {
      action: "billing.invoice.issue",
      entityType: "saas_invoice",
      entityId: updated.id,
      targetCompanyId: updated.companyId,
      before: { status: previousStatus },
      after: { status: updated.status },
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/billing/invoices/:id/mark-paid",
  authenticate,
  billingRoles,
  validate({ params: idParams, body: markPaidSchema }),
  async (req, res) => {
    const { updated, previousStatus } = await billingService.markInvoicePaid(req.params.id, req.body);
    await createPlatformAuditLog(req, {
      action: "billing.invoice.paid",
      entityType: "saas_invoice",
      entityId: updated.id,
      targetCompanyId: updated.companyId,
      before: { status: previousStatus },
      after: { status: updated.status },
    });
    res.json({ data: updated });
  },
);

router.post(
  "/platform/billing/invoices/:id/void",
  authenticate,
  billingRoles,
  validate({ params: idParams }),
  async (req, res) => {
    const { updated, previousStatus } = await billingService.voidInvoice(req.params.id);
    await createPlatformAuditLog(req, {
      action: "billing.invoice.void",
      entityType: "saas_invoice",
      entityId: updated.id,
      targetCompanyId: updated.companyId,
      before: { status: previousStatus },
      after: { status: updated.status },
    });
    res.json({ data: updated });
  },
);

router.get(
  "/platform/billing/payments",
  authenticate,
  billingRoles,
  validate({ query: paymentListQuery }),
  async (req, res) => {
    await createPlatformAuditLog(req, { action: "billing.payment.list", entityType: "saas_payment" });
    const result = await billingService.listPayments({
      companyId: req.query.companyId as string | undefined,
      invoiceId: req.query.invoiceId as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ data: result });
  },
);

router.post(
  "/platform/companies/:id/set-plan",
  authenticate,
  requirePlatformRole("superAdmin", "platformAdmin"),
  validate({ params: idParams, body: setPlanSchema }),
  async (req, res) => {
    const subscription = await billingService.createSubscriptionForCompany(
      req.params.id,
      req.body.planId,
      {
        trialEndsAt: req.body.trialEndsAt,
        currentPeriodStart: req.body.currentPeriodStart,
        currentPeriodEnd: req.body.currentPeriodEnd,
      },
    );
    await createPlatformAuditLog(req, {
      action: "billing.company.set_plan",
      entityType: "saas_subscription",
      entityId: subscription.id,
      targetCompanyId: req.params.id,
      after: subscription,
    });
    res.status(201).json({ data: subscription });
  },
);

export default router;
