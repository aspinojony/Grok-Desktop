import fs from "node:fs";
import path from "node:path";
import type { GoalState, PlanState, SubagentNode } from "../shared/types.js";
import { findSessionDir } from "./paths.js";

/** Best-effort FS projection for Goal / Plan / Subagent (capability-degraded). */
export function loadGoal(sessionId: string, home?: string): GoalState | null {
  const dir = findSessionDir(sessionId, home);
  if (!dir) return null;
  const goalPath = path.join(dir, "goal.json");
  if (fs.existsSync(goalPath)) {
    try {
      return JSON.parse(fs.readFileSync(goalPath, "utf8")) as GoalState;
    } catch {
      /* fall through */
    }
  }
  // 勿因 goal/ 目录占位就伪造「进行中」目标，否则会话会无端进入目标模式
  return null;
}

/** Desktop /goal：写入会话目录 goal.json（对齐 CLI 目标语义） */
export function writeGoal(
  sessionId: string,
  title: string,
  home?: string,
  status: GoalState["status"] = "active",
): GoalState {
  const dir = findSessionDir(sessionId, home);
  if (!dir) {
    throw new Error(`Session dir not found for ${sessionId}`);
  }
  const prev = loadGoal(sessionId, home);
  const state: GoalState = {
    sessionId,
    title: title.trim() || prev?.title || "Goal",
    status,
    tree: [
      {
        id: "root",
        title: title.trim() || prev?.title || "Goal",
        status,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(dir, "goal.json"),
    JSON.stringify(state, null, 2),
    "utf8",
  );
  return state;
}

export function setGoalStatus(
  sessionId: string,
  status: GoalState["status"],
  home?: string,
): GoalState | null {
  const prev = loadGoal(sessionId, home);
  if (!prev) return null;
  return writeGoal(sessionId, prev.title, home, status);
}

/** 将 agent goal_updated.status 映射为 Desktop GoalStatus */
export function mapAgentGoalStatus(agentStatus: string): GoalState["status"] {
  const s = agentStatus.toLowerCase();
  if (s === "complete" || s === "completed") return "completed";
  if (s === "user_paused" || s === "paused") return "paused";
  if (s === "blocked") return "blocked";
  if (s === "cancelled" || s === "canceled" || s === "cleared") return "cancelled";
  return "active";
}

/** 用 agent 事件投影覆盖本地 goal.json（同源落盘） */
export function applyAgentGoalProjection(
  sessionId: string,
  objective: string,
  agentStatus: string,
  home?: string,
): GoalState {
  const status = mapAgentGoalStatus(agentStatus);
  const title = objective.trim() || loadGoal(sessionId, home)?.title || "Goal";
  return writeGoal(sessionId, title, home, status);
}

/** agent updates.jsonl 中最近一次 goal_updated */
export interface AgentGoalSnapshot {
  objective: string;
  /** agent 原始 status：active | user_paused | complete | … */
  status: string;
  lastEvent?: string;
  elapsedMs?: number;
  goalId?: string;
}

/**
 * 从会话 updates.jsonl 尾部读取最新 goal_updated。
 * 实时 ACP 偶发丢事件时，以此为同源权威回读。
 */
export function readLastGoalUpdatedFromSession(
  sessionId: string,
  home?: string,
): AgentGoalSnapshot | null {
  const dir = findSessionDir(sessionId, home);
  if (!dir) return null;
  const updatesPath = path.join(dir, "updates.jsonl");
  if (!fs.existsSync(updatesPath)) return null;

  let text: string;
  try {
    const st = fs.statSync(updatesPath);
    const size = st.size;
    if (size <= 0) return null;
    // 只读尾部，避免大会话全量加载
    const chunk = Math.min(size, 512 * 1024);
    const fd = fs.openSync(updatesPath, "r");
    try {
      const buf = Buffer.alloc(chunk);
      fs.readSync(fd, buf, 0, chunk, size - chunk);
      text = buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }

  const lines = text.split(/\r?\n/).filter((l) => l.includes("goal_updated"));
  let last: AgentGoalSnapshot | null = null;
  for (const line of lines) {
    // 跳过截断的首行
    if (!line.trim().startsWith("{")) continue;
    try {
      const j = JSON.parse(line) as {
        params?: { update?: Record<string, unknown> };
      };
      const u = j.params?.update;
      if (!u || u.sessionUpdate !== "goal_updated") continue;
      last = {
        objective: String(u.objective ?? ""),
        status: String(u.status ?? "active"),
        lastEvent:
          typeof u.last_event === "string" ? u.last_event : undefined,
        elapsedMs:
          typeof u.elapsed_ms === "number" ? u.elapsed_ms : undefined,
        goalId:
          typeof u.goal_id === "string"
            ? u.goal_id
            : typeof u.goalId === "string"
              ? u.goalId
              : undefined,
      };
    } catch {
      /* 半截 JSON 忽略 */
    }
  }
  return last;
}

/**
 * 从 agent 日志同步并写回 goal.json。
 * 仅当 Desktop 侧已有 goal.json（用户显式 /goal 或 goals.set）时才投影，
 * 避免 agent 自发 goal_updated 把普通会话拉进目标模式。
 */
export function syncGoalFromAgentLog(
  sessionId: string,
  home?: string,
): { state: GoalState | null; agent: AgentGoalSnapshot | null } {
  const agent = readLastGoalUpdatedFromSession(sessionId, home);
  const existing = loadGoal(sessionId, home);
  if (!agent) {
    return { state: existing, agent: null };
  }
  // agent 首启 goal 时也落盘，不要求 Desktop 先有 goal.json
  try {
    const state = applyAgentGoalProjection(
      sessionId,
      agent.objective || existing?.title || "Goal",
      agent.status,
      home,
    );
    return { state, agent };
  } catch {
    // 会话目录尚未就绪时仅回传 agent 快照
    return { state: existing, agent };
  }
}

export function clearGoal(sessionId: string, home?: string): boolean {
  const dir = findSessionDir(sessionId, home);
  if (!dir) return false;
  const goalPath = path.join(dir, "goal.json");
  if (fs.existsSync(goalPath)) {
    fs.unlinkSync(goalPath);
    return true;
  }
  return false;
}

export function loadPlan(sessionId: string, home?: string): PlanState | null {
  const dir = findSessionDir(sessionId, home);
  if (!dir) return null;
  const planPath = path.join(dir, "plan.md");
  if (!fs.existsSync(planPath)) {
    return {
      sessionId,
      status: "drafting",
      content: "",
      path: planPath,
    };
  }
  const content = fs.readFileSync(planPath, "utf8");
  return {
    sessionId,
    status: content.trim() ? "ready_for_approval" : "drafting",
    content,
    path: planPath,
  };
}

export function writePlan(
  sessionId: string,
  content: string,
  home?: string,
): PlanState {
  const dir = findSessionDir(sessionId, home);
  if (!dir) {
    throw new Error(`Session dir not found for ${sessionId}`);
  }
  const planPath = path.join(dir, "plan.md");
  fs.writeFileSync(planPath, content, "utf8");
  return {
    sessionId,
    status: "ready_for_approval",
    content,
    path: planPath,
  };
}

export function setPlanStatus(
  sessionId: string,
  status: PlanState["status"],
  home?: string,
): PlanState {
  const plan = loadPlan(sessionId, home) ?? {
    sessionId,
    status: "drafting",
    content: "",
  };
  const metaPath = findSessionDir(sessionId, home);
  if (metaPath) {
    fs.writeFileSync(
      path.join(metaPath, "plan_status.json"),
      JSON.stringify({ status }, null, 2),
      "utf8",
    );
  }
  return { ...plan, status };
}

export function loadSubagentTree(sessionId: string, home?: string): SubagentNode[] {
  const dir = findSessionDir(sessionId, home);
  if (!dir) return [];
  const treePath = path.join(dir, "subagents.json");
  if (fs.existsSync(treePath)) {
    try {
      return JSON.parse(fs.readFileSync(treePath, "utf8")) as SubagentNode[];
    } catch {
      return [];
    }
  }
  return [];
}

/** 将 agent subagent 状态映射为 ThreadStatus 兼容值 */
export function mapSubagentStatus(status: string): SubagentNode["status"] {
  const s = status.toLowerCase();
  if (s === "completed" || s === "complete" || s === "success") return "completed";
  if (s === "failed" || s === "error") return "failed";
  if (s === "cancelled" || s === "canceled") return "inactive";
  if (s === "blocked") return "blocked";
  if (s === "working" || s === "running" || s === "active" || s === "spawned")
    return "working";
  if (s === "idle") return "idle";
  return "unknown";
}

export function writeSubagentTree(
  sessionId: string,
  tree: SubagentNode[],
  home?: string,
): SubagentNode[] {
  const dir = findSessionDir(sessionId, home);
  if (!dir) {
    throw new Error(`Session dir not found for ${sessionId}`);
  }
  const pathTree = path.join(dir, "subagents.json");
  fs.writeFileSync(pathTree, JSON.stringify(tree, null, 2), "utf8");
  return tree;
}

/**
 * 按 id 插入或更新子 agent 节点，并落盘 subagents.json。
 * 供 ACP SubagentSpawned / Progress / Finished 事件投影使用。
 */
export function upsertSubagentNode(
  sessionId: string,
  node: SubagentNode,
  home?: string,
): SubagentNode[] {
  const prev = loadSubagentTree(sessionId, home);
  const idx = prev.findIndex((n) => n.id === node.id);
  const next: SubagentNode[] =
    idx >= 0
      ? prev.map((n, i) =>
          i === idx
            ? {
                ...n,
                ...node,
                summary: node.summary ?? n.summary,
                type: node.type || n.type,
              }
            : n,
        )
      : [...prev, node];
  return writeSubagentTree(sessionId, next, home);
}
