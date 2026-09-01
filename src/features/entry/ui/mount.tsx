import type { ComponentType, ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { Snackbar } from "@moysklad/uikit/components/Snackbar";
import { ensureOverlayRoot } from "./overlay-root";
import "./theme.css";

/**
 * Данные страницы сервер кладет в <script type="application/json" id="page-data">
 * (см. sendPage в src/lib/http/send-page.ts); тип — page-data.ts страницы.
 */
export function readPageData<T>(): T {
  const element = document.getElementById("page-data");

  if (!element?.textContent) {
    throw new Error("Не найдены данные страницы #page-data");
  }

  return JSON.parse(element.textContent) as T;
}

/** Страница с серверными данными (iframe, виджет). */
export function mount<T extends object>(Page: ComponentType<{ data: T }>): void {
  const data = readPageData<T>();
  render(<Page data={data} />);
}

/** Страница без серверных данных (popup). */
export function mountPage(Page: ComponentType): void {
  render(<Page />);
}

/**
 * Snackbar кита — один на страницу: useSnackbar() работает только под ним. Снекбары он рисует
 * в контейнер видимой области iframe (см. ui/overlay-root.tsx), иначе при скролле страницы
 * МоегоСклада они остаются за экраном. Modal.Provider здесь ставить нельзя — он унесет в контейнер
 * всю страницу; Modal и Sidepage оборачивают в <OverlayPortal> по месту.
 */
function render(page: ReactElement): void {
  const root = document.getElementById("root");

  if (!root) {
    throw new Error("Не найден контейнер #root");
  }

  createRoot(root).render(<Snackbar domRoot={ensureOverlayRoot()}>{page}</Snackbar>);
}
