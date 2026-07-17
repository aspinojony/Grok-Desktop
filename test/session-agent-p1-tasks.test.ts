import { describe, expect, it } from "vitest";
import { normalizeSessionNotification } from "../src/host/normalize.js";

describe("background tasks / monitor (N7)", () => {
  it("task_backgrounded yields task.updated phase backgrounded", () => {
    const evs = normalizeSessionNotification("t1", "sess-1", {
      sessionUpdate: "task_backgrounded",
      tool_call_id: "call-1",
      task_id: "task-abc",
      command: "npm test",
      cwd: "/tmp/proj",
      output_file: "/tmp/out.log",
    });
    expect(evs).toHaveLength(1);
    const ev = evs[0];
    expect(ev).toMatchObject({
      type: "task.updated",
      phase: "backgrounded",
      taskId: "task-abc",
      command: "npm test",
      toolCallId: "call-1",
    });
  });

  it("task_backgrounded with monitor_description marks isMonitor", () => {
    const evs = normalizeSessionNotification("t1", "sess-1", {
      sessionUpdate: "task_backgrounded",
      tool_call_id: "call-m",
      task_id: "mon-1",
      command: "[monitor] watch logs",
      cwd: "/tmp",
      output_file: "/tmp/m.log",
      monitor_description: "watch logs",
    });
    expect(evs[0]).toMatchObject({
      type: "task.updated",
      phase: "backgrounded",
      isMonitor: true,
      description: "watch logs",
    });
  });

  it("task_completed success with will_wake", () => {
    const evs = normalizeSessionNotification("t1", "sess-1", {
      sessionUpdate: "task_completed",
      will_wake: true,
      task_snapshot: {
        task_id: "task-ok",
        command: "sleep 1",
        cwd: "/tmp",
        exit_code: 0,
        completed: true,
        output: "done\n",
      },
    });
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      type: "task.updated",
      phase: "completed",
      taskId: "task-ok",
      success: true,
      willWake: true,
      exitCode: 0,
    });
  });

  it("task_completed failed with exit code", () => {
    const evs = normalizeSessionNotification("t1", "sess-1", {
      sessionUpdate: "task_completed",
      task_snapshot: {
        task_id: "task-fail",
        command: "false",
        cwd: "/tmp",
        exit_code: 1,
        completed: true,
      },
    });
    expect(evs[0]).toMatchObject({
      type: "task.updated",
      phase: "completed",
      success: false,
      exitCode: 1,
    });
  });

  it("task_completed session_restart is staleOnLoad", () => {
    const evs = normalizeSessionNotification("t1", "sess-1", {
      sessionUpdate: "task_completed",
      task_snapshot: {
        task_id: "task-stale",
        command: "tail -f x",
        cwd: "/tmp",
        signal: "session_restart",
        completed: true,
      },
    });
    expect(evs[0]).toMatchObject({
      type: "task.updated",
      phase: "completed",
      staleOnLoad: true,
      success: false,
    });
  });

  it("monitor_event yields phase monitor", () => {
    const evs = normalizeSessionNotification("t1", "sess-1", {
      sessionUpdate: "monitor_event",
      task_id: "mon-1",
      description: "watch CI",
      event_text: "build failed on main",
    });
    expect(evs[0]).toMatchObject({
      type: "task.updated",
      phase: "monitor",
      taskId: "mon-1",
      eventText: "build failed on main",
      isMonitor: true,
    });
  });

  it("PascalCase TaskCompleted via kind normalization", () => {
    const evs = normalizeSessionNotification("t1", "sess-1", {
      sessionUpdate: "TaskCompleted",
      willWake: true,
      taskSnapshot: {
        taskId: "task-cam",
        command: "echo hi",
        cwd: "/tmp",
        exitCode: 0,
        completed: true,
      },
    });
    // kind normalizer lowercases PascalCase → task_completed
    expect(evs.length).toBeGreaterThanOrEqual(1);
    expect(evs[0].type).toBe("task.updated");
    expect((evs[0] as { phase: string }).phase).toBe("completed");
  });
});
