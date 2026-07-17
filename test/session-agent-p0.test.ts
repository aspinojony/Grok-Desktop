import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyAgentGoalProjection,
  loadGoal,
  loadSubagentTree,
  mapAgentGoalStatus,
  mapSubagentStatus,
  syncGoalFromAgentLog,
  upsertSubagentNode,
} from "../src/host/goals.js";
import {
  normalizeSessionNotification,
  normalizeSessionUpdate,
} from "../src/host/normalize.js";
import { DesktopHost } from "../src/host/host.js";

const fakeAgent = path.join(__dirname, "fake-acp-agent.mjs");
const homes: string[] = [];

function tempHome(): string {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "grok-goal-"));
  homes.push(h);
  return h;
}

function plantSession(home: string, sessionId: string, cwd: string): string {
  const enc = encodeURIComponent(path.resolve(cwd));
  const dir = path.join(home, ".grok-desktop", "sessions", enc, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "summary.json"),
    JSON.stringify({
      title: "t",
      updated_at: new Date().toISOString(),
      info: { cwd: path.resolve(cwd), id: sessionId },
    }),
    "utf8",
  );
  return dir;
}

afterEach(() => {
  while (homes.length) {
    const h = homes.pop()!;
    try {
      fs.rmSync(h, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("goal projection (A12)", () => {
  it("mapAgentGoalStatus covers agent wire statuses", () => {
    expect(mapAgentGoalStatus("complete")).toBe("completed");
    expect(mapAgentGoalStatus("user_paused")).toBe("paused");
    expect(mapAgentGoalStatus("cleared")).toBe("cancelled");
    expect(mapAgentGoalStatus("active")).toBe("active");
  });

  it("applyAgentGoalProjection creates goal.json without prior file", () => {
    const home = tempHome();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cwd-"));
    homes.push(cwd);
    const sid = "sess_goal_new";
    plantSession(home, sid, cwd);
    expect(loadGoal(sid, home)).toBeNull();
    const state = applyAgentGoalProjection(sid, "Ship feature X", "active", home);
    expect(state.title).toBe("Ship feature X");
    expect(state.status).toBe("active");
    expect(loadGoal(sid, home)?.title).toBe("Ship feature X");
  });

  it("syncGoalFromAgentLog projects when only updates.jsonl has goal_updated", () => {
    const home = tempHome();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cwd-"));
    homes.push(cwd);
    const sid = "sess_goal_sync";
    const dir = plantSession(home, sid, cwd);
    const line = JSON.stringify({
      params: {
        update: {
          sessionUpdate: "goal_updated",
          objective: "From agent log",
          status: "active",
          last_event: "goal_created",
        },
      },
    });
    fs.writeFileSync(path.join(dir, "updates.jsonl"), line + "\n", "utf8");
    const { state, agent } = syncGoalFromAgentLog(sid, home);
    expect(agent?.objective).toBe("From agent log");
    expect(state?.title).toBe("From agent log");
    expect(loadGoal(sid, home)?.status).toBe("active");
  });

  it("normalizeSessionUpdate goal_updated yields goal.updated", () => {
    const evs = normalizeSessionUpdate("th1", "s1", {
      sessionUpdate: "goal_updated",
      objective: "Obj",
      status: "active",
      goal_id: "g1",
    });
    expect(evs.some((e) => e.type === "goal.updated")).toBe(true);
  });
});

describe("subagent events (A6)", () => {
  it("normalizeSessionNotification maps spawned/progress/finished", () => {
    const spawned = normalizeSessionNotification("th", "parent", {
      sessionUpdate: "subagent_spawned",
      subagent_id: "sub-1",
      parent_session_id: "parent",
      child_session_id: "child-1",
      subagent_type: "explore",
      description: "scan repo",
    });
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toMatchObject({
      type: "subagent.updated",
      phase: "spawned",
      subagentId: "sub-1",
      subagentType: "explore",
    });

    const progress = normalizeSessionNotification("th", "parent", {
      sessionUpdate: "subagent_progress",
      subagent_id: "sub-1",
      parent_session_id: "parent",
      child_session_id: "child-1",
      duration_ms: 2000,
      turn_count: 2,
      tool_call_count: 5,
    });
    expect(progress[0]).toMatchObject({
      type: "subagent.updated",
      phase: "progress",
      turnCount: 2,
    });

    const finished = normalizeSessionNotification("th", "parent", {
      sessionUpdate: "subagent_finished",
      subagent_id: "sub-1",
      child_session_id: "child-1",
      status: "completed",
      turns: 3,
      tool_calls: 8,
      duration_ms: 9000,
      output: "done",
    });
    expect(finished[0]).toMatchObject({
      type: "subagent.updated",
      phase: "finished",
      status: "completed",
    });
  });

  it("upsertSubagentNode persists subagents.json", () => {
    const home = tempHome();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cwd-"));
    homes.push(cwd);
    const sid = "sess_sub";
    plantSession(home, sid, cwd);
    expect(loadSubagentTree(sid, home)).toEqual([]);
    upsertSubagentNode(
      sid,
      {
        id: "sub-1",
        type: "explore",
        status: mapSubagentStatus("working"),
        summary: "scan",
        childSessionId: "child-1",
      },
      home,
    );
    const tree = loadSubagentTree(sid, home);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("sub-1");
    upsertSubagentNode(
      sid,
      {
        id: "sub-1",
        type: "explore",
        status: mapSubagentStatus("completed"),
        summary: "done",
      },
      home,
    );
    expect(loadSubagentTree(sid, home)[0]?.status).toBe("completed");
  });
});

describe("threadsContinueRecent (S2)", () => {
  it("returns null when no sessions", () => {
    const home = tempHome();
    const host = new DesktopHost({
      home,
      agentArgs: [fakeAgent],
      env: { ...process.env, GROK_HOME: path.join(home, ".grok-desktop") },
    });
    expect(host.threadsContinueRecent()).toBeNull();
  });

  it("returns most recently updated disk session", async () => {
    const home = tempHome();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cwd-"));
    homes.push(cwd);
    const older = "sess_old";
    const newer = "sess_new";
    const d1 = plantSession(home, older, cwd);
    const d2 = plantSession(home, newer, cwd);
    fs.writeFileSync(
      path.join(d1, "summary.json"),
      JSON.stringify({
        title: "Old chat",
        updated_at: "2020-01-01T00:00:00.000Z",
        info: { cwd: path.resolve(cwd), id: older },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(d2, "summary.json"),
      JSON.stringify({
        title: "New chat",
        updated_at: "2030-01-01T00:00:00.000Z",
        info: { cwd: path.resolve(cwd), id: newer },
      }),
      "utf8",
    );
    // roster reads summary for title/updatedAt
    const host = new DesktopHost({
      home,
      agentArgs: [fakeAgent],
      env: { ...process.env, GROK_HOME: path.join(home, ".grok-desktop") },
    });
    const recent = host.threadsContinueRecent();
    expect(recent).toBeTruthy();
    expect(recent!.sessionId).toBe(newer);
    expect(recent!.title).toMatch(/New|chat|sess/i);
    expect(recent!.cwd).toBeTruthy();
  });
});
