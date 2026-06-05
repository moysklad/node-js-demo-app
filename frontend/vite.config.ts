import path from "node:path";
import react from "@vitejs/plugin-react";

const dirname = path.resolve(process.cwd(), "frontend");

export default {
  root: dirname,
  base: "/frontend/",
  plugins: [react({})],
  server: {
    port: 5173,
  },
  build: {
    outDir: path.join(dirname, "dist"),
    emptyOutDir: true,
  },
};
