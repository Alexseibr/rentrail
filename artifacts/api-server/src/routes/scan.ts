import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { requireCompanyAccess } from "../middlewares/authorize";
import * as scanService from "../services/scan.service";
import { getBody } from "../lib/request-body";

const router: IRouter = Router();

const resolveSchema = z.object({
  code: z.string().min(1),
});

router.post(
  "/scan/resolve",
  authenticate,
  requireCompanyAccess,
  validate({ body: resolveSchema }),
  async (req, res) => {
    const { code } = getBody<z.infer<typeof resolveSchema>>(req);
    const result = await scanService.resolveScannedCode(
      code,
      req.tenant!.companyId,
    );
    res.json({ data: result });
  },
);

export default router;
