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

## Технологии

- `Node.js 22` — runtime для серверного приложения.
- `TypeScript` — статическая типизация и более безопасный рефакторинг.
- `Express 5` — HTTP-сервер, маршрутизация и middleware-цепочка.
- `EJS` — серверный рендеринг iframe/widget/popup страниц.
- `express-session` — server-side сессии для хранения user context между запросами.
- `axios` — HTTP-клиент для вызовов Vendor API и JSON API.
- `zod` — валидация конфигурации и входящих payload’ов.

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

В проекте используется server-side сессия (`express-session`) с файловым store:
- При первом запросе создается `sid`, а данные сессии сохраняются в `SESSION_DIR` как JSON-файл.
- В сессии хранится bucket `userContext` (контекст пользователя по `contextKey`) из `src/lib/user-context.ts`.
- Для каждого `contextKey` обновляется `expiresAt`; устаревшие записи отбрасываются при чтении.
- В `file-session-store` при `set/touch` периодически запускается очистка истекших файлов с ограничением по количеству файлов за проход.

## Основные HTTP routes

Service routes:
- `GET /health` — liveness-check: процесс запущен и отвечает HTTP.
- `GET /ready` — readiness-check: проверка обязательной конфигурации и доступности хранилища.
- `GET /descriptor.xml` — выдача descriptor для публикации/синхронизации решения в каталоге.

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

## Структура проекта

Основные entrypoints:
- `src/server.ts` — запуск HTTP-сервера
- `src/app.ts` — создание Express-приложения и регистрация middleware/routes

API и интеграции:
- `src/api/vendor-endpoint.ts` — обработка lifecycle событий и button callbacks
- `src/api/button.ts` — формирование action-ответов для кнопок
- `src/lib/vendor-api.ts` — клиент Vendor API (context/status)
- `src/lib/json-api.ts` — клиент JSON API 1.2

UI и entry:
- `src/entry/router.ts` — `iframe/widget/popup` routes
- `src/views/entry/*` — EJS-шаблоны страниц
- `public/assets/entry/*` — фронтенд-стили/скрипты

Состояние и безопасность:
- `src/lib/app-instance.ts` — файловое хранение состояния установки приложения
- `src/lib/file-session-store.ts` — файловое хранение сессий
- `src/lib/user-context.ts` — загрузка/кеширование user context по `contextKey`
- `src/lib/security.ts` — утилиты безопасной записи и replay-защиты JWT `jti`

Утилиты:
- `src/utils/descriptor.ts` — генерация `descriptor.xml`
- `src/utils/router.ts` — backend endpoints настроек и чтения объектов

CLI-утилиты (запускаются только вручную через npm scripts):
- `src/cli-utils/generate-jwt.ts` — генерация service JWT для вызовов Vendor API.
- `src/cli-utils/generate-descriptor.ts` — генерация `descriptor.xml` в stdout.
