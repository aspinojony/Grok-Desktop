/**
 * 从会话目录 signals.json 读取上下文占用（对齐 CLI /context 的数据源）。
 */
import fs from "node:fs";
import path from "node:path";
import { findSessionDir } from "./paths.js";

export interface SessionContextUsage {
  sessionId: string;
  /** 已用 tokens */
  used: number;
  /** 窗口上限 tokens */
  total: number;
  /** 0–100 */
  percent: number;
  /** 是否读到文件 */
  available: boolean;
  source: "signals" | "none";
  path?: string;
}

interface SignalsJson {
  contextTokensUsed?: number;
  contextWindowTokens?: number;
  contextWindowUsage?: number;
  turnCount?: number;
  primaryModelId?: string;
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Math.max(0, Number(v));
  }
  return 0;
}

export function loadSessionContextUsage(
  sessionId: string,
  home?: string,
): SessionContextUsage {
  const empty: SessionContextUsage = {
    sessionId,
    used: 0,
    total: 0,
    percent: 0,
    available: false,
    source: "none",
  };
  if (!sessionId) return empty;

  const dir = findSessionDir(sessionId, home);
  if (!dir) return empty;

  const signalsPath = path.join(dir, "signals.json");
  if (!fs.existsSync(signalsPath)) return { ...empty, path: dir };

  try {
    const raw = JSON.parse(fs.readFileSync(signalsPath, "utf8")) as SignalsJson;
    const used = num(raw.contextTokensUsed);
    const total = num(raw.contextWindowTokens);
    let percent = 0;
    if (total > 0) {
      percent = Math.min(100, (used / total) * 100);
    } else if (typeof raw.contextWindowUsage === "number") {
      // 部分版本可能直接给 0–100
      const u = raw.contextWindowUsage;
      percent = u > 1 && u <= 100 ? u : u <= 1 ? u * 100 : 0;
    }
    return {
      sessionId,
      used,
      total,
      percent,
      available: total > 0 || used > 0,
      source: "signals",
      path: signalsPath,
    };
  } catch {
    return { ...empty, path: signalsPath };
  }
}
