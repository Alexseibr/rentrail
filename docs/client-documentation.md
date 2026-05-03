# Документация по завершённому функционалу

## Платформа аренды транспорта — API + Staff App + Platform Admin

**Версия:** 1.0  
**Дата:** май 2026  
**Стек:** Express 5, PostgreSQL, Drizzle ORM, JWT, Expo (React Native), React/Vite

---

## Содержание

1. [Архитектура системы](#1-архитектура-системы)
2. [Аутентификация и авторизация](#2-аутентификация-и-авторизация)
3. [Управление активами (транспорт)](#3-управление-активами-транспорт)
4. [Аренда](#4-аренда)
5. [Сервисный модуль](#5-сервисный-модуль)
6. [Уведомления](#6-уведомления)
7. [Staff App — мобильное приложение](#7-staff-app--мобильное-приложение)
8. [Platform Admin — веб-панель](#8-platform-admin--веб-панель)
9. [Ролевая модель доступа (RBAC)](#9-ролевая-модель-доступа-rbac)
10. [Демо-данные и учётные записи](#10-демо-данные-и-учётные-записи)
11. [Справочник API](#11-справочник-api)

---

## 1. Архитектура системы

```
┌─────────────────────────────────────────────────────────┐
│                   Replit Proxy (порт 80)                │
│              маршрутизация по path-prefix               │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
    /api/* → API Server    /* → Platform Admin
           │
    ┌──────▼──────────────────┐
    │  API Server (Express 5) │  порт из $PORT
    │  @workspace/api-server  │
    ├─────────────────────────┤
    │  PostgreSQL + Drizzle   │
    │  JWT (access 15м +      │
    │  refresh 30д)           │
    └─────────────────────────┘
           │
    ┌──────▼──────────────────┐
    │  Staff App (Expo)       │  Expo Go / Tunnel
    │  iOS + Android + Web    │
    │  Режим: Staff / Client  │
    └─────────────────────────┘
```

**Мультитенантность:** каждый запрос к API требует заголовка `x-company-id` для изоляции данных по компаниям.

---

## 2. Аутентификация и авторизация

### 2.1 Вход по номеру телефона

```http
POST /api/auth/phone/login
Content-Type: application/json

{
  "phone": "+79991000001",
  "password": "demo1234"
}
```

**Ответ:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "uuid",
      "firstName": "Maria",
      "lastName": "Johnson",
      "phone": "+79991000001"
    }
  }
}
```

Токены: access — 15 минут, refresh — 30 дней.

### 2.2 Информация о текущем пользователе

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

### 2.3 Обновление токена

```http
POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJ..." }
```

### 2.4 Выход

```http
POST /api/auth/logout
Authorization: Bearer <accessToken>
```

### 2.5 Заголовки для запросов к API

Все защищённые эндпоинты требуют:

| Заголовок | Значение |
|-----------|----------|
| `Authorization` | `Bearer <accessToken>` |
| `x-company-id` | UUID компании |

---

## 3. Управление активами (транспорт)

### 3.1 Типы активов

| Код | Название |
|-----|----------|
| `bike` | Велосипед |
| `ebike` | Электровелосипед |
| `scooter` | Самокат |
| `escooter` | Электросамокат |

### 3.2 Статусы активов

| Статус | Описание |
|--------|----------|
| `available` | Доступен для аренды |
| `rented` | В аренде |
| `maintenance` | На техобслуживании |
| `blocked` | Заблокирован |
| `draft` | Черновик (не введён в эксплуатацию) |
| `retired` | Списан |
| `charging` | Заряжается |
| `reserved` | Зарезервирован |
| `lost` | Утерян |
| `overdue` | Просрочена аренда |

### 3.3 API активов

```http
GET  /api/assets                     — список активов компании
GET  /api/assets/:id                 — один актив
POST /api/assets                     — создать актив  [asset:create]
PATCH /api/assets/:id                — обновить актив [asset:update]
PATCH /api/assets/:id/status         — изменить статус [asset:changeStatus]
GET  /api/assets/:id/status-history  — история статусов
```

**Создание актива:**
```json
{
  "internalCode": "EBK-001",
  "assetType": "ebike",
  "brand": "Xiaomi",
  "model": "Mi Electric Bike",
  "year": 2024,
  "status": "available",
  "branchId": "uuid"
}
```

**Изменение статуса:**
```json
{
  "status": "maintenance",
  "reason": "Плановое ТО"
}
```

### 3.4 Карта флота

```http
GET /api/fleet-map
```

Возвращает все активы компании с последними GPS-координатами и показателями телеметрии (батарея, скорость, состояние замка) для отображения на карте.

---

## 4. Аренда

### 4.1 Статусы аренды

| Статус | Описание |
|--------|----------|
| `draft` | Черновик |
| `pending_approval` | Ожидает подтверждения |
| `awaiting_payment` | Ожидает оплаты |
| `awaiting_pickup` | Ожидает получения |
| `active` | Активная аренда |
| `overdue` | Просрочена |
| `completed` | Завершена |
| `canceled` | Отменена |

### 4.2 Типы аренды

| Тип | Описание |
|-----|----------|
| `hourly` | Почасовая |
| `daily` | Посуточная |
| `monthly` | Ежемесячная |
| `deposit` | С депозитом |

### 4.3 API аренды

```http
GET  /api/rentals          — список аренд
GET  /api/rentals/:id      — одна аренда
POST /api/rentals          — создать аренду   [rental:create]
PATCH /api/rentals/:id     — обновить аренду  [rental:update]
POST /api/rentals/:id/start    — начать аренду   [rental:start]
POST /api/rentals/:id/complete — завершить аренду [rental:complete]
POST /api/rentals/:id/cancel   — отменить аренду  [rental:cancel]
```

---

## 5. Сервисный модуль

### 5.1 Наряды на работу (Work Orders)

Нарядная система для учёта всех сервисных работ с транспортом.

#### Типы нарядов

| Тип | Описание |
|-----|----------|
| `field_repair` | Полевой ремонт (выезд к транспорту) |
| `workshop_repair` | Мастерская |
| `scheduled_maintenance` | Плановое ТО |
| `inspection` | Осмотр |
| `recovery` | Эвакуация |
| `cleaning` | Мойка/чистка |

#### Приоритеты нарядов

| Приоритет | Описание |
|-----------|----------|
| `low` | Низкий |
| `medium` | Средний (по умолчанию) |
| `high` | Высокий |
| `urgent` | Срочный |

#### Жизненный цикл наряда

```
draft → assigned → en_route → in_progress → waiting_parts → completed
                                                            ↘ canceled
```

#### API нарядов

```http
GET  /api/work-orders                    — список нарядов
POST /api/work-orders                    — создать наряд    [asset:update]
PATCH /api/work-orders/:id              — обновить наряд   [asset:update]
POST  /api/work-orders/:id/status       — изменить статус  [asset:update]
GET  /api/work-orders/:id/parts         — запчасти наряда
POST /api/work-orders/:id/parts         — добавить запчасть к наряду
DELETE /api/work-orders/:id/parts/:partId — убрать запчасть из наряда
```

**Создание наряда:**
```json
{
  "title": "Замена цепи KMC X11",
  "orderType": "workshop_repair",
  "priority": "high",
  "assetId": "uuid-актива",
  "description": "Износ цепи превышает 0.75%"
}
```

**Переход по статусам:**
```json
{ "status": "in_progress" }

{ "status": "completed", "actualCost": "950.00", "resolution": "Цепь заменена" }
```

**Получение списка механиков:**
```http
GET /api/mechanics
```

---

### 5.2 Журнал обслуживания (Maintenance Logs)

Фиксирует каждую выполненную работу по конкретному транспортному средству. Служит историей ТО.

#### Типы записей

| Тип | Описание |
|-----|----------|
| `oil_change` | Замена масла |
| `tire_replacement` | Замена шин |
| `brake_service` | Обслуживание тормозов |
| `battery_replacement` | Замена аккумулятора |
| `chain_service` | Обслуживание цепи |
| `electrical_repair` | Электрический ремонт |
| `frame_repair` | Ремонт рамы |
| `general_service` | Общее обслуживание |
| `inspection` | Осмотр |
| `cleaning` | Чистка |
| `other` | Прочее |

#### API журнала

```http
GET  /api/maintenance-logs              — список записей (фильтр: ?assetId=)
POST /api/maintenance-logs             — создать запись  [asset:update]
```

**Создание записи:**
```json
{
  "assetId": "uuid-актива",
  "logType": "brake_service",
  "notes": "Заменены колодки Shimano BR-M420, регулировка хода ручки",
  "cost": "2500.00",
  "odometerKm": 3240,
  "performedAt": "2026-05-01T10:00:00Z"
}
```

Поле `performedAt` — опционально (по умолчанию — текущее время).

---

### 5.3 Расписание обслуживания (Maintenance Schedules)

Планировщик регулярного ТО по интервалу времени и/или пробегу.

#### Типы расписаний

| Тип | Описание |
|-----|----------|
| `inspection` | Регулярный осмотр |
| `oil_change` | Замена масла |
| `tire_replacement` | Замена шин |
| `brake_service` | Тормоза |
| `battery_check` | Проверка батареи |
| `chain_service` | Цепь |
| `general_service` | Общее ТО |
| `custom` | Пользовательское |

#### API расписаний

```http
GET    /api/maintenance-schedules          — список расписаний (?assetId=)
GET    /api/maintenance-schedules/overdue  — просроченные расписания
POST   /api/maintenance-schedules          — создать расписание  [asset:update]
PATCH  /api/maintenance-schedules/:id      — обновить расписание [asset:update]
DELETE /api/maintenance-schedules/:id      — удалить расписание  [asset:update]
```

**Создание расписания:**
```json
{
  "assetId": "uuid-актива",
  "scheduleType": "inspection",
  "name": "Плановое ТО каждые 90 дней",
  "intervalDays": 90,
  "intervalKm": 2000
}
```

Система автоматически обновляет `nextDueAt` и `nextDueKm` после каждой записи в журнале обслуживания соответствующего типа.

---

### 5.4 Склад запчастей (Spare Parts)

Учёт складских запасов с полной историей движения товара.

#### Категории запчастей

| Категория | Описание |
|-----------|----------|
| `tires` | Шины |
| `brakes` | Тормоза |
| `electrical` | Электрика |
| `battery` | Аккумуляторы |
| `frame` | Рама |
| `chain` | Цепь и трансмиссия |
| `transmission` | Трансмиссия |
| `lights` | Освещение |
| `display` | Дисплеи |
| `charger` | Зарядные устройства |
| `lock` | Замки |
| `motor` | Моторы |
| `other` | Прочее |

#### API склада

```http
GET    /api/spare-parts              — список запчастей
GET    /api/spare-parts/:id          — одна запчасть
POST   /api/spare-parts              — создать позицию      [asset:update]
PATCH  /api/spare-parts/:id          — обновить позицию     [asset:update]
DELETE /api/spare-parts/:id          — удалить позицию      [asset:update]
GET    /api/spare-parts/:id/transactions — история движения
POST   /api/spare-parts/transactions — создать транзакцию   [asset:update]
```

**Создание позиции:**
```json
{
  "name": "Тормозные колодки Shimano BR-M420",
  "sku": "BR-M420",
  "category": "brakes",
  "unit": "шт",
  "qtyInStock": 0,
  "minQtyAlert": 2,
  "costPrice": "450.00",
  "location": "Стеллаж A-3"
}
```

**Поступление на склад (+):**
```json
{
  "partId": "uuid-запчасти",
  "transactionType": "in",
  "qty": 20,
  "notes": "Поступление от поставщика ВелоТех"
}
```

**Выдача со склада (−):**
```json
{
  "partId": "uuid-запчасти",
  "transactionType": "out",
  "qty": 3,
  "notes": "Выдача механику на ТО"
}
```

Поле `qtyInStock` обновляется автоматически при каждой транзакции.

---

## 6. Уведомления

```http
GET  /api/notifications              — список уведомлений
POST /api/notifications/:id/read     — пометить как прочитанное
POST /api/notifications/read-all     — пометить все как прочитанные
```

Уведомления привязаны к пользователю и компании. В Staff App отображается счётчик непрочитанных.

---

## 7. Staff App — мобильное приложение

Expo-приложение для iOS, Android и Web. Поддерживает два режима работы.

### 7.1 Режимы работы

**Staff Mode** — для сотрудников компании (авторизуются по телефону/паролю):
- Просмотр и управление флотом
- Работа с арендами
- Сервисный модуль (наряды, журнал ТО, склад)
- Push-уведомления

**Client Mode** — для клиентов-арендаторов:
- Просмотр доступных транспортных средств
- Управление своими арендами
- История поездок

### 7.2 Навигация Staff Mode

```
Нижнее меню:
├── Активы (assets)
│   ├── Список с поиском по коду/марке/модели
│   ├── Фильтры по статусу (chips)
│   └── Карточка: тип, статус, батарея, локация
├── Аренды (rentals)
│   ├── Список с поиском
│   ├── Фильтры по статусу и типу
│   └── Карточка с клиентом и суммой
├── Операции (operations)
│   ├── Быстрые действия (изменение статусов, уведомления)
│   └── Сервисный модуль:
│       ├── Наряды на работу (Work Orders)
│       ├── Журнал ТО (Maintenance Logs)
│       ├── Расписание ТО (Schedules)
│       └── Склад запчастей (Spare Parts)
└── Профиль (profile)
```

### 7.3 Экраны сервисного модуля

#### Наряды на работу (`/service/work-orders`)
- Список нарядов с фильтрами по статусу
- Карточка: тип, приоритет, статус, дата создания
- Статусы с цветовыми индикаторами (draft/in_progress/completed/canceled)

#### Журнал ТО (`/service/maintenance-logs`)
- История обслуживания по активам
- Создание новых записей
- Фильтр по типу работ

#### Расписание ТО (`/service/maintenance-schedules`)
- Список плановых ТО с индикатором «Просрочено»
- Создание по интервалу дней / км
- Автообновление после выполнения работ

#### Склад запчастей (`/service/spare-parts`)
- Список позиций с текущим остатком
- Кнопки «+ Поступление» / «− Выдача»
- История движения каждой позиции

### 7.4 Интернационализация (i18n)

Поддерживаются: **Русский (ru)** и **English (en)**.

Переведены:
- Статусы активов (available → «Доступен», rented → «В аренде» и т.д.)
- Типы активов (bike → «Велосипед», ebike → «Э-велосипед» и т.д.)
- Статусы аренды (все 8 статусов)
- Типы аренды (hourly → «Почасовая» и т.д.)
- Все экраны и компоненты навигации

---

## 8. Platform Admin — веб-панель

React/Vite приложение для управления платформой.

**URL:** `/` (через Replit proxy)

### 8.1 Разделы

| Раздел | Функционал |
|--------|-----------|
| Dashboard | Сводная статистика |
| Companies | Управление компаниями-арендодателями |
| Assets | Список и редактирование транспорта |
| Rentals | Просмотр всех аренд |
| Users | Управление пользователями |
| Roles | Управление ролями и разрешениями |

---

## 9. Ролевая модель доступа (RBAC)

### 9.1 Системные роли

| Роль | Код | Описание |
|------|-----|----------|
| Владелец | `owner` | Полный доступ ко всему |
| Администратор | `admin` | Всё кроме управления компанией |
| Менеджер | `manager` | Операции без удаления |
| Оператор | `operator` | Работа с клиентами и арендами |
| Механик | `mechanic` | Только сервис и статусы активов |
| Бухгалтер | `accountant` | Финансовые операции |
| Наблюдатель | `viewer` | Только чтение |
| Супер-администратор | `superAdmin` | Системный уровень |

### 9.2 Матрица разрешений сервисного модуля

| Действие | owner | admin | manager | mechanic | operator | viewer |
|----------|-------|-------|---------|----------|----------|--------|
| Читать наряды | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Создавать наряды | ✅ | ✅ | ✅ | — | — | — |
| Обновлять наряды | ✅ | ✅ | ✅ | ✅ | — | — |
| Читать журнал ТО | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Создавать записи ТО | ✅ | ✅ | ✅ | ✅ | — | — |
| Склад — чтение | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Склад — транзакции | ✅ | ✅ | ✅ | — | — | — |

> Разрешение `asset:update` даёт доступ к созданию/обновлению нарядов, журнала, расписаний, транзакций склада.  
> Разрешение `asset:read` даёт доступ к просмотру всех сервисных данных.

### 9.3 Проверка разрешений

Каждый защищённый эндпоинт проверяет:
1. Наличие валидного JWT (`authenticate`)
2. Членство пользователя в компании (`requireCompanyAccess`)
3. Наличие нужного разрешения (`requirePermission`)

При нарушении: `403 FORBIDDEN` с телом `{"error": {"code": "FORBIDDEN", "message": "Missing permission: ..."}}`

---

## 10. Демо-данные и учётные записи

### 10.1 Компания Velocity Rides

**ID:** `6a5585c0-a196-43fa-9454-bce5c63c2a8b`

### 10.2 Демо-пользователи (Staff)

| Имя | Телефон | Роль | Пароль |
|-----|---------|------|--------|
| Maria Johnson | `+79991000001` | Owner | `demo1234` |
| Carlos Rivera | `+79991000002` | Admin | `demo1234` |
| Sarah Chen | `+79991000003` | Manager | `demo1234` |
| James Wilson | `+79991000004` | Operator | `demo1234` |
| Andrei Volkov | `+79991000005` | Mechanic | `demo1234` |
| Emma Park | `+79991000006` | Viewer | `demo1234` |
| Lucia Fernandez | `+79991000007` | Accountant | `demo1234` |

### 10.3 Сидированные данные

| Сущность | Количество | Детали |
|----------|-----------|--------|
| Активы | 40 | bike, ebike, scooter, escooter |
| Аренды | 15 | 6 разных статусов |
| Наряды | 3 | assigned, in_progress, completed |
| Уведомления | 2 | оба непрочитаны |
| Механики | 1 | Andrei Volkov |

---

## 11. Справочник API

### 11.1 Базовый URL

Разработка: `http://localhost:80/api`  
Продакшн: `https://<домен>.replit.app/api`

### 11.2 Формат ответов

**Успех:**
```json
{ "data": { ... } }
```

**Успех (список):**
```json
{ "data": [ ... ] }
```

**Ошибка:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Missing permission: asset:update"
  }
}
```

### 11.3 Коды ошибок

| Код HTTP | Код ошибки | Причина |
|----------|------------|---------|
| 400 | `VALIDATION` | Неверные параметры запроса |
| 401 | `UNAUTHORIZED` | Токен отсутствует или истёк |
| 403 | `FORBIDDEN` | Недостаточно прав |
| 404 | `NOT_FOUND` | Ресурс не найден |
| 500 | `INTERNAL_ERROR` | Внутренняя ошибка сервера |

### 11.4 Полный список эндпоинтов

#### Аутентификация
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/phone/login` | Вход по телефону |
| POST | `/auth/refresh` | Обновить токен |
| POST | `/auth/logout` | Выйти |
| GET | `/auth/me` | Текущий пользователь |

#### Активы
| Метод | Путь | Разрешение |
|-------|------|-----------|
| GET | `/assets` | `asset:read` |
| GET | `/assets/:id` | `asset:read` |
| POST | `/assets` | `asset:create` |
| PATCH | `/assets/:id` | `asset:update` |
| PATCH | `/assets/:id/status` | `asset:changeStatus` |
| GET | `/assets/:id/status-history` | `asset:read` |
| GET | `/fleet-map` | `asset:read` |

#### Аренда
| Метод | Путь | Разрешение |
|-------|------|-----------|
| GET | `/rentals` | `rental:read` |
| GET | `/rentals/:id` | `rental:read` |
| POST | `/rentals` | `rental:create` |
| PATCH | `/rentals/:id` | `rental:update` |
| POST | `/rentals/:id/start` | `rental:start` |
| POST | `/rentals/:id/complete` | `rental:complete` |
| POST | `/rentals/:id/cancel` | `rental:cancel` |

#### Сервисный модуль
| Метод | Путь | Разрешение |
|-------|------|-----------|
| GET | `/work-orders` | `asset:read` |
| POST | `/work-orders` | `asset:update` |
| PATCH | `/work-orders/:id` | `asset:update` |
| POST | `/work-orders/:id/status` | `asset:update` |
| GET | `/work-orders/:id/parts` | `asset:read` |
| POST | `/work-orders/:id/parts` | `asset:update` |
| DELETE | `/work-orders/:id/parts/:partId` | `asset:update` |
| GET | `/mechanics` | `asset:read` |
| GET | `/maintenance-logs` | `asset:read` |
| POST | `/maintenance-logs` | `asset:update` |
| GET | `/maintenance-schedules` | `asset:read` |
| GET | `/maintenance-schedules/overdue` | `asset:read` |
| POST | `/maintenance-schedules` | `asset:update` |
| PATCH | `/maintenance-schedules/:id` | `asset:update` |
| DELETE | `/maintenance-schedules/:id` | `asset:update` |
| GET | `/spare-parts` | `asset:read` |
| GET | `/spare-parts/:id` | `asset:read` |
| POST | `/spare-parts` | `asset:update` |
| PATCH | `/spare-parts/:id` | `asset:update` |
| DELETE | `/spare-parts/:id` | `asset:update` |
| GET | `/spare-parts/:id/transactions` | `asset:read` |
| POST | `/spare-parts/transactions` | `asset:update` |

#### Уведомления
| Метод | Путь | Разрешение |
|-------|------|-----------|
| GET | `/notifications` | `notification:read` |
| POST | `/notifications/:id/read` | `notification:read` |
| POST | `/notifications/read-all` | `notification:read` |

#### Прочее
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/service-requests` | Заявки на сервис |
| GET | `/service-requests/:id` | Одна заявка |
| POST | `/webhooks/yukassa` | Webhook ЮКасса |

---

## Примеры полных сценариев

### Сценарий 1: Механик выполняет ТО велосипеда

```bash
# 1. Войти как механик
TOKEN=$(curl -s -X POST /api/auth/phone/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+79991000005","password":"demo1234"}' | jq -r '.data.accessToken')

# 2. Получить список активов
curl /api/assets -H "Authorization: Bearer $TOKEN" -H "x-company-id: $COMPANY"

# 3. Перевести актив в статус maintenance
curl -X PATCH /api/assets/$ASSET_ID/status \
  -d '{"status":"maintenance","reason":"Плановое ТО"}'

# 4. Создать запись в журнале ТО
curl -X POST /api/maintenance-logs \
  -d '{"assetId":"$ASSET_ID","logType":"brake_service","cost":"2500.00"}'

# 5. Вернуть актив в available
curl -X PATCH /api/assets/$ASSET_ID/status \
  -d '{"status":"available","reason":"ТО завершено"}'
```

### Сценарий 2: Полный цикл наряда на работу

```bash
# 1. Создать наряд
WO=$(curl -X POST /api/work-orders \
  -d '{"title":"Замена цепи","orderType":"workshop_repair","priority":"high"}')
WO_ID=$(echo $WO | jq -r '.data.id')

# 2. Взять в работу
curl -X POST /api/work-orders/$WO_ID/status -d '{"status":"in_progress"}'

# 3. Выписать запчасть со склада
curl -X POST /api/spare-parts/transactions \
  -d '{"partId":"$PART_ID","transactionType":"out","qty":1}'

# 4. Завершить наряд
curl -X POST /api/work-orders/$WO_ID/status \
  -d '{"status":"completed","actualCost":"950.00","resolution":"Цепь заменена"}'
```

### Сценарий 3: Управление складом запчастей

```bash
# Создать позицию
PART=$(curl -X POST /api/spare-parts \
  -d '{"name":"Колодки Shimano","sku":"SH-BR-001","category":"brakes","unit":"шт"}')
PART_ID=$(echo $PART | jq -r '.data.id')

# Поступление (+20 шт)
curl -X POST /api/spare-parts/transactions \
  -d '{"partId":"$PART_ID","transactionType":"in","qty":20}'

# Выдача (-3 шт)
curl -X POST /api/spare-parts/transactions \
  -d '{"partId":"$PART_ID","transactionType":"out","qty":3}'

# Проверить остаток → 17 шт
curl /api/spare-parts/$PART_ID | jq '.data.qtyInStock'
```
