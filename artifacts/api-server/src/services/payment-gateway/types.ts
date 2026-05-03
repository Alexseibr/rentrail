export type PaymentGatewayProvider = "yukassa" | "tinkoff" | "cloudpayments";

export interface CreateHoldParams {
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  customerEmail?: string;
  customerPhone?: string;
  savedMethodToken?: string;
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface CaptureParams {
  providerPaymentId: string;
  amount: number;
  currency: string;
}

export interface VoidParams {
  providerPaymentId: string;
}

export interface RefundParams {
  providerPaymentId: string;
  amount: number;
  currency: string;
  reason?: string;
}

export type PaymentGatewayStatus = "pending" | "authorized" | "paid" | "failed" | "voided" | "refunded";

export interface GatewayPaymentResult {
  providerPaymentId: string;
  status: PaymentGatewayStatus;
  confirmationUrl?: string;
  savedMethodToken?: string;
  rawResponse?: unknown;
}

export interface PaymentGateway {
  provider: PaymentGatewayProvider;
  createHold(params: CreateHoldParams): Promise<GatewayPaymentResult>;
  capturePayment(params: CaptureParams): Promise<GatewayPaymentResult>;
  voidPayment(params: VoidParams): Promise<GatewayPaymentResult>;
  refundPayment(params: RefundParams): Promise<GatewayPaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<GatewayPaymentResult>;
}
