import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { Snackbar } from "@moysklad/uikit/components/Snackbar";
import "./theme.css";

/**
 * Данные страницы сервер кладет в <script type="application/json" id="page-data">
 * (см. view.ejs и pageDataJson в src/lib/http/page-data.ts). Страницы без серверных
 * данных (popup) этого тега не имеют.
 */
export function readPageData<T>(): T {
  const element = document.getElementById("page-data");
  return (element?.textContent ? JSON.parse(element.textContent) : {}) as T;
}

export function mount<T extends object>(Page: ComponentType<{ data: T }>): void {
  const root = document.getElementById("root");

  if (!root) {
    throw new Error("Не найден контейнер #root");
  }

  createRoot(root).render(
    <Snackbar>
      <Page data={readPageData<T>()} />
    </Snackbar>
  );
}
