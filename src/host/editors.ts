/**
 * 探测本机可用的代码编辑器（VS Code / Cursor 等），供「打开位置」下拉使用。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type DetectedEditor = {
  /** 配置值：code | cursor | codium | windsurf | … */
  id: string;
  label: string;
  /** 可执行路径或 PATH 中的命令名 */
  command: string;
  available: boolean;
};

type Candidate = {
  id: string;
  label: string;
  /** PATH / where 探测用的命令名 */
  bins: string[];
  /** 常见安装路径（绝对路径候选） */
  pathHints?: () => string[];
};

function winPathHints(relativeBins: string[]): string[] {
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const prog = process.env.ProgramFiles ?? "C:\\Program Files";
  const progX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const out: string[] = [];
  for (const root of [local, prog, progX86]) {
    for (const rel of relativeBins) {
      out.push(path.join(root, rel));
    }
  }
  return out;
}

const CANDIDATES: Candidate[] = [
  {
    id: "code",
    label: "Visual Studio Code",
    bins: ["code", "code.cmd"],
    pathHints: () =>
      process.platform === "win32"
        ? winPathHints([
            "Programs\\Microsoft VS Code\\bin\\code.cmd",
            "Microsoft VS Code\\bin\\code.cmd",
          ])
        : process.platform === "darwin"
          ? ["/usr/local/bin/code", "/opt/homebrew/bin/code"]
          : ["/usr/bin/code", "/usr/local/bin/code"],
  },
  {
    id: "cursor",
    label: "Cursor",
    bins: ["cursor", "cursor.cmd"],
    pathHints: () =>
      process.platform === "win32"
        ? winPathHints([
            "Programs\\cursor\\resources\\app\\bin\\cursor.cmd",
            "Programs\\Cursor\\resources\\app\\bin\\cursor.cmd",
          ])
        : process.platform === "darwin"
          ? ["/usr/local/bin/cursor", "/opt/homebrew/bin/cursor"]
          : ["/usr/bin/cursor", "/usr/local/bin/cursor"],
  },
  {
    id: "codium",
    label: "VSCodium",
    bins: ["codium", "codium.cmd"],
    pathHints: () =>
      process.platform === "win32"
        ? winPathHints(["Programs\\VSCodium\\bin\\codium.cmd"])
        : [],
  },
  {
    id: "windsurf",
    label: "Windsurf",
    bins: ["windsurf", "windsurf.cmd"],
    pathHints: () =>
      process.platform === "win32"
        ? winPathHints([
            "Programs\\Windsurf\\bin\\windsurf.cmd",
            "Programs\\windsurf\\bin\\windsurf.cmd",
          ])
        : [],
  },
];

function resolveOnPath(bin: string): string | null {
  const tool = process.platform === "win32" ? "where" : "which";
  try {
    const r = spawnSync(tool, [bin], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5_000,
    });
    if (r.status !== 0) return null;
    const first = (r.stdout ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

function resolveCandidate(c: Candidate): DetectedEditor | null {
  for (const bin of c.bins) {
    const hit = resolveOnPath(bin);
    if (hit) {
      return { id: c.id, label: c.label, command: hit, available: true };
    }
  }
  for (const p of c.pathHints?.() ?? []) {
    try {
      if (fs.existsSync(p)) {
        return { id: c.id, label: c.label, command: p, available: true };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** 返回本机探测到的编辑器（仅 available） */
export function detectEditors(): DetectedEditor[] {
  const out: DetectedEditor[] = [];
  for (const c of CANDIDATES) {
    const hit = resolveCandidate(c);
    if (hit) out.push(hit);
  }
  return out;
}

/** 解析配置的 openTarget → 实际启动命令 */
export function resolveEditorCommand(
  openTarget: string | undefined,
  editors?: DetectedEditor[],
): string | null {
  const list = editors ?? detectEditors();
  const t = (openTarget ?? "").trim().toLowerCase();
  if (!t || t === "explorer") return null;
  // 遗留值 "editor"：优先 Cursor，再 VS Code，再第一个探测到的
  if (t === "editor") {
    return (
      list.find((e) => e.id === "cursor")?.command ??
      list.find((e) => e.id === "code")?.command ??
      list[0]?.command ??
      process.env.GROK_DESKTOP_EDITOR ??
      null
    );
  }
  const byId = list.find((e) => e.id === t);
  if (byId) return byId.command;
  // 允许直接存 command 路径
  if (t.includes("/") || t.includes("\\") || t.endsWith(".cmd") || t.endsWith(".exe")) {
    return openTarget!.trim();
  }
  // 未知 id：当命令名用
  return openTarget!.trim() || null;
}
