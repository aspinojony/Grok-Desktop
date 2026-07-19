/**
 * 对齐 CLI 跨会话 Memory：唯一真相在 GROK_HOME/memory/
 * （Desktop 即 ~/.grok-desktop/memory/：Global MEMORY.md + workspace 子目录 + sessions）。
 *
 * 开关：desktop/settings.json experimentalMemory + 同步 config.toml [memory]
 * + 子进程 GROK_MEMORY（见 host 透传）。
 *
 * 旧 desktop/memory/entries.json 仅作只读遗留提示，不再是产品主路径。
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { desktopDir, ensureDesktopDirs, grokHomeDir } from "./paths.js";
import { readDesktopConfig, writeDesktopConfig } from "./extensibility.js";

export type MemorySource = "global" | "workspace" | "session";

export interface MemoryFileEntry {
  id: string;
  source: MemorySource;
  label: string;
  path: string;
  /** workspace 目录名（slug-hash），global/session 可能为空 */
  workspaceKey?: string;
  size: number;
  mtimeMs: number;
  /** 是否为当前 cwd 推断的 workspace */
  current?: boolean;
  /** session 文件可删；global/workspace MEMORY.md 不可经此 API 删 */
  deletable: boolean;
}

export interface MemoryStatus {
  enabled: boolean;
  /** CLI 同源根目录 ~/.grok-desktop/memory */
  storePath: string;
  configTomlPath: string;
  fileCount: number;
  globalExists: boolean;
  workspaceCount: number;
  sessionFileCount: number;
  /** 遗留 JSON 条数（若仍存在） */
  legacyEntryCount: number;
  legacyStorePath: string;
  productNote: string;
  message?: string;
  /** 需重新附着/新建会话后 agent 才吃到开关 */
  needsRelaunch?: boolean;
}

export interface MemoryBrowseResult {
  files: MemoryFileEntry[];
  currentWorkspaceKey?: string;
  cwd?: string;
}

export interface MemoryReadResult {
  path: string;
  source: MemorySource;
  content: string;
  truncated: boolean;
}

const MAX_PREVIEW_CHARS = 200_000;

function agentMemoryRoot(home?: string): string {
  return path.join(grokHomeDir(home), "memory");
}

function configTomlPath(home?: string): string {
  return path.join(grokHomeDir(home), "config.toml");
}

function legacyEntriesPath(home?: string): string {
  return path.join(desktopDir(home), "memory", "entries.json");
}

function countLegacyEntries(home?: string): number {
  const f = legacyEntriesPath(home);
  if (!fs.existsSync(f)) return 0;
  try {
    const data = JSON.parse(fs.readFileSync(f, "utf8")) as {
      entries?: unknown[];
    };
    return Array.isArray(data.entries) ? data.entries.length : 0;
  } catch {
    return 0;
  }
}

/** 读 settings.json 中的 experimentalMemory */
export function isExperimentalMemoryEnabled(home?: string): boolean {
  const cfg = readDesktopConfig(home);
  return Boolean(cfg.experimentalMemory);
}

/**
 * 同步 [memory] enabled 到 GROK_HOME/config.toml（agent 会读）。
 * 不碰其它段。
 */
export function syncMemoryToml(enabled: boolean, home?: string): void {
  const p = configTomlPath(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  let text = "";
  try {
    if (fs.existsSync(p)) text = fs.readFileSync(p, "utf8");
  } catch {
    text = "";
  }
  const next = upsertMemoryEnabledToml(text, enabled);
  if (next !== text) fs.writeFileSync(p, next, "utf8");
}

function upsertMemoryEnabledToml(text: string, enabled: boolean): string {
  let out = text.replace(/\r\n/g, "\n");
  const lines = out.split("\n");
  let inMemory = false;
  let memoryStart = -1;
  let enabledLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("[")) {
      if (/^\[memory\]\s*$/.test(t)) {
        inMemory = true;
        memoryStart = i;
        enabledLine = -1;
      } else if (inMemory && /^\[memory\./.test(t)) {
        // 子表仍属 memory 命名空间，但 enabled 只写在 [memory]
        inMemory = false;
      } else {
        inMemory = false;
      }
      continue;
    }
    if (inMemory && /^enabled\s*=/.test(t)) {
      enabledLine = i;
    }
  }
  const val = enabled ? "true" : "false";
  if (memoryStart >= 0) {
    if (enabledLine >= 0) {
      lines[enabledLine] = `enabled = ${val}`;
    } else {
      lines.splice(memoryStart + 1, 0, `enabled = ${val}`);
    }
    out = lines.join("\n");
  } else {
    out = out.replace(/\n{3,}/g, "\n\n").trimEnd();
    if (out && !out.endsWith("\n")) out += "\n";
    out += `${out ? "\n" : ""}[memory]\nenabled = ${val}\n`;
  }
  if (!out.endsWith("\n")) out += "\n";
  return out;
}

