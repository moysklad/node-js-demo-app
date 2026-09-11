/**
 * Сериализация данных страницы для вставки в <script type="application/json" id="page-data">.
 * JSON внутри <script> нельзя вставлять как есть: последовательность "</script>" в строке
 * закроет тег. Экранируем "<" и разделители строк U+2028/U+2029, которые JSON допускает,
 * а JavaScript-парсер старых браузеров — нет.
 */
export function pageDataJson(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
