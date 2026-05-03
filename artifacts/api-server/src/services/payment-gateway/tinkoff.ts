import { createHash } from "crypto";
import { AppError } from "../../lib/errors";
import type { PaymentGateway, CreateHoldParams, CaptureParams, VoidParams, RefundParams, GatewayPaymentResult } from "./types";

const BASE_URL = "https://securepay.tinkoff.ru/v2";

function getCredentials() {
  const terminalKey = process.env["TINKOFF_TERMINAL_KEY"];
  const secretKey = process.env["TINKOFF_SECRET_KEY"];
  if (!terminalKey || !secretKey) {
    throw new AppError(500, "Тинькофф credentials not configured (TINKOFF_TERMINAL_KEY / TINKOFF_SECRET_KEY)", "GATEWAY_NOT_CONFIGURED");
  }
  return { terminalKey, secretKey };
}

function buildToken(params: Record<string, string | number | boolean | undefined>, secretKey: string): string {
  const kvPairs = Object.entries(params)
    .filter(([k, v]) => k !== "Token" && k !== "Receipt" && k !== "DATA" && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  kvPairs.push(["Password", secretKey]);
  kvPairs.sort(([a], [b]) => a.localeCompare(b));

  const str = kvPairs.map(([, v]) => String(v)).join("");
  return createHash("sha256").update(str).digest("hex");
}

async function tinkoffRequest(action: string, body: Record<string, unknown>): Promise<unknown> {
  const { terminalKey, secretKey } = getCredentials();
  const params = { ...body, TerminalKey: terminalKey };

  const flat: Record<string, string | number | boolean | undefined> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      flat[k] = v;
    }
  }
  const token = buildToken(flat, secretKey);

  const res = await fetch(`${BASE_URL}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, Token: token }),
  });

  const data = await res.json();
  const d = data as Record<string, unknown>;
  if (!d.Success) {
    throw new AppError(502, `Тинькофф error: ${d.Message ?? "unknown"} (${d.ErrorCode ?? ""})`, "GATEWAY_ERROR");
  }
  return data;
}

function mapStatus(status: string): GatewayPaymentResult["status"] {
  switch (status) {
    case "AUTHORIZED": return "authorized";
    case "CONFIRMED": return "paid";
    case "CANCELED": return "voided";
    case "REVERSED": return "voided";
    case "REFUNDED": return "refunded";
    case "PARTIAL_REFUNDED": return "refunded";
    case "REJECTED": return "failed";
    default: return "pending";
  }
}

export const tinkoffGateway: PaymentGateway = {
  provider: "tinkoff",

  async createHold(params: CreateHoldParams): Promise<GatewayPaymentResult> {
    const { terminalKey } = getCredentials();
    const body: Record<string, unknown> = {
      TerminalKey: terminalKey,
      Amount: params.amount,
      OrderId: params.orderId,
      Description: params.description,
      PayType: "O",
    };

    if (params.savedMethodToken) {
      body.RebillId = params.savedMethodToken;
    }

    if (params.returnUrl) {
      body.SuccessURL = params.returnUrl;
      body.FailURL = params.returnUrl;
    }

    const data = (await tinkoffRequest("Init", body)) as Record<string, unknown>;
    return {
      providerPaymentId: String(data.PaymentId),
      status: mapStatus(data.Status as string),
      confirmationUrl: data.PaymentURL as string | undefined,
      rawResponse: data,
    };
  },

  async capturePayment(params: CaptureParams): Promise<GatewayPaymentResult> {
    const body = {
      PaymentId: params.providerPaymentId,
      Amount: params.amount,
    };
    const data = (await tinkoffRequest("Confirm", body)) as Record<string, unknown>;
    return {
      providerPaymentId: String(data.PaymentId),
      status: mapStatus(data.Status as string),
      rawResponse: data,
    };
  },

  async voidPayment(params: VoidParams): Promise<GatewayPaymentResult> {
    const data = (await tinkoffRequest("Cancel", { PaymentId: params.providerPaymentId })) as Record<string, unknown>;
    return {
      providerPaymentId: String(data.PaymentId),
      status: mapStatus(data.Status as string),
      rawResponse: data,
    };
  },

  async refundPayment(params: RefundParams): Promise<GatewayPaymentResult> {
    const body = {
      PaymentId: params.providerPaymentId,
      Amount: params.amount,
    };
    const data = (await tinkoffRequest("Cancel", body)) as Record<string, unknown>;
    return {
      providerPaymentId: String(data.PaymentId),
      status: mapStatus(data.Status as string),
      rawResponse: data,
    };
  },

  async getPaymentStatus(providerPaymentId: string): Promise<GatewayPaymentResult> {
    const data = (await tinkoffRequest("GetState", { PaymentId: providerPaymentId })) as Record<string, unknown>;
    return {
      providerPaymentId: String(data.PaymentId),
      status: mapStatus(data.Status as string),
      rawResponse: data,
    };
  },
};
