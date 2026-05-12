import type { ClientErrorCode } from "@/services/client-error-message";

export function mapStartRentalErrorCode(status: number): ClientErrorCode {
  if (status === 402) return "payment_declined";
  if (status === 423) return "lock_unreachable";
  if (status === 503) return "network_unreachable";
  return "unknown";
}

export function mapReturnRentalErrorCode(status: number): ClientErrorCode {
  if (status === 423) return "lock_unreachable";
  if (status === 503) return "network_unreachable";
  return "unknown";
}
