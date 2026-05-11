# Локальный workflow разработки (по шагам)

Дата: 11 мая 2026.

## 0) Проверка окружения

```bash
pnpm run dev:doctor
```

Проверяет: `node`, `pnpm`, `docker` и наличие `DATABASE_URL`.
Если чего-то не хватает, выводит подсказки по установке под текущую OS.

Для CI/интеграций можно получить машиночитаемый вывод:

```bash
pnpm run dev:doctor:json
```

JSON-вывод содержит `ok`, `checks` и `hints` (подсказки установки).

## 1) Поднять локальную БД

```bash
pnpm run dev:db:up
```

Остановить:

```bash
pnpm run dev:db:down
```

Логи Postgres:

```bash
pnpm run dev:db:logs
```

## 2) Bootstrap проекта

```bash
pnpm run dev:bootstrap
```

Что делает команда:

- codegen API-клиентов,
- проверка типов библиотек,
- seed RBAC (только если задан `DATABASE_URL`).

## 3) Полная проверка по порядку

```bash
pnpm run dev:verify
```

Порядок:

1. bootstrap,
2. API-тесты,
3. integration-тесты.

## 4) Быстрый полный запуск (если установлен docker)

```bash
pnpm run dev:test
```

Команда:

- поднимает локальный Postgres,
- запускает `dev:verify` с дефолтным локальным `DATABASE_URL`, если переменная не задана.

## Если тесты не стартуют

1. Запустите `pnpm run dev:doctor` и исправьте missing-check'и.
2. Проверьте, что Docker установлен и работает.
3. Проверьте, что Postgres контейнер запущен.
4. Проверьте `DATABASE_URL`.
5. Перезапустите:
   - `pnpm run dev:db:down`
   - `pnpm run dev:db:up`
   - `pnpm run dev:verify`