export function memoryStatus(home?: string): MemoryStatus {
  ensureDesktopDirs(home);
  const storePath = agentMemoryRoot(home);
  const enabled = isExperimentalMemoryEnabled(home);
  const files = listMemoryFiles(home).files;
  const legacyEntryCount = countLegacyEntries(home);
  const productNote =
    "对齐 Grok CLI 跨会话 Memory：存储于 GROK_HOME/memory/（Global MEMORY.md + 各项目 workspace 目录 + sessions）。" +
    "启用后新会话/重新附着会带上 GROK_MEMORY；agent 可检索注入、/flush /dream /remember。" +
    (legacyEntryCount > 0
      ? ` 另有 ${legacyEntryCount} 条旧版 Desktop JSON 笔记（desktop/memory/entries.json），不再注入 agent。`
      : "");

  return {
    enabled,
    storePath,
    configTomlPath: configTomlPath(home),
    fileCount: files.length,
    globalExists: files.some((f) => f.source === "global"),
    workspaceCount: new Set(
      files.filter((f) => f.workspaceKey).map((f) => f.workspaceKey),
    ).size,
    sessionFileCount: files.filter((f) => f.source === "session").length,
    legacyEntryCount,
    legacyStorePath: legacyEntriesPath(home),
    productNote,
    message: enabled
      ? undefined
      : "跨会话 Memory 已关闭（实验特性）。启用后需新开或重新附着会话。",
    needsRelaunch: true,
  };
}

export function memorySetEnabled(enabled: boolean, home?: string): MemoryStatus {
  ensureDesktopDirs(home);
  writeDesktopConfig({ experimentalMemory: enabled }, home);
  syncMemoryToml(enabled, home);
  if (enabled) {
    fs.mkdirSync(agentMemoryRoot(home), { recursive: true });
  }
  return memoryStatus(home);
}

/** 供 Host spawn env 合并 */
export function memoryEnvPatch(home?: string): NodeJS.ProcessEnv {
  return {
    GROK_MEMORY: isExperimentalMemoryEnabled(home) ? "1" : "0",
  };
}

function safeStat(p: string): { size: number; mtimeMs: number } | null {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return null;
    return { size: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return null;
  }
}

function fileId(source: MemorySource, filePath: string): string {
  return `${source}:${filePath}`;
}

/**
 * 粗匹配当前 cwd 对应的 workspace 目录名（slug-*）。
 * 不复刻 blake3：有 origin 时用 org/repo 的 repo 名作 slug 前缀；否则用目录名。
 */
export function guessWorkspaceKey(cwd?: string): string | undefined {
  if (!cwd) return undefined;
  const origin = gitOriginOrgRepo(cwd);
  const slugSource = origin
    ? origin.split("/").pop() || origin
    : path.basename(path.resolve(cwd));
  return slugify(slugSource, 40) || undefined;
}

function gitOriginOrgRepo(cwd: string): string | null {
  try {
    const r = spawnSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    });
    if (r.status !== 0) return null;
    const url = (r.stdout || "").trim();
    if (!url) return null;
    return normalizeGitRemote(url);
  } catch {
    return null;
  }
}

function normalizeGitRemote(url: string): string | null {
  let u = url.trim().replace(/\.git$/i, "");
  // git@host:org/repo
  const scp = u.match(/^git@[^:]+:(.+)$/);
  if (scp) {
    const rest = scp[1].replace(/^\/+/, "");
    const parts = rest.split("/").filter(Boolean);
    if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    return rest || null;
  }
  // https://host/org/repo
  try {
    if (u.includes("://")) {
      const parsed = new URL(u);
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
      }
    }
  } catch {
    /* ignore */
  }
  // ssh://git@host/org/repo
  const parts = u.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }
  return null;
}

function slugify(input: string, maxLen: number): string {
  const slug = input
    .toLowerCase()
    .split("")
    .map((c) => (/[a-z0-9]/.test(c) ? c : "-"))
    .join("");
  let result = "";
  let prevDash = false;
  for (const c of slug) {
    if (c === "-") {
      if (!prevDash) result += "-";
      prevDash = true;
    } else {
      result += c;
      prevDash = false;
    }
  }
  return result.slice(0, maxLen).replace(/^-+|-+$/g, "");
}

