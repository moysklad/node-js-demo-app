import { mergeVisibleRects, type VisibleArea } from "./visible-area-math";

export type { VisibleArea };

/** Шаг маячков по высоте документа. Точность отслеживания — STEP × минимальный интервал порогов (≈40px). */
const STEP = 160;
const THRESHOLDS = [0, 0.25, 0.5, 0.75, 1];
const MAX_SENTINELS = 500;

/**
 * Следит, какая часть iframe сейчас на экране пользователя.
 *
 * Главный iframe решения растет под контент (autoResizeIframe), скроллится страница МоегоСклада,
 * и iframe не знает, куда уехал экран: событий скролла родителя нет, а position: fixed внутри
 * iframe считается от всего iframe. Единственный кросс-доменный источник — IntersectionObserver:
 * intersectionRect приходит в координатах iframe, обрезанный видимой областью верхнего окна.
 * Наблюдать сам документ нельзя: пока iframe выше экрана, доля видимости при скролле не меняется
 * и observer молчит. Поэтому по высоте документа раскладываются невидимые маячки с шагом STEP,
 * и видимая область собирается из их видимых кусков.
 *
 * onChange вызывается с текущей областью сразу и при каждом изменении; возвращает функцию остановки.
 * Не React и не кит — можно использовать с любым UI.
 */
export function observeVisibleArea(onChange: (area: VisibleArea) => void): () => void {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none";
  document.body.appendChild(layer);

  const visibleRects = new Map<Element, { top: number; bottom: number }>();
  let lastArea: VisibleArea | null = null;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visibleRects.set(entry.target, { top: entry.intersectionRect.top, bottom: entry.intersectionRect.bottom });
        } else {
          visibleRects.delete(entry.target);
        }
      }

      const area = mergeVisibleRects([...visibleRects.values()]);

      if (area && (area.top !== lastArea?.top || area.height !== lastArea?.height)) {
        lastArea = area;
        onChange(area);
      }
    },
    { threshold: THRESHOLDS }
  );

  function rebuildSentinels(): void {
    observer.disconnect();
    visibleRects.clear();
    layer.replaceChildren();

    const count = Math.min(MAX_SENTINELS, Math.max(1, Math.ceil(document.documentElement.scrollHeight / STEP)));

    for (let index = 0; index < count; index += 1) {
      const sentinel = document.createElement("div");
      sentinel.style.cssText = `position:absolute;left:0;width:1px;top:${index * STEP}px;height:${STEP}px`;
      layer.appendChild(sentinel);
      observer.observe(sentinel);
    }
  }

  // Высота страницы меняется (вкладки, раскрытый код, таблица) — маячки должны покрывать ее целиком.
  const resizeObserver = new ResizeObserver(rebuildSentinels);
  resizeObserver.observe(document.documentElement);
  rebuildSentinels();

  return () => {
    resizeObserver.disconnect();
    observer.disconnect();
    layer.remove();
  };
}
