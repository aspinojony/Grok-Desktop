/**
 * 斜杠命令中心 —— 仅当前会话相关命令。
 * 导航类（新对话 / 设置 / 项目 / 搜索等）走侧栏与顶栏 UI，不进本列表。
 */

export type SlashPermMode = "always_approve" | "normal" | "plan";

export interface SlashCommand {
  /** 触发 id，如 plan、status；skill 为 skill:名称 */
  id: string;
  /** 列表主标题（skill 显示技能名，不显示 /id） */
  title: string;
  /** 说明 */
  description: string;
  /** 搜索关键词 */
  keywords?: string;
  icon?: string;
  /** skill 动态项 */
  dynamic?: boolean;
  /** skill 来源角标：个人 / 项目 / 系统 */
  badge?: string;
}

export type SlashEffortLevel = "low" | "medium" | "high" | "xhigh";

export type SlashAction =
  | { kind: "set-perm"; mode: SlashPermMode }
  | { kind: "view-plan" }
  | { kind: "set-model"; prompt?: boolean }
  | { kind: "set-effort"; level?: SlashEffortLevel }
  | { kind: "open-model-menu" }
  | { kind: "show-context" }
  | { kind: "goal"; sub?: "set" | "status" | "clear" }
  | { kind: "status" }
  | { kind: "insert-text"; text: string }
  | { kind: "export-session" }
  | { kind: "compact-session" }
  | { kind: "fork-session" };

export interface SlashCommandDef extends SlashCommand {
  action: SlashAction;
}

/** 仅会话命令（对话框 `/` 全部内容） */
export const STATIC_SLASH_COMMANDS: SlashCommandDef[] = [
  {
    id: "always-approve",
    title: "完全访问",
    description: "跳过权限确认；再执行一次恢复「默认确认」（同权限 chip）",
    keywords: "always-approve always approve 完全访问 yolo auto-approve",
    icon: "⚡",
    action: { kind: "set-perm", mode: "always_approve" },
  },
  {
    id: "plan",
    title: "计划模式",
    description: "开启 Plan（下次发送激活；chip × 退出）",
    keywords: "plan 计划",
    icon: "≡",
    action: { kind: "set-perm", mode: "plan" },
  },
  {
    id: "view-plan",
    title: "查看计划",
    description: "打开当前会话 plan.md 预览",
    keywords: "view-plan show-plan plan-view 查看计划",
    icon: "☰",
    action: { kind: "view-plan" },
  },
  {
    id: "goal",
    title: "目标",
    description: "在输入框描述目标后发送",
    keywords: "goal 目标 objective",
    icon: "◎",
    action: { kind: "goal", sub: "set" },
  },
  {
    id: "goal-status",
    title: "目标状态",
    description: "查看当前 goal",
    keywords: "goal status 目标状态",
    icon: "ⓘ",
    action: { kind: "goal", sub: "status" },
  },
  {
    id: "goal-clear",
    title: "清除目标",
    description: "清除当前 goal",
    keywords: "goal clear 清除目标",
    icon: "✕",
    action: { kind: "goal", sub: "clear" },
  },
  {
    id: "model",
    title: "模型",
    description: "打开模型 / 推理菜单（同右下 chip）",
    keywords: "model 模型",
    icon: "◇",
    action: { kind: "open-model-menu" },
  },
  {
    id: "effort",
    title: "推理力度",
    description: "low / medium / high / xhigh（同 chip「推理」）",
    keywords: "effort 推理 力度 reasoning low medium high xhigh",
    icon: "◎",
    action: { kind: "set-effort" },
  },
  {
    id: "context",
    title: "上下文占用",
    description: "已用 / 窗口与占比（同右下 context chip）",
    keywords: "context 上下文 占用 tokens window compact",
    icon: "▣",
    action: { kind: "show-context" },
  },
  {
    id: "compact",
    title: "压缩上下文",
    description: "请求 agent 压缩较早对话",
    keywords: "compact 压缩 上下文",
    icon: "▤",
    action: { kind: "compact-session" },
  },
  {
    id: "export",
    title: "导出会话",
    description: "导出当前会话为 Markdown",
    keywords: "export 导出 markdown md",
    icon: "⇩",
    action: { kind: "export-session" },
  },
  {
    id: "fork",
    title: "分支会话",
    description: "同项目新建对话（不复制 agent 历史）",
    keywords: "fork 分支 分叉",
    icon: "⑂",
    action: { kind: "fork-session" },
  },
  {
    id: "status",
    title: "状态",
    description: "当前会话 / 项目 / 权限 / 模型",
    keywords: "status 状态 session",
    icon: "ⓘ",
    action: { kind: "status" },
  },
];

/** 光标前是否处于 `/query` 片段 */
export function getSlashTrigger(
  text: string,
  cursor: number,
): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const m = before.match(/(?:^|[\s\n])\/([^\s]*)$/);
  if (!m) return null;
  const query = m[1] ?? "";
  const start = before.length - query.length - 1;
  if (start < 0 || text[start] !== "/") return null;
  return { start, query };
}

export function filterSlashCommands(
  commands: SlashCommandDef[],
  query: string,
): SlashCommandDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((c) => {
    const hay =
      `${c.id} ${c.title} ${c.description} ${c.keywords ?? ""}`.toLowerCase();
    const id = c.id.startsWith("skill:") ? c.id.slice(6) : c.id;
    return hay.includes(q) || c.id.startsWith(q) || id.startsWith(q);
  });
}

/** 去掉输入中的 `/query` 片段 */
export function stripSlashToken(
  text: string,
  start: number,
  cursor: number,
): { text: string; cursor: number } {
  const end = cursor;
  const next = text.slice(0, start) + text.slice(end);
  return { text: next, cursor: start };
}

function skillScopeBadge(scope?: string): string {
  if (scope === "project") return "项目";
  if (scope === "user") return "个人";
  return "系统";
}

export function skillCommands(
  skills: Array<{ name: string; description?: string; scope?: string }>,
): SlashCommandDef[] {
  return skills.map((s) => ({
    id: `skill:${s.name}`,
    title: s.name,
    description: s.description?.trim() || "使用此 Skill",
    keywords: `skill 技能 ${s.name}`,
    icon: "⬡",
    dynamic: true,
    badge: skillScopeBadge(s.scope),
    action: {
      kind: "insert-text" as const,
      text: `请使用 skill「${s.name}」：`,
    },
  }));
}
