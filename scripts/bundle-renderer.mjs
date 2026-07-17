/**
 * Bundle renderer for browser (sandbox, no nodeIntegration).
 * Packs marked / highlight.js / dompurify into dist/renderer/main.js
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await esbuild.build({
  entryPoints: [path.join(root, "src/renderer/main.ts")],
  bundle: true,
  outfile: path.join(root, "dist/renderer/main.js"),
  format: "esm",
  platform: "browser",
  target: ["chrome120"],
  sourcemap: true,
  logLevel: "info",
  // marked / hljs / dompurify 打进包
  mainFields: ["browser", "module", "main"],
});

console.log("bundled renderer → dist/renderer/main.js");
