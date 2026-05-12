import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Navigation,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { quickStartSteps, useQuickStartFlow } from "./useQuickStartFlow";

export function Preview() {
  const {
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
  } = useQuickStartFlow();

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <Badge variant="secondary">Client mode / P0 UX</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            Быстрый клиентский флоу
          </h1>
          <p className="text-sm text-muted-foreground">
            Первый инкремент: онбординг → прозрачная цена → активная аренда
            (SOS) → завершение аренды.
          </p>
          <div className="text-xs text-muted-foreground">
            Шаг {step + 1} из {quickStartSteps.length}: {quickStartSteps[step]}
          </div>
          <Progress value={progress} className="h-2" />
        </header>

        <Card>
          <CardHeader>
            <CardTitle>
              {step + 1}) {quickStartSteps[step]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {step === 0 && (
              <>
                <p className="text-sm">1. Выберите транспорт рядом на карте.</p>
                <p className="text-sm">
                  2. Перед стартом проверьте тариф и депозит.
                </p>
                <p className="text-sm">
                  3. Если проблема — нажмите SOS в активной аренде.
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <div className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between">
                    <span>Тариф</span>
                    <span>8 ₽ / мин</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Депозит</span>
                    <span>500 ₽</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Возможные списания</span>
                    <span>штрафы по оферте</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Оценка поездки (15 мин)</span>
                    <span>~120 ₽</span>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(v) => setAcceptedTerms(Boolean(v))}
                  />
                  Я понимаю условия списаний и подтверждаю старт аренды
                </label>
                <Button className="w-full" disabled={!acceptedTerms}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Начать аренду
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="text-sm text-muted-foreground">
                  Время поездки: 00:12:44
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline">Не открывается замок</Button>
                  <Button variant="outline">Не могу завершить</Button>
                  <Button variant="outline">Авария</Button>
                  <Button variant="outline">Другое</Button>
                </div>
                <Button className="w-full" variant="destructive">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  SOS / Проблема с поездкой
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4" />
                    Вы в разрешённой зоне парковки
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={donePhoto}
                    onCheckedChange={(v) => setDonePhoto(Boolean(v))}
                  />
                  Фото парковки сделано
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={doneLock}
                    onCheckedChange={(v) => setDoneLock(Boolean(v))}
                  />
                  Замок закрыт
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={donePrice}
                    onCheckedChange={(v) => setDonePrice(Boolean(v))}
                  />
                  Финальная сумма проверена
                </label>
                <Button
                  className="w-full"
                  disabled={!canFinish}
                  variant="secondary"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Завершить аренду
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={goBack} disabled={!canGoBack}>
            Назад
          </Button>
          <Button onClick={goForward} disabled={!canGoForward}>
            Далее
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Preview;
