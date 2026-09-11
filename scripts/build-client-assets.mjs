import * as esbuild from "esbuild";
import { rm } from "node:fs/promises";

// Браузерные бандлы точек входа МоегоСклада: iframe, popup, виджет.
// React и @moysklad/uikit попадают в общий chunk (splitting), CSS кита esbuild
// складывает рядом с бандлом (iframe.css, popup.css, widget.css).
const watch = process.argv.includes("--watch");
const outdir = "public/assets/entry";

await rm(outdir, { recursive: true, force: true });

const context = await esbuild.context({
  entryPoints: {
    iframe: "src/features/entry/iframe/client/main.tsx",
    popup: "src/features/entry/popup/client/main.tsx",
    widget: "src/features/entry/widget/client/main.tsx",
  },
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  outdir,
  // Шрифты отдаются как статика из public/assets — в бандл их не тянем.
  external: ["/assets/*"],
  minify: process.env.NODE_ENV === "production",
  sourcemap: !watch && process.env.NODE_ENV === "production" ? false : "linked",
  define: { "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development") },
  logLevel: "info",
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
