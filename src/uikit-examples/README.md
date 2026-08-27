# Модуль «Примеры UI Kit»

Вкладка основного iframe с живыми примерами компонентов `@moysklad/uikit` — тех, что чаще всего
нужны в интерфейсе решения. Показывает, что UI Kit — рекомендуемая основа интерфейса: пользователь
получает привычный вид и поведение элементов МоегоСклада.

## Что демонстрирует

- Переключатель ширины «Основной iframe / Виджет, 400px»: одни и те же компоненты в двух контекстах
  платформы. Главный iframe занимает всю рабочую область и растягивается по высоте
  (`<expand>true</expand>` в дескрипторе + `sdk.autoResizeIframe()`); виджет — колонка 400px
  фиксированной высоты из дескриптора, скролл внутри — на стороне решения.
- Секции с демо и фрагментом кода под копирование (кнопка «Показать код»).

## Карта файлов

| Файл                              | Что внутри                                                                              |
|-----------------------------------|-----------------------------------------------------------------------------------------|
| `client/ExamplesTab.tsx`          | Шапка вкладки, переключатель ширины, список секций                                      |
| `client/Section.tsx`              | Карточка секции: заголовок, описание, демо, фрагмент кода                               |
| `client/sections/TypographySection.tsx` | `Text` (варианты и цветовые токены), `Link`                                       |
| `client/sections/ButtonsSection.tsx`    | `Button`: варианты, размеры, загрузка, иконка, `stretch`                          |
| `client/sections/FormSection.tsx`       | Форма настроек: `Input`, `Select`, `Multiselect`, `Datepicker`, `SegmentButton`, `Radiobutton`, `Checkbox`, `Textfield`, `SearchInput`, валидация + `Snackbar` |
| `client/sections/FeedbackSection.tsx`   | `Snackbar`, `Banner`, `Badge`, `Counter`, `Chip`, `Spinner`, `Skeleton`, `EmptyState` |
| `client/sections/OverlaysSection.tsx`   | `Modal`, `Sidepage`, `Dropdown`, `Help`, `Hint`, `Tooltip` + ограничения iframe   |
| `client/sections/TableSection.tsx`      | `data-grid` `Table` на `@tanstack/react-table`, `Pagination`                      |
| `client/sections/IconsSection.tsx`      | Иконки `@moysklad/uikit/icon`                                                      |
| `client/sections/DataSection.tsx`       | `LabelValue`, `Tabs`, `Breadcrumbs`, `Listing`                                    |

## Как взять секцию к себе

1. Скопируйте файл секции из `client/sections/` — каждая самодостаточна: свои данные, свой state,
   импорты только из React и кита. Обертку `Section` замените своей разметкой или скопируйте тоже.
2. Импорты оставьте точечными: `@moysklad/uikit/components/<X>`, `@moysklad/uikit/icon`,
   `@moysklad/uikit/data-grid`. Импорт из корня пакета тянет всю библиотеку.
3. Для `TableSection` добавьте в `package.json` `@tanstack/react-table` той же версии, что у кита
   (в этом решении — `8.21.3`): `Table` принимает таблицу, подготовленную `useReactTable`.
4. `useSnackbar()` работает только внутри `<Snackbar>` — в этом решении провайдер уже стоит в
   `src/features/entry/ui/mount.tsx`.

## Платформенные особенности

- Оверлеи (`Modal`, `Sidepage`, `Dropdown`) рисуются внутри страницы решения и не выходят за рамку
  iframe. В виджете 400px `Sidepage` перекрывает весь виджет — используйте `Modal` или откройте
  попап через `sdk.showPopup()`.
- В главном iframe высота подстраивается под контент, поэтому раскрытый код или длинная таблица
  просто удлиняют страницу; в виджете высота фиксирована — контент скроллится внутри.
- Таблица в узкой колонке требует горизонтального скролла контейнера (`overflow-x: auto`).

## Где модуль подключается к общему коду

Все такие места помечены: `grep -rn "feature:uikit-examples" src/`.

- `src/features/entry/iframe/client/IframePage.tsx` — `Tabs.Item` и рендер `ExamplesTab`.

## Как убрать модуль

Удалите каталог `src/uikit-examples/`, две помеченные строки в `IframePage.tsx` и зависимость
`@tanstack/react-table` из `package.json` (она нужна только `TableSection`).
Сам UI Kit при этом остается: на нем построены все страницы решения, см. раздел «UI Kit» в корневом `README.md`.
