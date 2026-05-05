# Демо-приложение на Node.js для каталога решений МоегоСклада

Данное демо показывает основные способы взаимодействия решения с МоимСкладом по протоколу Vendor API.

В демо-приложении реализованы следующие функции:
- Активация и деактивация решения через Vendor API
- Генерация `descriptor.xml` для публикации в каталоге
- Отображение iframe-страницы настроек решения
- Получение контекста пользователя для iframe/виджетов (с кешированием в сессии)
- Сохранение настроек решения и обновление статуса во внешнем Vendor API
- Получение данных из JSON API 1.2 по токену установки
- Встраивание виджетов в Заказ покупателя и Счет покупателю
- Обработка кастомных кнопок в документе и списке Заказов покупателя
- Открытие кастомного popup из виджета и кнопки

ВНИМАНИЕ! Проект является демонстрационным. Вопросы production-hardening (полноценный мониторинг, отказоустойчивость, строгая политика хранения секретов, rate-limit защита) не являются целью данного репозитория.

## Быстрый старт

Порты:
- локальная разработка (`npm run dev`) — `http://localhost:3000`
- Docker (`docker run`) — `http://localhost:8085` (маппинг `8085:80`)

Локальный запуск:

```bash
npm ci
cp .env.example .env
npm run dev
```

Проверка:

```bash
curl -sS http://localhost:3000/health
```

Сборка и запуск production-режима:

```bash
npm run build
npm start
```

Docker:

```bash
npm run prepare:docker
docker build -t node-js-demo-app:local .
docker run --rm -p 8085:80 --env-file .env node-js-demo-app:local
```

## Конфигурация

Ключевые переменные окружения:
- `PORT` — порт, который слушает процесс внутри контейнера/локального процесса.
- `APP_BASE_URL` — публичный внешний URL приложения, который попадает в `descriptor.xml` (`iframe`, `widgets`, `popup`).
- `APP_ID`, `APP_UID`, `APP_SECRET_KEY` — идентификаторы и секрет приложения Marketplace.
- `APP_ENCRYPT_KEY` — ключ шифрования чувствительных полей в SQLite (ровно 64 hex-символа).
- `SESSION_SECRET` — секрет подписи server-side сессии.
- `APP_DB_PATH` — путь к SQLite-файлу с состоянием приложения, server-side сессиями и replay-маркерами JWT.
- `TRUST_PROXY` — доверие заголовкам `X-Forwarded-*` (`0` локально без прокси, `1` за ingress/reverse proxy).

Локальная разработка по умолчанию:
- `PORT=3000`
- `APP_BASE_URL=http://localhost:3000`

Docker-сценарий:
- приложение внутри контейнера слушает `PORT=80`
- внешний URL остается `APP_BASE_URL=http://localhost:8085`, если контейнер опубликован как `-p 8085:80`
- для production/OKD: собирайте образ локально и публикуйте в registry (`npm run prepare:docker`, `docker build`, `docker push`)

## Reverse Proxy и HTTPS

Для браузерной сессии с `SameSite=None` cookie должна быть `Secure`, а внешний трафик должен идти по HTTPS:
- выставляйте `SESSION_COOKIE_SECURE=true` для стендов за HTTPS;
- за ingress/reverse proxy используйте `TRUST_PROXY=1`, чтобы Express корректно определял `req.secure`.

## CLI утилиты

- `npm run cli:generate-descriptor` — выводит `descriptor.xml` в stdout.
- `npm run cli:generate-jwt` — выводит service JWT для вызовов Vendor API.

## Технологии

- `Node.js 24` — runtime для серверного приложения.
- `TypeScript` — статическая типизация и более безопасный рефакторинг.
- `Express 5` — HTTP-сервер, маршрутизация и middleware-цепочка.
- `EJS` — серверный рендеринг iframe/widget/popup страниц.
- `express-session` — server-side сессии для хранения user context между запросами.
- `node:sqlite` (`DatabaseSync`) — встроенный SQLite в Node.js для хранения состояния приложения, сессий и replay-маркеров JWT.
- `axios` — HTTP-клиент для вызовов Vendor API и JSON API.

## Виджеты

Решение встраивает виджеты на следующие экраны:
- `document.customerorder.edit`
- `document.invoiceout.edit`

Виджеты демонстрируют:
- Получение контекста пользователя (`uid`, `fio`) по `contextKey`
- Получение данных открытого объекта через `/utils/get-object`
- Работу с SDK и протоколами виджетов: `open-feedback`, `dirty-state`, `save-handler`, `update-provider`, `validation-feedback`
- Использование `good-folder-selector`, `standard-dialogs`, `navigation-service`
- Открытие popup и логирование обмена сообщениями

## Кастомные кнопки

Решение регистрирует кнопки:
- `show-notification` (документ + список заказов)
- `navigate-to` (документ заказа)
- `show-popup` (документ заказа)

Поддерживаемые экраны:
- `document.customerorder.edit`
- `document.customerorder.list`

## Кастомные popup окна

В дескрипторе зарегистрирован popup:
- `some-popup` (`/entry/popup`)