export function listMemoryFiles(
  home?: string,
  cwd?: string,
): MemoryBrowseResult {
  const root = agentMemoryRoot(home);
  const files: MemoryFileEntry[] = [];
  const currentKeyPrefix = guessWorkspaceKey(cwd);
  let currentWorkspaceKey: string | undefined;

  if (!fs.existsSync(root)) {
    return { files: [], currentWorkspaceKey, cwd };
  }

  // Global MEMORY.md
  const globalMd = path.join(root, "MEMORY.md");
  const gstat = safeStat(globalMd);
  if (gstat) {
    files.push({
      id: fileId("global", globalMd),
      source: "global",
      label: "MEMORY.md",
      path: globalMd,
      size: gstat.size,
      mtimeMs: gstat.mtimeMs,
      deletable: false,
    });
  }

  let ents: fs.Dirent[] = [];
  try {
    ents = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    ents = [];
  }

  for (const ent of ents) {
    if (!ent.isDirectory()) continue;
    const name = ent.name;
    if (name.startsWith(".") || name.startsWith("tmp")) continue;
    const wsDir = path.join(root, name);
    const isCurrent =
      Boolean(currentKeyPrefix) &&
      (name === currentKeyPrefix || name.startsWith(`${currentKeyPrefix}-`));
    if (isCurrent) currentWorkspaceKey = name;

    const wsMd = path.join(wsDir, "MEMORY.md");
    const wstat = safeStat(wsMd);
    if (wstat) {
      files.push({
        id: fileId("workspace", wsMd),
        source: "workspace",
        label: `${name}/MEMORY.md`,
        path: wsMd,
        workspaceKey: name,
        size: wstat.size,
        mtimeMs: wstat.mtimeMs,
        current: isCurrent,
        deletable: false,
      });
    }

    const sessionsDir = path.join(wsDir, "sessions");
    if (fs.existsSync(sessionsDir)) {
      let sess: string[] = [];
      try {
        sess = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".md"));
      } catch {
        sess = [];
      }
      for (const f of sess) {
        const fp = path.join(sessionsDir, f);
        const st = safeStat(fp);
        if (!st) continue;
        files.push({
          id: fileId("session", fp),
          source: "session",
          label: `${name}/sessions/${f}`,
          path: fp,
          workspaceKey: name,
          size: st.size,
          mtimeMs: st.mtimeMs,
          current: isCurrent,
          deletable: true,
        });
      }
    }
  }

  // Global 优先，再 current workspace，再 mtime 新→旧
  files.sort((a, b) => {
    const rank = (s: MemorySource) =>
      s === "global" ? 0 : s === "workspace" ? 1 : 2;
    if (rank(a.source) !== rank(b.source)) return rank(a.source) - rank(b.source);
    if (Boolean(a.current) !== Boolean(b.current)) return a.current ? -1 : 1;
    return b.mtimeMs - a.mtimeMs;
  });

  return { files, currentWorkspaceKey, cwd };
}

export function memoryReadFile(
  filePath: string,
  home?: string,
): MemoryReadResult {
  const root = path.resolve(agentMemoryRoot(home));
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("path outside memory root");
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error("memory file not found");
  }
  let content = fs.readFileSync(resolved, "utf8");
  let truncated = false;
  if (content.length > MAX_PREVIEW_CHARS) {
    content = content.slice(0, MAX_PREVIEW_CHARS);
    truncated = true;
  }
  let source: MemorySource = "session";
  if (path.basename(resolved) === "MEMORY.md") {
    source =
      path.dirname(resolved) === root ? "global" : "workspace";
  } else if (resolved.includes(`${path.sep}sessions${path.sep}`)) {
    source = "session";
  }
  return { path: resolved, source, content, truncated };
}

/** 仅允许删除 session 日志（对齐 CLI modal） */
export function memoryDeleteFile(filePath: string, home?: string): void {
  const root = path.resolve(agentMemoryRoot(home));
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("path outside memory root");
  }
  if (!resolved.includes(`${path.sep}sessions${path.sep}`)) {
    throw new Error("only session log files can be deleted");
  }
  if (path.basename(resolved) === "MEMORY.md") {
    throw new Error("cannot delete MEMORY.md");
  }
  if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
}

export type RememberScope = "global" | "workspace";

/**
 * 将笔记追加到 Global 或（若能解析）Workspace MEMORY.md。
 * 规范化：无标题时加 ## Preferences（对齐 CLI append 精神）。
 */
export function memoryAppendNote(
  text: string,
  scope: RememberScope,
  home?: string,
  cwd?: string,
): { path: string; scope: RememberScope } {
  const body = normalizeNote(text);
  if (!body) throw new Error("empty note");

  const root = agentMemoryRoot(home);
  fs.mkdirSync(root, { recursive: true });

  let target: string;
  if (scope === "global") {
    target = path.join(root, "MEMORY.md");
  } else {
    const wsDir = resolveWorkspaceDir(root, cwd);
    if (!wsDir) {
      throw new Error(
        "无法定位当前项目 workspace 目录；请改用全局，或先在该项目启用 memory 跑过会话后再记。",
      );
    }
    fs.mkdirSync(wsDir, { recursive: true });
    target = path.join(wsDir, "MEMORY.md");
  }

  const prev = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  const next = prev.trim() ? `${prev.replace(/\s+$/, "")}\n\n${body}\n` : `${body}\n`;
  fs.writeFileSync(target, next, "utf8");
  return { path: target, scope };
}

