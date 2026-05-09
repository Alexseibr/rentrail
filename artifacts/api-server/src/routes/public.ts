import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import * as publicService from "../services/public.service";
import * as inquiryService from "../services/inquiry.service";
import * as b2bRequestService from "../services/b2b-request.service";
import * as notificationService from "../services/notification.service";
import { resolvePublicCompany } from "../services/public.service";
import { AppError } from "../lib/errors";

const router: IRouter = Router();

const slugParams = z.object({ slug: z.string().min(1).max(100) });

const publicInquirySchema = z.object({
  branchId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  fullName: z.string().min(1).max(255),
  phone: z.string().min(3).max(50),
  email: z.string().email().max(255).optional(),
  assetType: z.enum(["bike", "ebike", "scooter", "escooter"]).optional(),
  preferredAssetId: z.string().uuid().optional(),
  requestedStartAt: z.iso.datetime({ offset: true }).optional(),
  requestedEndAt: z.iso.datetime({ offset: true }).optional(),
  message: z.string().max(2000).optional(),
});

const publicB2BSchema = z.object({
  companyName: z.string().min(1).max(255),
  contactPerson: z.string().min(1).max(255),
  phone: z.string().min(3).max(50),
  email: z.string().email().max(255).optional(),
  city: z.string().max(100).optional(),
  requestedFleetSize: z.number().int().min(1).max(10000).optional(),
  assetTypes: z
    .array(z.enum(["bike", "ebike", "scooter", "escooter"]))
    .optional(),
  message: z.string().max(5000).optional(),
});

router.get(
  "/public/companies/:slug",
  validate({ params: slugParams }),
  async (req, res) => {
    const data = await publicService.getPublicCompanyPage(
      req.params.slug as string,
    );
    res.json({ data });
  },
);

router.get(
  "/public/companies/:slug/assets",
  validate({ params: slugParams }),
  async (req, res) => {
    const { assetType, branchId, stationId } = req.query as Record<
      string,
      string | undefined
    >;
    const data = await publicService.getPublicAssets(
      req.params.slug as string,
      { assetType, branchId, stationId },
    );
    res.json({ data });
  },
);

router.get(
  "/public/companies/:slug/stations",
  validate({ params: slugParams }),
  async (req, res) => {
    const data = await publicService.getPublicStations(
      req.params.slug as string,
    );
    res.json({ data });
  },
);

router.post(
  "/public/companies/:slug/inquiries",
  validate({ params: slugParams, body: publicInquirySchema }),
  async (req, res) => {
    const { company, branding } = await resolvePublicCompany(
      req.params.slug as string,
    );

    if (!branding.publicShowInquiryForm) {
      throw new AppError(
        403,
        "Inquiry form is not available for this company",
        "INQUIRY_DISABLED",
      );
    }

    const { requestedStartAt, requestedEndAt, ...rest } = req.body as z.infer<
      typeof publicInquirySchema
    >;
    const inquiry = await inquiryService.createPublicInquiry(company.id, {
      ...rest,
      requestedStartAt: requestedStartAt
        ? new Date(requestedStartAt)
        : undefined,
      requestedEndAt: requestedEndAt ? new Date(requestedEndAt) : undefined,
    });

    await notificationService
      .onInquiryCreated(company.id, inquiry.id, inquiry.fullName)
      .catch(() => {});

    res.status(201).json({
      data: {
        id: inquiry.id,
        status: inquiry.status,
        message: "Your inquiry has been received. We will contact you shortly.",
      },
    });
  },
);

router.post(
  "/public/companies/:slug/b2b-request",
  validate({ params: slugParams, body: publicB2BSchema }),
  async (req, res) => {
    const { company, branding } = await resolvePublicCompany(
      req.params.slug as string,
    );

    if (!branding.publicShowB2BForm) {
      throw new AppError(
        403,
        "B2B request form is not available for this company",
        "B2B_DISABLED",
      );
    }

    const request = await b2bRequestService.createPublicB2BRequest(
      company.id,
      req.body as z.infer<typeof publicB2BSchema>,
    );

    await notificationService
      .onB2BRequestCreated(company.id, request.id, request.companyName)
      .catch(() => {});

    res.status(201).json({
      data: {
        id: request.id,
        status: request.status,
        message:
          "Your B2B request has been received. Our team will contact you soon.",
      },
    });
  },
);

export default router;
