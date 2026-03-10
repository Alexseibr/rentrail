import { AppError } from "../../lib/errors";
import type {
  PaymentGateway,
  CreateHoldParams,
  CaptureParams,
  VoidParams,
  RefundParams,
  GatewayPaymentResult,
} from "./types";

const BASE_URL = "https://api.cloudpayments.ru";

function getCredentials() {
  const publicId = process.env["CLOUDPAYMENTS_PUBLIC_ID"];
  const apiSecret = process.env["CLOUDPAYMENTS_API_SECRET"];
  if (!publicId || !apiSecret) {
    throw new AppError(
      500,
      "CloudPayments credentials not configured (CLOUDPAYMENTS_PUBLIC_ID / CLOUDPAYMENTS_API_SECRET)",
      "GATEWAY_NOT_CONFIGURED",
    );
  }
  return { publicId, apiSecret };
}

function basicAuth(publicId: string, apiSecret: string): string {
  return "Basic " + Buffer.from(`${publicId}:${apiSecret}`).toString("base64");
}

async function cpRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const { publicId, apiSecret } = getCredentials();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(publicId, apiSecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!data.Success) {
    const msg =
      data.Message ??
      (data.Model as Record<string, unknown>)?.ReasonCode ??
      "unknown";
    throw new AppError(502, `CloudPayments error: ${msg}`, "GATEWAY_ERROR");
  }
  return (data.Model as unknown) ?? data;
}

function mapStatus(code: number): GatewayPaymentResult["status"] {
  switch (code) {
    case 1:
      return "authorized";
    case 3:
      return "paid";
    case 4:
      return "voided";
    case 5:
      return "refunded";
    case 6:
      return "failed";
    default:
      return "pending";
  }
}

export const cloudpaymentsGateway: PaymentGateway = {
  provider: "cloudpayments",

  async createHold(params: CreateHoldParams): Promise<GatewayPaymentResult> {
    const body: Record<string, unknown> = {
      Amount: params.amount / 100,
      Currency: params.currency,
      InvoiceId: params.orderId,
      Description: params.description,
      JsonData: params.metadata ? JSON.stringify(params.metadata) : undefined,
    };

    if (params.savedMethodToken) {
      body.Token = params.savedMethodToken;
      if (params.customerEmail) body.Email = params.customerEmail;
      const model = (await cpRequest("/payments/auth", body)) as Record<
        string,
        unknown
      >;
      return {
        providerPaymentId: String(model.TransactionId),
        status: mapStatus(Number(model.Status)),
        savedMethodToken: model.Token as string | undefined,
        rawResponse: model,
      };
    }

    throw new AppError(
      400,
      "CloudPayments requires saved card token for server-side hold. Use widget to collect card first.",
      "TOKEN_REQUIRED",
    );
  },

  async capturePayment(params: CaptureParams): Promise<GatewayPaymentResult> {
    const model = (await cpRequest("/payments/confirm", {
      TransactionId: Number(params.providerPaymentId),
      Amount: params.amount / 100,
    })) as Record<string, unknown>;
    return {
      providerPaymentId: params.providerPaymentId,
      status: "paid",
      rawResponse: model,
    };
  },

  async voidPayment(params: VoidParams): Promise<GatewayPaymentResult> {
    const model = (await cpRequest("/payments/void", {
      TransactionId: Number(params.providerPaymentId),
    })) as Record<string, unknown>;
    return {
      providerPaymentId: params.providerPaymentId,
      status: "voided",
      rawResponse: model,
    };
  },

  async refundPayment(params: RefundParams): Promise<GatewayPaymentResult> {
    const model = (await cpRequest("/payments/refund", {
      TransactionId: Number(params.providerPaymentId),
      Amount: params.amount / 100,
    })) as Record<string, unknown>;
    return {
      providerPaymentId: params.providerPaymentId,
      status: "refunded",
      rawResponse: model,
    };
  },

  async getPaymentStatus(
    providerPaymentId: string,
  ): Promise<GatewayPaymentResult> {
    const model = (await cpRequest("/payments/get", {
      TransactionId: Number(providerPaymentId),
    })) as Record<string, unknown>;
    return {
      providerPaymentId: String(model.TransactionId),
      status: mapStatus(Number(model.Status)),
      rawResponse: model,
    };
  },
};