function normalizeNote(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (/^#{1,6}\s/m.test(t)) return t;
  return `## Preferences\n\n- ${t}`;
}

/**
 * 在已有 memory 子目录中找匹配当前 cwd 的 workspace；
 * 找不到则返回 null（不 invent hash，避免与 agent 分叉）。
 */
function resolveWorkspaceDir(root: string, cwd?: string): string | null {
  if (!cwd || !fs.existsSync(root)) return null;
  const prefix = guessWorkspaceKey(cwd);
  if (!prefix) return null;
  try {
    const dirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => n === prefix || n.startsWith(`${prefix}-`));
    if (dirs.length === 1) return path.join(root, dirs[0]);
    if (dirs.length > 1) {
      // 多个 clone 时优先 mtime 最新
      dirs.sort((a, b) => {
        try {
          return (
            fs.statSync(path.join(root, b)).mtimeMs -
            fs.statSync(path.join(root, a)).mtimeMs
          );
        } catch {
          return 0;
        }
      });
      return path.join(root, dirs[0]);
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ── 兼容旧 Host API 名（列表/搜索映射到文件浏览）────────────────

/** @deprecated 旧 JSON 条目；现返回扁平文件摘要条目 */
export interface MemoryEntry {
  id: string;
  text: string;
  source?: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  path?: string;
  deletable?: boolean;
}

export function memoryList(home?: string, cwd?: string): MemoryEntry[] {
  return listMemoryFiles(home, cwd).files.map(fileToEntry);
}

export function memorySearch(
  query: string,
  home?: string,
  cwd?: string,
): MemoryEntry[] {
  const q = query.trim().toLowerCase();
  const all = listMemoryFiles(home, cwd).files;
  if (!q) return all.map(fileToEntry);
  return all
    .filter((f) => {
      if (f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) {
        return true;
      }
      try {
        const text = fs.readFileSync(f.path, "utf8").slice(0, 50_000).toLowerCase();
        return text.includes(q);
      } catch {
        return false;
      }
    })
    .map(fileToEntry);
}

function fileToEntry(f: MemoryFileEntry): MemoryEntry {
  const iso = new Date(f.mtimeMs).toISOString();
  let preview = "";
  try {
    preview = fs.readFileSync(f.path, "utf8").slice(0, 400);
  } catch {
    preview = f.label;
  }
  return {
    id: f.id,
    text: preview,
    source: f.source,
    createdAt: iso,
    updatedAt: iso,
    path: f.path,
    deletable: f.deletable,
    tags: f.current ? ["current"] : undefined,
  };
}

/** 旧 API：改为追加 global 笔记 */
export function memoryAdd(
  input: { text: string; source?: string; sessionId?: string; tags?: string[] },
  home?: string,
): MemoryEntry {
  if (!isExperimentalMemoryEnabled(home)) {
    memorySetEnabled(true, home);
  }
  const scope: RememberScope =
    input.source === "workspace" ? "workspace" : "global";
  const r = memoryAppendNote(input.text, scope, home);
  const st = safeStat(r.path)!;
  return {
    id: fileId(scope === "global" ? "global" : "workspace", r.path),
    text: input.text,
    source: scope,
    sessionId: input.sessionId,
    createdAt: new Date(st.mtimeMs).toISOString(),
    updatedAt: new Date(st.mtimeMs).toISOString(),
    path: r.path,
    deletable: false,
  };
}

/** 旧 API id 为 fileId 或遗留 mem_*；支持 session 文件删除 */
export function memoryDelete(id: string, home?: string): void {
  if (id.startsWith("session:") || id.startsWith("global:") || id.startsWith("workspace:")) {
    const filePath = id.slice(id.indexOf(":") + 1);
    memoryDeleteFile(filePath, home);
    return;
  }
  // 遗留 JSON id：忽略或从 legacy 删
  const f = legacyEntriesPath(home);
  if (!fs.existsSync(f)) return;
  try {
    const data = JSON.parse(fs.readFileSync(f, "utf8")) as {
      version: number;
      enabled: boolean;
      entries: Array<{ id: string }>;
    };
    data.entries = (data.entries || []).filter((e) => e.id !== id);
    fs.writeFileSync(f, JSON.stringify(data, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}
