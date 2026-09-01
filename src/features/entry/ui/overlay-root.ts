import { observeVisibleArea } from "./visible-area";

const OVERLAY_ROOT_ID = "overlay-root";

/**
 * Контейнер для оверлеев кита с position: fixed (Snackbar, Modal, Sidepage).
 *
 * Внутри растущего iframe fixed считается от всего iframe: снекбар прибит к его верху, модалка —
 * к его середине, и при скролле страницы МоегоСклада они уезжают за экран. Контейнер занимает ровно
 * видимую часть iframe (см. observeVisibleArea) и через contain: layout становится containing block
 * для fixed-потомков — кит об этом не знает, ему просто передают элемент: Snackbar domRoot,
 * Modal.Provider portalElement, Sidepage — через createPortal. Стили — .overlay-root в theme.css.
 *
 * Оверлеи, привязанные к триггеру (Dropdown, Datepicker, Tooltip), сюда переносить не нужно:
 * они позиционируются от элемента и едут вместе с контентом.
 */
export function ensureOverlayRoot(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ROOT_ID);

  if (existing) {
    return existing;
  }

  const root = document.createElement("div");
  root.id = OVERLAY_ROOT_ID;
  root.className = "overlay-root";
  document.body.appendChild(root);

  if (window.parent === window) {
    // Вне iframe (локальная разработка) скроллится сам документ — обычный fixed на весь экран.
    root.classList.add("overlay-root--viewport");
    return root;
  }

  observeVisibleArea((area) => {
    root.style.setProperty("--visible-top", `${area.top}px`);
    root.style.setProperty("--visible-height", `${area.height}px`);
  });

  return root;
}
