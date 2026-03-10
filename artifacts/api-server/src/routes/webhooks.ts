import { Router } from "express";
import {
  processYukassaWebhook,
  processTinkoffWebhook,
  verifyTinkoffToken,
  processCloudpaymentsWebhook,
} from "../services/webhook-payment.service";
import { logger } from "../lib/logger";
import { getBody } from "../lib/request-body";

const router = Router();

router.post("/webhooks/yukassa", async (req, res) => {
  try {
    const result = await processYukassaWebhook(getBody<unknown>(req));
    return res.json(result);
  } catch (err: unknown) {
    logger.error({ err }, "YuKassa webhook error");
    return res.status(500).json({ ok: false });
  }
});

router.post("/webhooks/tinkoff", async (req, res) => {
  try {
    const secretKey = process.env["TINKOFF_SECRET_KEY"];
    if (
      secretKey &&
      !verifyTinkoffToken(getBody<Record<string, unknown>>(req), secretKey)
    ) {
      logger.warn("Tinkoff webhook: invalid token, rejecting");
      return res.status(400).json({ ok: false });
    }
    const result = await processTinkoffWebhook(getBody<unknown>(req));
    return res.json(result);
  } catch (err: unknown) {
    logger.error({ err }, "Tinkoff webhook error");
    return res.status(500).json({ ok: false });
  }
});

router.post("/webhooks/cloudpayments", async (req, res) => {
  try {
    const hmacHeader = req.headers["content-hmac"] as string | undefined;
    const rawBody: Buffer =
      req.rawBody ?? Buffer.from(JSON.stringify(getBody<unknown>(req)));
    const result = await processCloudpaymentsWebhook(
      getBody<unknown>(req),
      rawBody,
      hmacHeader,
    );
    return res.json({ code: result.code });
  } catch (err: unknown) {
    logger.error({ err }, "CloudPayments webhook error");
    return res.status(500).json({ code: 13 });
  }
});

export default router;
