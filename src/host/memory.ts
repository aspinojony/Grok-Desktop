import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { desktopDir, ensureDesktopDirs, grokHomeDir } from "./paths.js";

export interface MemoryEntry {
  id: string;
  text: string;
  source?: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface MemoryStatus {
  enabled: boolean;
  entryCount: number;
  storePath: string;
  message?: string;
}

interface MemoryFile {
  version: number;
  enabled: boolean;
  entries: MemoryEntry[];
}

function memoryPath(home?: string): string {
  return path.join(desktopDir(home), "memory", "entries.json");
}

function runtimeMemoryHint(home?: string): string {
  return path.join(grokHomeDir(home), "memory");
}

function readStore(home?: string): MemoryFile {
  ensureDesktopDirs(home);
  const f = memoryPath(home);
  if (!fs.existsSync(f)) {
    // Import-ish: if runtime memory dir exists, mark enabled false until user toggles
    const hint = runtimeMemoryHint(home);
    return {
      version: 1,
      enabled: false,
      entries: fs.existsSync(hint) ? [] : [],
    };
  }
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as MemoryFile;
  } catch {
    return { version: 1, enabled: false, entries: [] };
  }
}

function writeStore(data: MemoryFile, home?: string): void {
  const f = memoryPath(home);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, f);
}

export function memoryStatus(home?: string): MemoryStatus {
  const data = readStore(home);
  const storePath = memoryPath(home);
  const runtime = runtimeMemoryHint(home);
  return {
    enabled: data.enabled,
    entryCount: data.entries.length,
    storePath,
    message: data.enabled
      ? undefined
      : fs.existsSync(runtime)
        ? "Memory disabled in Desktop (runtime memory dir present)"
        : "Memory disabled (feature flag off)",
  };
}

export function memorySetEnabled(enabled: boolean, home?: string): MemoryStatus {
  const data = readStore(home);
  data.enabled = enabled;
  writeStore(data, home);
  return memoryStatus(home);
}

export function memoryList(home?: string): MemoryEntry[] {
  const data = readStore(home);
  if (!data.enabled) return [];
  return [...data.entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function memorySearch(query: string, home?: string): MemoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return memoryList(home);
  return memoryList(home).filter(
    (e) =>
      e.text.toLowerCase().includes(q) ||
      (e.source ?? "").toLowerCase().includes(q) ||
      (e.tags ?? []).some((t) => t.toLowerCase().includes(q)),
  );
}

export function memoryAdd(
  input: { text: string; source?: string; sessionId?: string; tags?: string[] },
  home?: string,
): MemoryEntry {
  const data = readStore(home);
  if (!data.enabled) {
    data.enabled = true; // first add enables
  }
  const now = new Date().toISOString();
  const entry: MemoryEntry = {
    id: `mem_${randomUUID()}`,
    text: input.text,
    source: input.source,
    sessionId: input.sessionId,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  };
  data.entries.unshift(entry);
  if (data.entries.length > 1000) data.entries = data.entries.slice(0, 1000);
  writeStore(data, home);
  return entry;
}

export function memoryDelete(id: string, home?: string): void {
  const data = readStore(home);
  data.entries = data.entries.filter((e) => e.id !== id);
  writeStore(data, home);
}
