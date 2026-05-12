export type ClientErrorCode =
  | "network_unreachable"
  | "gps_unavailable"
  | "lock_unreachable"
  | "payment_declined"
  | "unknown";

export function getClientErrorMessage(
  code: ClientErrorCode,
  locale: "ru" | "en",
) {
  const ru: Record<ClientErrorCode, string> = {
    network_unreachable: "Нет сети. Проверьте интернет и повторите.",
    gps_unavailable: "Нет сигнала GPS. Перейдите на открытую местность.",
    lock_unreachable: "Не удалось связаться с замком. Попробуйте ещё раз.",
    payment_declined: "Платёж отклонён. Проверьте карту или выберите другую.",
    unknown: "Что-то пошло не так. Попробуйте повторить действие.",
  };

  const en: Record<ClientErrorCode, string> = {
    network_unreachable: "No network. Check your internet and try again.",
    gps_unavailable: "No GPS signal. Move to an open area.",
    lock_unreachable: "Unable to reach lock. Please try again.",
    payment_declined:
      "Payment was declined. Check card details or use another card.",
    unknown: "Something went wrong. Please try again.",
  };

  return locale === "ru" ? ru[code] : en[code];
}
