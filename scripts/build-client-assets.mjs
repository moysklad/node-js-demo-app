import { build } from "esbuild";
import { mkdir, cp, rm } from "node:fs/promises";

await rm("public/assets/entry", { recursive: true, force: true });

await build({
  entryPoints: {
    iframe: "src/features/entry/iframe/client.ts",
    popup: "src/features/entry/popup/client.ts",
    widget: "src/features/entry/widget/client.ts",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outdir: "public/assets/entry",
  sourcemap: false,
  minify: false,
  logLevel: "info",
});

await mkdir("public/assets/entry", { recursive: true });
await cp("src/features/entry/iframe/styles.css", "public/assets/entry/iframe.css");
await cp("src/features/entry/popup/styles.css", "public/assets/entry/popup.css");
await cp("src/features/entry/widget/styles.css", "public/assets/entry/widget.css");
