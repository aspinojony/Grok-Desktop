/**
 * Agent 工具时间线块：结构化展示（名称、状态、摘要、可点路径）
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 从工具 raw 里尽量抠路径 / 摘要 */
export function extractToolMeta(raw: unknown, name?: string): {
  paths: string[];
  summary: string;
  kind: "read" | "write" | "shell" | "search" | "other";
} {
  const paths: string[] = [];
  let summary = "";
  const kind = classifyTool(name || "");

  const walk = (v: unknown, depth = 0): void => {
    if (depth > 4 || v == null) return;
    if (typeof v === "string") {
      // 路径启发
      if (
        (/[/\\]/.test(v) || /^[A-Za-z]:\\/.test(v)) &&
        v.length < 400 &&
        !v.includes("\n") &&
        /\.[a-zA-Z0-9]{1,12}$/.test(v)
      ) {
        if (!paths.includes(v)) paths.push(v);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v.slice(0, 20)) walk(x, depth + 1);
      return;
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const key of [
        "path",
        "file",
        "filePath",
        "filename",
        "target",
        "uri",
      ]) {
        if (typeof o[key] === "string") walk(o[key], depth + 1);
      }
      if (typeof o.title === "string" && !summary) summary = o.title;
      if (typeof o.command === "string" && !summary) {
        summary = o.command.slice(0, 120);
      }
      if (typeof o.query === "string" && !summary) summary = o.query.slice(0, 120);
      // 浅扫
      for (const [k, val] of Object.entries(o).slice(0, 30)) {
        if (["path", "file", "filePath", "command", "title", "query"].includes(k))
          continue;
        walk(val, depth + 1);
      }
    }
  };
  walk(raw);
  return { paths: paths.slice(0, 5), summary, kind };
}

function classifyTool(name: string): "read" | "write" | "shell" | "search" | "other" {
  const n = name.toLowerCase();
  if (/read|cat|open|view|get_file|read_file/.test(n)) return "read";
  if (/write|edit|patch|apply|create|update|str_replace|search_replace/.test(n))
    return "write";
  if (/shell|bash|cmd|terminal|exec|run|powershell/.test(n)) return "shell";
  if (/search|grep|glob|find|web_search/.test(n)) return "search";
  return "other";
}

function kindIcon(kind: string): string {
  switch (kind) {
    case "read":
      return "📖";
    case "write":
      return "✎";
    case "shell":
      return "⌘";
    case "search":
      return "⌕";
    default:
      return "⚙";
  }
}

export function buildToolCardHtml(opts: {
  name: string;
  toolCallId?: string;
  running: boolean;
  raw?: unknown;
}): string {
  const meta = extractToolMeta(opts.raw, opts.name);
  const id = opts.toolCallId || opts.name;
  const state = opts.running ? "运行中" : "已完成";
  const stateCls = opts.running ? "running" : "done";
  const pathsHtml = meta.paths
    .map(
      (p) =>
        `<button type="button" class="tool-path-chip file-link" data-file-path="${esc(p)}" title="${esc(p)}">${esc(p.split(/[/\\]/).pop() || p)}</button>`,
    )
    .join("");
  const summaryHtml = meta.summary
    ? `<div class="tool-summary">${esc(meta.summary)}</div>`
    : "";
  const spin = opts.running
    ? `<span class="tool-spin"></span>`
    : `<span class="tool-spin done">✓</span>`;

  return (
    `<div class="line tool agent-tool ${stateCls}" data-tool-id="${esc(id)}" data-tool-kind="${meta.kind}">` +
    `<div class="tool-row">` +
    spin +
    `<span class="tool-kind-ico">${kindIcon(meta.kind)}</span>` +
    `<span class="tool-name">${esc(opts.name)}</span>` +
    `<span class="tool-state">${state}</span>` +
    `</div>` +
    summaryHtml +
    (pathsHtml ? `<div class="tool-paths">${pathsHtml}</div>` : "") +
    `</div>`
  );
}

export function updateToolCardDone(row: HTMLElement, raw?: unknown): void {
  row.classList.remove("running");
  row.classList.add("done");
  const spin = row.querySelector(".tool-spin");
  if (spin) {
    spin.classList.add("done");
    spin.textContent = "✓";
  }
  const st = row.querySelector(".tool-state");
  if (st) st.textContent = "已完成";

  if (raw != null) {
    const name =
      row.querySelector(".tool-name")?.textContent?.trim() || "tool";
    const meta = extractToolMeta(raw, name);
    if (meta.summary && !row.querySelector(".tool-summary")) {
      const s = document.createElement("div");
      s.className = "tool-summary";
      s.textContent = meta.summary;
      row.appendChild(s);
    }
    if (meta.paths.length && !row.querySelector(".tool-paths")) {
      const wrap = document.createElement("div");
      wrap.className = "tool-paths";
      for (const p of meta.paths) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tool-path-chip file-link";
        b.dataset.filePath = p;
        b.title = p;
        b.textContent = p.split(/[/\\]/).pop() || p;
        wrap.appendChild(b);
      }
      row.appendChild(wrap);
    }
  }
}
