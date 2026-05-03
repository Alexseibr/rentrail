import { AppError } from "../../lib/errors";
import type { PaymentGateway, CreateHoldParams, CaptureParams, VoidParams, RefundParams, GatewayPaymentResult } from "./types";

const BASE_URL = "https://api.yookassa.ru/v3";

function getCredentials() {
  const shopId = process.env["YUKASSA_SHOP_ID"];
  const secretKey = process.env["YUKASSA_SECRET_KEY"];
  if (!shopId || !secretKey) {
    throw new AppError(500, "ЮKassa credentials not configured (YUKASSA_SHOP_ID / YUKASSA_SECRET_KEY)", "GATEWAY_NOT_CONFIGURED");
  }
  return { shopId, secretKey };
}

function basicAuth(shopId: string, secretKey: string): string {
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

function idempotenceKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mapStatus(ykStatus: string): GatewayPaymentResult["status"] {
  switch (ykStatus) {
    case "pending": return "pending";
    case "waiting_for_capture": return "authorized";
    case "succeeded": return "paid";
    case "canceled": return "voided";
    default: return "pending";
  }
}

async function ykRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const { shopId, secretKey } = getCredentials();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: basicAuth(shopId, secretKey),
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const err = data as { description?: string; code?: string };
    throw new AppError(502, `ЮKassa error: ${err.description ?? "unknown"}`, err.code ?? "GATEWAY_ERROR");
  }
  return data;
}

export const yukassaGateway: PaymentGateway = {
  provider: "yukassa",

  async createHold(params: CreateHoldParams): Promise<GatewayPaymentResult> {
    const body: Record<string, unknown> = {
      amount: { value: (params.amount / 100).toFixed(2), currency: params.currency },
      capture: false,
      description: params.description,
      metadata: { orderId: params.orderId, ...params.metadata },
    };

    if (params.savedMethodToken) {
      body.payment_method_id = params.savedMethodToken;
    } else {
      body.confirmation = {
        type: "redirect",
        return_url: params.returnUrl ?? process.env["YUKASSA_RETURN_URL"] ?? "https://example.com",
      };
    }

    if (params.customerEmail || params.customerPhone) {
      body.receipt = {
        customer: {
          ...(params.customerEmail ? { email: params.customerEmail } : {}),
          ...(params.customerPhone ? { phone: params.customerPhone } : {}),
        },
        items: [
          {
            description: params.description,
            quantity: "1.00",
            amount: { value: (params.amount / 100).toFixed(2), currency: params.currency },
            vat_code: 1,
          },
        ],
      };
    }

    const data = (await ykRequest("POST", "/payments", body)) as Record<string, unknown>;
    const confirmation = data.confirmation as Record<string, string> | undefined;
    const paymentMethod = data.payment_method as Record<string, unknown> | undefined;
    const paymentMethodId = paymentMethod?.saved ? (paymentMethod?.id as string | undefined) : undefined;

    return {
      providerPaymentId: data.id as string,
      status: mapStatus(data.status as string),
      confirmationUrl: confirmation?.confirmation_url,
      savedMethodToken: paymentMethodId,
      rawResponse: data,
    };
  },

  async capturePayment(params: CaptureParams): Promise<GatewayPaymentResult> {
    const body = {
      amount: { value: (params.amount / 100).toFixed(2), currency: params.currency },
    };
    const data = (await ykRequest("POST", `/payments/${params.providerPaymentId}/capture`, body)) as Record<string, unknown>;
    return {
      providerPaymentId: data.id as string,
      status: mapStatus(data.status as string),
      rawResponse: data,
    };
  },

  async voidPayment(params: VoidParams): Promise<GatewayPaymentResult> {
    const data = (await ykRequest("POST", `/payments/${params.providerPaymentId}/cancel`, {})) as Record<string, unknown>;
    return {
      providerPaymentId: data.id as string,
      status: mapStatus(data.status as string),
      rawResponse: data,
    };
  },

  async refundPayment(params: RefundParams): Promise<GatewayPaymentResult> {
    const body = {
      payment_id: params.providerPaymentId,
      amount: { value: (params.amount / 100).toFixed(2), currency: params.currency },
      description: params.reason,
    };
    const data = (await ykRequest("POST", "/refunds", body)) as Record<string, unknown>;
    return {
      providerPaymentId: params.providerPaymentId,
      status: mapStatus(data.status as string),
      rawResponse: data,
    };
  },

  async getPaymentStatus(providerPaymentId: string): Promise<GatewayPaymentResult> {
    const data = (await ykRequest("GET", `/payments/${providerPaymentId}`)) as Record<string, unknown>;
    return {
      providerPaymentId: data.id as string,
      status: mapStatus(data.status as string),
      rawResponse: data,
    };
  },
};
