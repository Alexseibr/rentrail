# Публикация Staff App в App Store и Google Play

## 0. Что нужно подготовить заранее

| Что | Где взять | Цена |
|---|---|---|
| Apple Developer аккаунт | https://developer.apple.com | $99/год |
| Google Play Console | https://play.google.com/console | $25 разово |
| Expo аккаунт | https://expo.dev (Sign up) | Бесплатно |
| API задеплоен | Replit Publish (отдельная задача) | — |

## 1. Установка инструментов (один раз, локально)

```bash
npm install -g eas-cli
eas login              # логин в Expo аккаунт
```

## 2. Заполнить плейсхолдеры

### `app.json`
- `ios.bundleIdentifier` — текущее `com.velocityrides.staffapp`. Замените на свой обратный домен, например `com.mycompany.staffapp`. **Должен совпадать с App Store Connect.**
- `android.package` — то же самое для Google Play.
- `extra.eas.projectId` — создаётся командой `eas init` (см. шаг 3).
- `owner` — ваш username на expo.dev.

### `eas.json`
- `env.EXPO_PUBLIC_DOMAIN` в каждом профиле — домен опубликованного API без `https://`.
  Например: `staff-api.replit.app` (получите после деплоя API через Replit Publish).
- `submit.production.ios.appleId` — email Apple ID.
- `submit.production.ios.ascAppId` — ID приложения из App Store Connect (создайте приложение там, получите числовой ID).
- `submit.production.ios.appleTeamId` — Team ID из https://developer.apple.com/account.
- `submit.production.android.serviceAccountKeyPath` — JSON-ключ сервисного аккаунта Google Play (см. https://docs.expo.dev/submit/android/).

## 3. Инициализация EAS-проекта

```bash
cd artifacts/staff-app
eas init                       # создаст projectId, запишет в app.json
eas build:configure            # подтвердит конфигурацию
```

## 4. Иконки и сплеш-скрин

Сейчас в `assets/images/`:
- `icon.png` — должна быть **1024×1024 PNG** без прозрачности
- `splash-icon.png` — рекомендуется **1242×2436** или квадрат 1284×1284

Проверьте, что иконка корректная — Apple отклоняет приложения с прозрачными иконками или иконками меньше 1024.

## 5. Тестовая сборка (preview)

```bash
# Android APK для установки на тестовое устройство
eas build --profile preview --platform android

# iOS .ipa для TestFlight
eas build --profile preview --platform ios
```

После сборки EAS даст ссылку — APK можно установить на Android прямо из браузера, .ipa загрузить в TestFlight через Transporter.

## 6. Production-сборка и публикация

```bash
# Сборка
eas build --profile production --platform all

# Отправка в сторы
eas submit --profile production --platform ios       # → App Store Connect (ручной submit на review)
eas submit --profile production --platform android   # → Google Play Internal track
```

После этого:
- **iOS**: зайти в App Store Connect → выбрать build → заполнить метаданные (скриншоты, описание) → Submit for Review (1–7 дней).
- **Android**: в Play Console продвинуть из Internal → Closed/Open testing → Production.

## 7. Обновления (после первой публикации)

Для JS-only изменений (без нативных модулей) — **EAS Update**:
```bash
eas update --branch production --message "fix: rental return"
```
Пользователи получат обновление при следующем запуске без обновления через стор.

Для изменений нативного кода (новые expo-плагины) — снова `eas build` + `eas submit`.

## Troubleshooting

- **"Bundle identifier already exists"** — кто-то уже зарегистрировал такой ID в App Store. Поменяйте на уникальный.
- **"Invalid icon"** — иконка должна быть 1024×1024 PNG без альфа-канала.
- **"NSLocationWhenInUseUsageDescription required"** — добавьте все usage descriptions в `ios.infoPlist`.
- **API не отвечает в production-сборке** — проверьте `EXPO_PUBLIC_DOMAIN` в `eas.json`. Переменная вшивается на этапе сборки, изменение требует пересборки.
- **CORS ошибки** — на API-сервере добавьте production-домен приложения в whitelist (для нативных приложений CORS не применяется, но Web-версия может задеть).
