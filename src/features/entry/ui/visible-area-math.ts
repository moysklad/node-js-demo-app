/** Видимая часть страницы в координатах iframe (px от верха документа). */
export type VisibleArea = { top: number; height: number };

/**
 * Сводит видимые куски маячков (intersectionRect каждого — в координатах iframe) в один прямоугольник.
 * Возвращает null, если ни один маячок не виден: iframe целиком за экраном, прошлое значение остается.
 */
export function mergeVisibleRects(rects: ReadonlyArray<{ top: number; bottom: number }>): VisibleArea | null {
  if (rects.length === 0) {
    return null;
  }

  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.bottom);
  }

  return { top: Math.round(top), height: Math.round(bottom - top) };
}
