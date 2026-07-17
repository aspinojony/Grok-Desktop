/**
 * 打包前检查 agent-bin 是否具备可执行二进制。
 * 无二进制则 exit 1，避免打出「空 agent」安装包。
 *
 *   npm run check:agent
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
const binName = isWin ? "grok.exe" : "grok";
const destDir = path.join(appRoot, "agent-bin");
const dest = path.join(destDir, binName);
const versionPath = path.join(destDir, "VERSION.txt");

/** 低于此大小（字节）视为占位/损坏，而非真实 agent */
const MIN_BYTES = 1024 * 1024;

function fail(msg) {
  console.error(`[check-agent-bin] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(dest)) {
  fail(
    `缺少 ${path.relative(appRoot, dest)}。\n` +
      `请先: npm run sync:agent\n` +
      `或手动复制 grok 二进制到 agent-bin/`,
  );
}

let st;
try {
  st = fs.statSync(dest);
} catch (e) {
  fail(`无法读取 ${dest}: ${e?.message ?? e}`);
}

if (!st.isFile()) {
  fail(`${dest} 不是文件`);
}

if (st.size < MIN_BYTES) {
  fail(
    `${binName} 体积过小 (${st.size} bytes)，疑似占位文件。\n` +
      `请重新 npm run sync:agent`,
  );
}

if (!fs.existsSync(versionPath)) {
  console.log(
    `[check-agent-bin] 警告: 无 VERSION.txt。建议 npm run sync:agent 以记录版本与 sha256。`,
  );
} else {
  const text = fs.readFileSync(versionPath, "utf8");
  const ver = text.match(/^version=(.*)$/m)?.[1]?.trim() || "(empty)";
  const sha = text.match(/^sha256=(.*)$/m)?.[1]?.trim() || "";
  console.log(
    `[check-agent-bin] VERSION: version=${ver}` +
      (sha ? ` sha256=${sha.slice(0, 16)}…` : ""),
  );
}

console.log(
  `[check-agent-bin] OK ${binName} ${(st.size / (1024 * 1024)).toFixed(1)} MB`,
);
