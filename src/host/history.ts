import fs from "node:fs";
import path from "node:path";
import type { HistoryEntry, HistoryPage } from "../shared/types.js";
import { findSessionDir } from "./paths.js";

/**
 * Parse grok chat_history.jsonl into UI-facing timeline entries.
 * - user / assistant 文本
 * - tool_call + tool_result → role:tool（与直播过程块同源回放）
 * 仍跳过 system / reasoning 等噪声
 */
export function loadChatHistory(
  sessionId: string,
  home?: string,
): HistoryPage {
  const sessionDir = findSessionDir(sessionId, home);
  const entries: HistoryEntry[] = [];
  if (!sessionDir) {
    return { sessionId, entries, sessionDir: null };
  }

  const historyFile = path.join(sessionDir, "chat_history.jsonl");
  if (!fs.existsSync(historyFile)) {
    return { sessionId, entries: legacyScan(sessionDir), sessionDir };
  }

  /** tool_call_id → 名称/参数（assistant.tool_calls 登记，tool_result 消费） */
  const pendingTools = new Map<
    string,
    { name: string; input?: unknown }
  >();

  const raw = fs.readFileSync(historyFile, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    for (const e of expandHistoryLine(obj, pendingTools)) {
      entries.push(e);
    }
  }

  // 未收到 result 的 tool_call：仍回放为已结束卡（无输出）
  for (const [id, meta] of pendingTools) {
    entries.push({
      role: "tool",
      text: "",
      toolCallId: id,
      toolName: meta.name,
      toolStatus: "done",
      toolInput: meta.input,
    });
  }

  return { sessionId, entries, sessionDir };
}

/** 将单行 history 展开为 0..n 条 UI 条目 */
export function expandHistoryLine(
  obj: Record<string, unknown>,
  pendingTools: Map<string, { name: string; input?: unknown }>,
): HistoryEntry[] {
  const type = String(obj.type ?? obj.role ?? "");

  if (type === "system" || type === "reasoning") {
    return [];
  }

  // 工具结果：与 pending 合并为一条终态 tool
  if (type === "tool_result" || type === "function_call_output") {
    const id = String(
      obj.tool_call_id ?? obj.toolCallId ?? obj.call_id ?? obj.id ?? "",
    );
    const meta = id ? pendingTools.get(id) : undefined;
    if (id) pendingTools.delete(id);
    const outText = extractText(obj.content ?? obj.output ?? obj.text);
    const name =
      meta?.name ||
      String(obj.name ?? obj.tool ?? obj.tool_name ?? "tool");
    const preview = outText.replace(/\s+/g, " ").trim().slice(0, 120);
    return [
      {
        role: "tool",
        text: outText.slice(0, 2000),
        toolCallId: id || undefined,
        toolName: name,
        toolStatus: "done",
        toolInput: meta?.input,
        toolOutput: outText
          ? { content: outText, title: preview, ...(meta?.input as object) }
          : { ...(typeof meta?.input === "object" && meta.input ? meta.input : {}), ...obj },
      },
    ];
  }

  // 独立 tool_call / function_call 行
  if (type === "tool_call" || type === "function_call") {
    const id = String(
      obj.id ?? obj.tool_call_id ?? obj.toolCallId ?? obj.call_id ?? "",
    );
    const name = String(obj.name ?? obj.tool ?? obj.tool_name ?? "tool");
    const input = parseToolArguments(obj.arguments ?? obj.input ?? obj.rawInput);
    if (id) pendingTools.set(id, { name, input });
    // 等 tool_result 再落一条终态卡；无 id 则立即落一条
    if (!id) {
      return [
        {
          role: "tool",
          text: "",
          toolName: name,
          toolStatus: "done",
          toolInput: input,
        },
      ];
    }
    return [];
  }

  if (type === "user" || type === "human") {
    if (obj.synthetic_reason) return [];
    const text = extractText(obj.content ?? obj.text);
    if (!text || isNoiseUserText(text)) return [];
    return [{ role: "user", text: cleanUserText(text) }];
  }

  if (type === "assistant" || type === "ai") {
    const out: HistoryEntry[] = [];
    const text = extractText(obj.content ?? obj.text).trim();
    if (text) {
      out.push({ role: "assistant", text });
    }
    // OpenAI 风格：assistant 行内嵌 tool_calls
    const calls = obj.tool_calls;
    if (Array.isArray(calls)) {
      for (const c of calls) {
        if (!c || typeof c !== "object") continue;
        const tc = c as Record<string, unknown>;
        const id = String(tc.id ?? tc.tool_call_id ?? "");
        const name = String(
          tc.name ??
            (tc.function && typeof tc.function === "object"
              ? (tc.function as Record<string, unknown>).name
              : undefined) ??
            "tool",
        );
        const argsRaw =
          tc.arguments ??
          (tc.function && typeof tc.function === "object"
            ? (tc.function as Record<string, unknown>).arguments
            : undefined) ??
          tc.input;
        const input = parseToolArguments(argsRaw);
        if (id) pendingTools.set(id, { name, input });
        else {
          out.push({
            role: "tool",
            text: "",
            toolName: name,
            toolStatus: "done",
            toolInput: input,
          });
        }
      }
    }
    return out;
  }

  // 仅 role 字段
  if (obj.role === "user" || obj.role === "assistant") {
    const text = extractText(obj.content ?? obj.text);
    if (!text || (obj.role === "user" && isNoiseUserText(text))) return [];
    return [
      {
        role: String(obj.role),
        text: obj.role === "user" ? cleanUserText(text) : text.trim(),
      },
    ];
  }

  return [];
}

/** @deprecated 兼容旧调用；请用 expandHistoryLine */
export function mapHistoryLine(
  obj: Record<string, unknown>,
): HistoryEntry | null {
  const pending = new Map<string, { name: string; input?: unknown }>();
  const list = expandHistoryLine(obj, pending);
  return list[0] ?? null;
}

function parseToolArguments(raw: unknown): unknown {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return { raw };
    }
  }
  return raw;
}

/** Pull plain text from string | content-block array | unknown. */
export function extractText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (typeof content === "number" || typeof content === "boolean") {
    return String(content);
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (typeof block === "string") {
        parts.push(block);
        continue;
      }
      if (block && typeof block === "object") {
        const b = block as Record<string, unknown>;
        if (typeof b.text === "string") parts.push(b.text);
        else if (typeof b.content === "string") parts.push(b.content);
      }
    }
    return parts.join("\n");
  }
  if (typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    return "";
  }
  return "";
}

function isNoiseUserText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.startsWith("<system-reminder>")) return true;
  if (t.startsWith("<user_info>")) return true;
  if (t.includes("The following skills are available")) return true;
  if (t.includes("MCP server connected:")) return true;
  if (t.includes("Follow these instructions exactly")) return true;
  if (t.length > 4000 && !t.includes("<user_query>")) return true;
  return false;
}

/** Prefer user_query body when present; strip wrapper tags for display. */
export function cleanUserText(text: string): string {
  const m = /<user_query>\s*([\s\S]*?)\s*<\/user_query>/i.exec(text);
  if (m) return m[1].trim();
  return text
    .replace(/<\/?user_query>/gi, "")
    .replace(/<\/?user_info>[\s\S]*$/i, "")
    .trim();
}

function legacyScan(sessionDir: string): HistoryEntry[] {
  void sessionDir;
  return [];
}
