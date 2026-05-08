import { Router } from "express";
import {
  processYukassaWebhook,
  processTinkoffWebhook,
  verifyTinkoffToken,
  processCloudpaymentsWebhook,
} from "../services/webhook-payment.service";
import { logger } from "../lib/logger";

const router = Router();

router.post("/webhooks/yukassa", async (req, res) => {
  try {
    const result = await processYukassaWebhook(req.body);
    return res.json(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error({ err }, "YuKassa webhook error");
    return res.status(500).json({ ok: false });
  }
});

router.post("/webhooks/tinkoff", async (req, res) => {
  try {
    const secretKey = process.env["TINKOFF_SECRET_KEY"];
    if (
      secretKey &&
      !verifyTinkoffToken(req.body as Record<string, unknown>, secretKey)
    ) {
      logger.warn("Tinkoff webhook: invalid token, rejecting");
      return res.status(400).json({ ok: false });
    }
    const result = await processTinkoffWebhook(req.body);
    return res.json(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error({ err }, "Tinkoff webhook error");
    return res.status(500).json({ ok: false });
  }
});

router.post("/webhooks/cloudpayments", async (req, res) => {
  try {
    const hmacHeader = req.headers["content-hmac"] as string | undefined;
    const rawBody: Buffer =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const result = await processCloudpaymentsWebhook(
      req.body,
      rawBody,
      hmacHeader,
    );
    return res.json({ code: result.code });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error({ err }, "CloudPayments webhook error");
    return res.status(500).json({ code: 13 });
  }
});

export default router;
