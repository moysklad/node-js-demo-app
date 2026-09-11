import type { Response } from "express";
import { pageDataJson } from "./page-data";

/** Имя бандла страницы: scripts/build-client-assets.mjs собирает public/assets/entry/<bundle>.{js,css}. */
export type PageBundle = "iframe" | "popup" | "widget";

export type PageOptions = {
  title: string;
  bundle: PageBundle;
  /** Данные страницы для React (тип — page-data.ts страницы). У страниц без серверных данных (popup) отсутствуют. */
  pageData?: object;
};

/**
 * HTML-оболочка React-страницы: <div id="root">, данные в <script id="page-data"> и бандл.
 * Шаблонизатор здесь не нужен: единственное динамическое место — JSON, который экранирует pageDataJson().
 */
export function sendPage(res: Response, page: PageOptions): void {
  const pageDataScript =
    page.pageData === undefined
      ? ""
      : `<script type="application/json" id="page-data">${pageDataJson(page.pageData)}</script>\n`;

  res.type("html").send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}</title>
<link rel="stylesheet" href="/assets/entry/${page.bundle}.css">
</head>
<body>
<div id="root"></div>
${pageDataScript}<script type="module" src="/assets/entry/${page.bundle}.js"></script>
</body>
</html>
`);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