Popup можно открыть:
- из виджета (через SDK)
- из кнопки `show-popup`

## Сессии

В проекте используется server-side сессия (`express-session`) с SQLite store:
- При первом запросе создается `sid`, а данные сессии сохраняются в таблицу `sessions` SQLite-файла `APP_DB_PATH`.
- В сессии хранится bucket `userContext` (контекст пользователя по `contextKey`) из `src/lib/session/user-context.ts`.
- Для каждого `contextKey` обновляется `expiresAt`; устаревшие записи отбрасываются при чтении.
- В `sqlite-session-store` при `set/touch` периодически запускается очистка истекших записей с ограничением по количеству строк за проход.

## Хранение состояния

Runtime-состояние хранится в SQLite-файле `APP_DB_PATH`:
- Таблица `account_application` содержит состояние установки по паре `appId`/`accountId`: сообщение настроек, выбранный склад, access token, статус и дату обновления.
- Таблица `sessions` содержит server-side сессии Express.
- Таблица `jwt` содержит replay-маркеры service JWT `jti` до истечения `exp`.
- Access token и session payload сохраняются в базе в зашифрованном виде через `APP_ENCRYPT_KEY`.
- Ключ `APP_ENCRYPT_KEY` должен быть стабильным для окружения. При смене ключа уже сохраненные данные не смогут расшифроваться.

## Основные HTTP routes

Service routes:
- `GET /health` — liveness-check: процесс запущен и отвечает HTTP.

Entry routes:
- `GET /entry/iframe?contextKey=...`
- `GET /entry/widget-customerorder?contextKey=...`
- `GET /entry/widget-invoiceout?contextKey=...`
- `GET /entry/popup`

Backend utility routes:
- `POST /utils/update-settings`
- `GET /utils/get-object?entity=...&contextKey=...&objectId=...`

Vendor endpoint routes:
- `PUT /vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId`
- `DELETE /vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId`
- `PUT /vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId/event`
- `POST /vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId/button`

## Vendor API примеры

Пример установки/обновления состояния:

```bash
curl -X PUT "http://localhost:3000/vendor-endpoint/api/moysklad/vendor/1.0/apps/<APP_ID>/<ACCOUNT_ID>" \
  -H "Authorization: Bearer <JWT_FROM_cli:generate-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "appUid": "<APP_UID>",
    "cause": "Install",
    "access": [{"access_token": "<MS_ACCESS_TOKEN>"}]
  }'
```

Пример деактивации:

```bash
curl -X DELETE "http://localhost:3000/vendor-endpoint/api/moysklad/vendor/1.0/apps/<APP_ID>/<ACCOUNT_ID>" \
  -H "Authorization: Bearer <JWT_FROM_cli:generate-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "appUid": "<APP_UID>",
    "cause": "Suspend"
  }'
```

## Что такое contextKey

`contextKey` — одноразовый/временный ключ контекста пользователя от МоегоСклада.  
Приложение использует его для получения контекста через Vendor API и сохраняет результат в server-side сессии (`userContext`) для backend-роутов (`/utils/*`) и entry-роутов (`/entry/*`).

## Структура проекта

Основные entrypoints:
- `src/server.ts` — запуск HTTP-сервера
- `src/app.ts` — создание Express-приложения и регистрация middleware/routes

API и интеграции:
- `src/api/vendor-endpoint.ts` — обработка lifecycle событий и button callbacks
- `src/api/button.ts` — формирование action-ответов для кнопок
- `src/lib/integrations/vendor-api.ts` — клиент Vendor API (context/status)
- `src/lib/integrations/json-api.ts` — клиент JSON API 1.2

UI и entry:
- `src/entry/router.ts` — `iframe/widget/popup` routes
- `src/views/entry/*` — EJS-шаблоны страниц
- `public/assets/entry/*` — фронтенд-стили/скрипты

Runtime paths:
- В production приложение читает шаблоны из `dist/views` и статику из `dist/public/assets`.
- В dev-режиме (`npm run dev`) используются `src/views` и `public/assets`.

Состояние и безопасность:
- `src/lib/domain/app-instance.ts` — модель состояния установки приложения
- `src/lib/domain/app-instance-sqlite-repository.ts` — SQLite-хранение состояния установки приложения
- `src/lib/session/sqlite-session-store.ts` — SQLite-хранение server-side сессий
- `src/lib/session/user-context.ts` — загрузка/кеширование user context по `contextKey`
- `src/lib/security/security.ts` — утилиты шифрования чувствительных данных
- `src/lib/security/jwt-replay-repository.ts` — SQLite-хранение replay-маркеров JWT `jti`

Утилиты:
- `src/utils/descriptor.ts` — генерация `descriptor.xml`
- `src/utils/router.ts` — backend endpoints настроек и чтения объектов

CLI-утилиты (запускаются только вручную через npm scripts):
- `src/cli-utils/generate-jwt.ts` — генерация service JWT для вызовов Vendor API.
- `src/cli-utils/generate-descriptor.ts` — генерация `descriptor.xml` в stdout.
