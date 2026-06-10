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
Для упрощения запуска демо используется `node:sqlite` (без внешней БД). В Node.js 24/25 этот модуль имеет нестабильный статус API (не fully stable), поэтому для production рекомендуется выносить состояние в отдельную БД и не опираться на локальный SQLite-файл контейнера.

## Быстрый старт

Настройка локальной среды и запуск:

```bash
npm ci
cp .env.example .env
npm run dev
```
Примечание: требуется node версии не ниже 24 

Либо запустите решение в Docker:

```bash
docker compose up --build
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

## Конфигурация

Ключевые переменные окружения:
- `PORT` — порт, который слушает процесс внутри контейнера/локального процесса.
- `APP_BASE_URL` — публичный внешний URL приложения, который попадает в `descriptor.xml` (`iframe`, `widgets`, `popup`).
- `APP_ID`, `APP_UID`, `APP_SECRET_KEY` — идентификаторы и секрет приложения Marketplace.
- `APP_ENCRYPT_KEY` — ключ шифрования чувствительных полей в SQLite (ровно 64 hex-символа).
- `SESSION_SECRET` — секрет подписи server-side сессии.
- `APP_DB_PATH` — путь к SQLite-файлу с состоянием приложения, server-side сессиями и replay-маркерами JWT.
- `TRUST_PROXY` — доверие заголовкам `X-Forwarded-*` (`0` локально без прокси, `1` за ingress/reverse proxy).

Полный список переменных окружения (runtime):
- `APP_ID` (`required`) — без значения приложение не стартует.
- `APP_UID` (`required`) — без значения приложение не стартует.
- `APP_SECRET_KEY` (`required`) — без значения приложение не стартует.
- `APP_ENCRYPT_KEY` (`required`) — ровно 64 hex-символа, иначе приложение не стартует.
- `APP_BASE_URL` (`required`) — без значения приложение не стартует.
- `SESSION_SECRET` (`required`) — без значения приложение не стартует.
- `PORT` (`optional`, default: `3000`) — порт HTTP-сервера.
- `LOG_LEVEL` (`optional`, default: `DEBUG`) — уровень логирования (`DEBUG|INFO|WARN|ERROR`).
  При `LOG_LEVEL=DEBUG` логгер использует pretty-формат, при остальных уровнях — JSON.
- `MOYSKLAD_VENDOR_API_ENDPOINT_URL` (`optional`, default: `https://apps-api.moysklad.ru/api/vendor/1.0`) — endpoint Vendor API.
- `MOYSKLAD_JSON_API_ENDPOINT_URL` (`optional`, default: `https://api.moysklad.ru/api/remap/1.2`) — endpoint JSON API 1.2.
- `SESSION_COOKIE_SECURE` (`optional`, default: `true`) — флаг `Secure` для cookie сессии.
- `SESSION_COOKIE_SAME_SITE` (`optional`, default: `none`) — значение `SameSite` (`lax|strict|none`).
- `SESSION_NAME` (`optional`, default: `connect.sid`) — имя cookie server-side сессии.
- `TRUST_PROXY` (`optional`, default: `1`) — значение для `app.set("trust proxy", ...)`.
- `DATA_DIR` (`optional`, default: `./tmp/data`) — базовая директория runtime-данных.
- `APP_DB_PATH` (`optional`, default: `./tmp/data/app.sqlite`) — путь к SQLite-файлу состояния/сессий.

Локальная разработка по умолчанию:
- `PORT=3000`
- `APP_BASE_URL=http://localhost:3000`

Docker-сценарий:
- приложение внутри контейнера слушает `PORT=3000`
- внешний URL остается `APP_BASE_URL=http://localhost:8085`, если контейнер опубликован как `-p 8085:3000`
- для production/OKD: собирайте образ локально и публикуйте в registry (`docker build`, `docker push`)

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
- Получение данных открытого объекта через `/utils/get-object` с проверкой `contextNonce`
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
- В сессии хранится один активный `userContext`: `uid`, `accountId`, `fio`, `isAdmin`, `contextNonce`, `createdAt`, `expiresAt`.
- Исходный `contextKey` в сессии не хранится и после entry-запроса заменяется на `contextNonce` для backend-запросов.
- `expiresAt` обновляется после успешной проверки `contextNonce`; устаревший активный контекст удаляется при чтении.
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
- `POST /utils/update-settings` — параметры формы, включая `contextNonce`
- `POST /utils/get-object?entity=...` — JSON body с `contextNonce` и `objectId`

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

## Работа с контекстом пользователя

`contextKey` — это opaque-token, который МойСклад передает в URL iframe/виджета при открытии страницы. Приложение не должно разбирать его содержимое или использовать как постоянный идентификатор пользователя.

