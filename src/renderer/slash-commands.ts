/**
 * 斜杠命令中心 —— 仅当前会话相关命令。
 * 导航类（新对话 / 设置 / 项目 / 搜索等）走侧栏与顶栏 UI，不进本列表。
 */
import { tr } from "../shared/i18n/index.js";

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
  | { kind: "fork-session" }
  | { kind: "rewind-session" };

export interface SlashCommandDef extends SlashCommand {
  action: SlashAction;
}

/** 仅会话命令（对话框 `/` 全部内容）— rebuilt each call so locale applies */
export function getStaticSlashCommands(): SlashCommandDef[] {
  return [
    {
      id: "always-approve",
      title: tr("slash.alwaysApprove"),
      description: tr("slash.alwaysApproveDesc"),
      keywords: "always-approve always approve yolo auto-approve 完全访问",
      icon: "⚡",
      action: { kind: "set-perm", mode: "always_approve" },
    },
    {
      id: "plan",
      title: tr("slash.plan"),
      description: tr("slash.planDesc"),
      keywords: "plan 计划",
      icon: "≡",
      action: { kind: "set-perm", mode: "plan" },
    },
    {
      id: "view-plan",
      title: tr("slash.viewPlan"),
      description: tr("slash.viewPlanDesc"),
      keywords: "view-plan show-plan plan-view",
      icon: "☰",
      action: { kind: "view-plan" },
    },
    {
      id: "goal",
      title: tr("slash.goal"),
      description: tr("slash.goalDesc"),
      keywords: "goal objective 目标",
      icon: "◎",
      action: { kind: "goal", sub: "set" },
    },
    {
      id: "goal-status",
      title: tr("slash.goalStatus"),
      description: tr("slash.goalStatusDesc"),
      keywords: "goal status",
      icon: "ⓘ",
      action: { kind: "goal", sub: "status" },
    },
    {
      id: "goal-clear",
      title: tr("slash.goalClear"),
      description: tr("slash.goalClearDesc"),
      keywords: "goal clear",
      icon: "✕",
      action: { kind: "goal", sub: "clear" },
    },
    {
      id: "model",
      title: tr("slash.model"),
      description: tr("slash.modelDesc"),
      keywords: "model 模型",
      icon: "◇",
      action: { kind: "open-model-menu" },
    },
    {
      id: "effort",
      title: tr("slash.effort"),
      description: tr("slash.effortDesc"),
      keywords: "effort reasoning low medium high xhigh",
      icon: "◎",
      action: { kind: "set-effort" },
    },
    {
      id: "context",
      title: tr("slash.context"),
      description: tr("slash.contextDesc"),
      keywords: "context tokens window compact",
      icon: "▣",
      action: { kind: "show-context" },
    },
    {
      id: "compact",
      title: tr("slash.compact"),
      description: tr("slash.compactDesc"),
      keywords: "compact",
      icon: "▤",
      action: { kind: "compact-session" },
    },
    {
      id: "export",
      title: tr("slash.export"),
      description: tr("slash.exportDesc"),
      keywords: "export markdown md",
      icon: "⇩",
      action: { kind: "export-session" },
    },
    {
      id: "fork",
      title: tr("slash.fork"),
      description: tr("slash.forkDesc"),
      keywords: "fork",
      icon: "⑂",
      action: { kind: "fork-session" },
    },
    {
      id: "rewind",
      title: tr("slash.rewind"),
      description: tr("slash.rewindDesc"),
      keywords: "rewind undo 回退 撤销",
      icon: "↩",
      action: { kind: "rewind-session" },
    },
    {
      id: "status",
      title: tr("slash.status"),
      description: tr("slash.statusDesc"),
      keywords: "status session",
      icon: "ⓘ",
      action: { kind: "status" },
    },
  ];
}

/** @deprecated use getStaticSlashCommands() — kept for import compatibility */
export const STATIC_SLASH_COMMANDS: SlashCommandDef[] = getStaticSlashCommands();

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
  if (scope === "project") return tr("slash.badge.project");
  if (scope === "user") return tr("slash.badge.user");
  return tr("slash.badge.system");
}

export function skillCommands(
  skills: Array<{ name: string; description?: string; scope?: string }>,
): SlashCommandDef[] {
  return skills.map((s) => ({
    id: `skill:${s.name}`,
    title: s.name,
    description: s.description?.trim() || tr("slash.skillDefaultDesc"),
    keywords: `skill 技能 ${s.name}`,
    icon: "⬡",
    dynamic: true,
    badge: skillScopeBadge(s.scope),
    action: {
      kind: "insert-text" as const,
      text: tr("slash.skillInsert", { name: s.name }),
    },
  }));
}
