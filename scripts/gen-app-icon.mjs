/**
 * 用 Electron 将 assets/icon.svg 栅格化为 icon.png / icon-32.png（窗口与托盘）。
 * icon.png 固定 1024×1024，满足 electron-builder macOS 要求（≥512）。
 * 用法：npx electron scripts/gen-app-icon.mjs
 *
 * 注意：Retina 上 capturePage 可能按 2× 出图，必须再 resize 到目标像素。
 */
import { app, BrowserWindow, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svgPath = path.join(root, "assets", "icon.svg");
const outPng = path.join(root, "assets", "icon.png");
const outPng32 = path.join(root, "assets", "icon-32.png");

const sizes = [
  { size: 1024, out: outPng },
  { size: 32, out: outPng32 },
];

async function rasterize(svg, size) {
  // 逻辑窗口按目标尺寸；capture 后强制 resize，避免 Retina 2×
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
    },
  });
  const html = `<!DOCTYPE html><html><head><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden}
    svg{width:${Math.round(size * 0.88)}px;height:${Math.round(size * 0.88)}px;display:block}
  </style></head><body>${svg.replace(/fill="#111111"/g, 'fill="#0b0d12"')}</body></html>`;
  await win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );
  await new Promise((r) => setTimeout(r, 200));
  const captured = await win.webContents.capturePage();
  win.destroy();
  const resized = captured.resize({ width: size, height: size, quality: "best" });
  return resized.toPNG();
}

app.whenReady().then(async () => {
  const svg = fs.readFileSync(svgPath, "utf8");
  for (const { size, out } of sizes) {
    const png = await rasterize(svg, size);
    if (!png || png.length < 64) {
      throw new Error(`icon rasterize failed for ${size}px (empty buffer)`);
    }
    fs.writeFileSync(out, png);
    const check = nativeImage.createFromBuffer(png).getSize();
    console.log("wrote", out, `${check.width}x${check.height}`, `${png.length} bytes`);
  }
  app.quit();
});

app.on("window-all-closed", (e) => e.preventDefault());