Последовательность работы:
- Хост-окно открывает `GET /entry/iframe?contextKey=...` или `GET /entry/widget-...?contextKey=...`.
- Приложение обращается к Vendor API, чтобы получить `uid`, `accountId` и права пользователя.
- Приложение сохраняет в server-side сессии активный контекст пользователя: `uid`, `accountId`, `fio`, `isAdmin`, `contextNonce`, `createdAt`, `expiresAt`.
- Исходный `contextKey` в сессии не хранится и больше не используется. В шаблоны iframe/виджета передается только `contextNonce`.
- Запросы из iframe/виджета (`POST /utils/update-settings`, `POST /utils/get-object`) передают `contextNonce`.
- Backend принимает запрос только если `contextNonce` совпадает с активным контекстом в текущей сессии. Если `contextNonce` отсутствует, устарел или не совпал, возвращается `401`.

Когда меняется `contextNonce`:
- Если повторно открыть iframe/виджет для того же `uid`, `accountId` и `isAdmin`, то `contextNonce` переиспользуется.
- Если изменился пользователь, аккаунт или признак администратора, `contextNonce` обновляется.

Когда завершается сессия:
- Исходное время жизни сессии (TTL) равно 2 часам (`USER_CONTEXT_SESSION_TTL_SECONDS`).
- TTL скользящий: пока iframe/виджет делает backend-запросы, сессия продлевается. Если пользователь не совершает никаких действий в течение TTL, сессия завершается.

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
- `src/features/entry/*` — feature-based страницы: `view.ejs`, `client.ts`, `styles.css`
- `public/assets/entry/*` — generated frontend assets, собираются из `src/features/entry/*`

Runtime paths:
- В production приложение читает шаблоны из `dist/features` и статику из `dist/public/assets`.
- В dev-режиме (`npm run dev`) используются `src/features` и `public/assets`.

Состояние и безопасность:
- `src/lib/domain/app-instance.ts` — модель состояния установки приложения
- `src/lib/domain/app-instance-sqlite-repository.ts` — SQLite-хранение состояния установки приложения
- `src/lib/session/sqlite-session-store.ts` — SQLite-хранение server-side сессий
- `src/lib/session/user-context.ts` — bootstrap user context по `contextKey` и проверка backend-запросов по `contextNonce`
- `src/lib/security/security.ts` — утилиты шифрования чувствительных данных
- `src/lib/security/jwt-replay-repository.ts` — SQLite-хранение replay-маркеров JWT `jti`

Утилиты:
- `src/utils/descriptor.ts` — генерация `descriptor.xml`
- `src/utils/router.ts` — backend endpoints настроек и чтения объектов

CLI-утилиты (запускаются только вручную через npm scripts):
- `src/cli-utils/generate-jwt.ts` — генерация service JWT для вызовов Vendor API.
- `src/cli-utils/generate-descriptor.ts` — генерация `descriptor.xml` в stdout.

## Создание черновика решения в личном кабинете

Перейдите в личный кабинет в раздел Решения https://apps.moysklad.ru/cabinet/application

Нажмите кнопку `Создать решение` и заполните необходимые поля. В качестве дескриптора можно использовать заглушку вида:

```xml
<ServerApplication xsi:schemaLocation="https://apps-api.moysklad.ru/xml/ns/appstore/app/v2 https://apps-api.moysklad.ru/xml/ns/appstore/app/v2/application-v2.xsd" xmlns="https://apps-api.moysklad.ru/xml/ns/appstore/app/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <access>
        <resource>https://online.moysklad.ru/api/remap/1.2</resource>
        <scope>admin</scope>
    </access>
    <vendorApi>
        <endpointBase>https://example.com/vendor</endpointBase>
    </vendorApi>
</ServerApplication>
```

Сохраните черновик и скопируйте значения `APP_ID`, `APP_UID`, `APP_SECRET_KEY` с вкладки Учетные данные в .env файл.

## Отладка черновика через cloudflared

Скачайте и установите последнюю версию клиента https://github.com/cloudflare/cloudflared

Создайте Quick Tunnel, выполнив в отдельном терминале

```bash
cloudflared tunnel --protocol http2 --edge-ip-version 4 --url http://localhost:3000
```

Сохраните выданный временный адрес в переменной `APP_BASE_URL` в .env файле. Пример:

```
APP_BASE_URL=https://gateway-mazda-titled-easy.trycloudflare.com 
```

Сгенерируйте дескриптор через `npm run cli:generate-descriptor` и сохраните его в личном кабинете в карточке черновика.

После этого можно устанавливать и отлаживать решение в каталоге МоегоСклада, перейдя по адресу `https://online.moysklad.ru/app/#apps?id=<APP_ID>`.