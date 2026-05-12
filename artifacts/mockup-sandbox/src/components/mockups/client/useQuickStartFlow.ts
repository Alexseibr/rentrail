import { useMemo, useState } from "react";

export const quickStartSteps = [
  "Онбординг",
  "Цена до старта",
  "Активная аренда",
  "Завершение",
] as const;

export function useQuickStartFlow() {
  const [step, setStep] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [donePhoto, setDonePhoto] = useState(false);
  const [doneLock, setDoneLock] = useState(false);
  const [donePrice, setDonePrice] = useState(false);

  const progress = useMemo(
    () => ((step + 1) / quickStartSteps.length) * 100,
    [step],
  );

  const canGoBack = step > 0;
  const canGoForward = step < quickStartSteps.length - 1;
  const canFinish = donePhoto && doneLock && donePrice;

  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const goForward = () =>
    setStep((s) => Math.min(quickStartSteps.length - 1, s + 1));

  return {
    step,
    acceptedTerms,
    donePhoto,
    doneLock,
    donePrice,
    progress,
    canGoBack,
    canGoForward,
    canFinish,
    goBack,
    goForward,
    setAcceptedTerms,
    setDonePhoto,
    setDoneLock,
    setDonePrice,
  };
}
