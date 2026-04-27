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

- `Node.js 22`
- `TypeScript`
- `Express 5`
- `EJS`
- `express-session` (server-side sessions, в демо используется файловый store)
- `axios`
- `zod`

## Виджеты

Решение встраивает виджеты на следующие экраны:
- `document.customerorder.edit`
- `document.invoiceout.edit`

Виджеты демонстрируют:
- Получение контекста пользователя (`uid`, `fio`) по `contextKey`
- Получение данных открытого объекта через `/utils/get-object`
- Работу SDK-фич: `open-feedback`, `dirty-state`, `save-handler`, `update-provider`, `validation-feedback`
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

## Основные HTTP routes

Service routes:
- `GET /health`
- `GET /ready`
- `GET /descriptor.xml`

Entry routes:
- `GET /entry/iframe?contextKey=...`
- `GET /entry/widget-customerorder?contextKey=...`
- `GET /entry/widget-invoiceout?contextKey=...`
- `GET /entry/popup`

Backend utility routes:
- `POST /utils/update-settings`
- `GET /utils/get-object?entity=...&contextKey=...&objectId=...`

Vendor endpoint routes:
- `PUT /api/vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId`
- `GET /api/vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId`
- `POST /api/vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId`
- `DELETE /api/vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId`
- `POST /api/vendor-endpoint/api/moysklad/vendor/1.0/apps/:appId/:accountId/button`

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
