export type { PaymentGateway, PaymentGatewayProvider, CreateHoldParams, CaptureParams, VoidParams, RefundParams, GatewayPaymentResult } from "./types";
import type { PaymentGateway, PaymentGatewayProvider } from "./types";
import { yukassaGateway } from "./yukassa";
import { tinkoffGateway } from "./tinkoff";
import { cloudpaymentsGateway } from "./cloudpayments";
import { AppError } from "../../lib/errors";

const GATEWAYS: Record<PaymentGatewayProvider, PaymentGateway> = {
  yukassa: yukassaGateway,
  tinkoff: tinkoffGateway,
  cloudpayments: cloudpaymentsGateway,
};

export function getGateway(provider: PaymentGatewayProvider): PaymentGateway {
  const gw = GATEWAYS[provider];
  if (!gw) throw new AppError(400, `Unsupported payment gateway: ${provider}`, "UNSUPPORTED_GATEWAY");
  return gw;
}

export function isValidProvider(provider: string): provider is PaymentGatewayProvider {
  return ["yukassa", "tinkoff", "cloudpayments"].includes(provider);
}

export { yukassaGateway, tinkoffGateway, cloudpaymentsGateway };
