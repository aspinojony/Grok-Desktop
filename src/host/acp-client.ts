import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";
import { HostError } from "../shared/errors.js";
import type { NormalizedEvent } from "../shared/events.js";
import type { HostLogger } from "./logger.js";
import {
  normalizeSessionNotification,
  normalizeSessionUpdate,
} from "./normalize.js";

type JsonRpcId = number | string;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

export interface AcpClientOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  logger?: HostLogger;
  threadId: string;
  onEvent: (event: NormalizedEvent) => void;
  allowFs?: boolean;
}

/**
 * JSON-RPC over stdio ACP client — the real path used by Desktop Host.
 */
export class AcpClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private nextId = 1;
  private pending = new Map<JsonRpcId, Pending>();
  private sessionId: string | null = null;
  private closed = false;
  /** True if we already streamed assistant message chunks this turn. */
  private streamedAssistantThisTurn = false;
  private permissionWaiters = new Map<
    string,
    { resolve: (optionId: string) => void }
  >();
  /** x.ai/exit_plan_mode 审批等待 */
  private planApprovalWaiters = new Map<
    string,
    {
      resolve: (resp: {
        outcome: "approved" | "cancelled" | "abandoned";
        feedback?: string;
      }) => void;
    }
  >();

  constructor(private readonly opts: AcpClientOptions) {}

  get attachedSessionId(): string | null {
    return this.sessionId;
  }

  async start(): Promise<void> {
    if (this.proc) return;

    this.opts.logger?.info("acp.spawn", {
      command: this.opts.command,
      args: this.opts.args,
    });

    this.proc = spawn(this.opts.command, this.opts.args, {
      cwd: this.opts.cwd,
      env: this.opts.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.proc.on("error", (err) => {
      this.opts.logger?.error("acp.process_error", { err: String(err) });
      this.failAll(
        new HostError("AGENT_CRASHED", `Agent process error: ${err.message}`),
      );
    });

    this.proc.on("exit", (code, signal) => {
      this.opts.logger?.info("acp.exit", { code, signal });
      if (!this.closed) {
        this.failAll(
          new HostError(
            "AGENT_CRASHED",
            `Agent exited (code=${code}, signal=${signal})`,
          ),
        );
        this.opts.onEvent({
          type: "agent.error",
          threadId: this.opts.threadId,
          sessionId: this.sessionId ?? undefined,
          message: `Agent exited (code=${code})`,
          code: "AGENT_CRASHED",
        });
      }
    });

    this.proc.stderr.on("data", (buf: Buffer) => {
      const text = buf.toString("utf8").trim();
      if (text) {
        this.opts.logger?.debug("acp.stderr", { text: text.slice(0, 2000) });
      }
    });

    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.rl.on("line", (line) => this.onLine(line));

    await this.request("initialize", {
      protocolVersion: 1,
      clientInfo: {
        name: "grok-desktop",
        version: "0.1.0",
      },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: false },
        terminal: false,
      },
    });

    this.notify("notifications/initialized", {});
  }

  async createSession(params: {
    cwd: string;
    mcpServers?: unknown[];
    meta?: Record<string, unknown>;
  }): Promise<string> {
    const result = (await this.request("session/new", {
      cwd: params.cwd,
      mcpServers: params.mcpServers ?? [],
      ...(params.meta ? { _meta: params.meta } : {}),
    })) as { sessionId?: string };

    if (!result?.sessionId) {
      throw new HostError(
        "INTERNAL",
        "session/new did not return sessionId",
        result,
      );
    }
    this.sessionId = result.sessionId;
    this.opts.onEvent({
      type: "session.status",
      threadId: this.opts.threadId,
      sessionId: this.sessionId,
      status: "idle",
    });
    return this.sessionId;
  }

  async loadSession(params: {
    sessionId: string;
    cwd: string;
    mcpServers?: unknown[];
  }): Promise<string> {
    const result = (await this.request("session/load", {
      sessionId: params.sessionId,
      cwd: params.cwd,
      mcpServers: params.mcpServers ?? [],
    })) as { sessionId?: string };

    this.sessionId = result?.sessionId ?? params.sessionId;
    this.opts.onEvent({
      type: "session.status",
      threadId: this.opts.threadId,
      sessionId: this.sessionId,
      status: "idle",
    });
    return this.sessionId;
  }

  async prompt(text: string): Promise<{ stopReason?: string }> {
    if (!this.sessionId) {
      throw new HostError("NOT_ATTACHED", "No ACP session attached");
    }

    this.streamedAssistantThisTurn = false;
    this.opts.onEvent({
      type: "turn.started",
      threadId: this.opts.threadId,
      sessionId: this.sessionId,
    });
    this.opts.onEvent({
      type: "session.status",
      threadId: this.opts.threadId,
      sessionId: this.sessionId,
      status: "working",
    });

    try {
      const result = (await this.request(
        "session/prompt",
        {
          sessionId: this.sessionId,
          prompt: [{ type: "text", text }],
        },
        300_000,
      )) as { stopReason?: string; text?: string };

      // Only emit final text if no streaming chunks were received (avoid duplicate full paste)
      if (result?.text && !this.streamedAssistantThisTurn) {
        this.opts.onEvent({
          type: "message.delta",
          threadId: this.opts.threadId,
          sessionId: this.sessionId,
          role: "assistant",
          text: result.text,
        });
      }

      this.opts.onEvent({
        type: "turn.completed",
        threadId: this.opts.threadId,
        sessionId: this.sessionId,
        stopReason: result?.stopReason,
      });
      this.opts.onEvent({
        type: "session.status",
        threadId: this.opts.threadId,
        sessionId: this.sessionId,
        status: "idle",
      });
      return result ?? {};
    } catch (err) {
      this.opts.onEvent({
        type: "session.status",
        threadId: this.opts.threadId,
        sessionId: this.sessionId,
        status: "failed",
      });
      throw err;
    }
  }

  async cancel(): Promise<void> {
    if (!this.sessionId) return;
    try {
      await this.request("session/cancel", { sessionId: this.sessionId });
    } catch (err) {
      this.opts.logger?.warn("acp.cancel_failed", { err: String(err) });
    }
  }

  /**
   * ACP 扩展方法：wire 名为 `_x.ai/...`（无下划线前缀会 Method not found）。
   */
  async extMethod(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 60_000,
  ): Promise<unknown> {
    const m = method.startsWith("_") ? method : `_${method}`;
    return this.request(m, params, timeoutMs);
  }

  /** 列出可回退点（每条 user prompt 一个） */
  async rewindPoints(): Promise<{
    rewind_points: Array<{
      prompt_index: number;
      created_at?: string;
      num_file_snapshots?: number;
      has_file_changes?: boolean;
      prompt_preview?: string;
    }>;
  }> {
    if (!this.sessionId) {
      throw new HostError("NOT_ATTACHED", "No ACP session attached");
    }
    const result = (await this.extMethod("_x.ai/rewind/points", {
      sessionId: this.sessionId,
    })) as {
      rewind_points?: Array<Record<string, unknown>>;
      rewindPoints?: Array<Record<string, unknown>>;
    };
    const raw = result?.rewind_points ?? result?.rewindPoints ?? [];
    return {
      rewind_points: raw.map((p) => ({
        prompt_index: Number(p.prompt_index ?? p.promptIndex ?? 0),
        created_at: (p.created_at ?? p.createdAt) as string | undefined,
        num_file_snapshots: Number(
          p.num_file_snapshots ?? p.numFileSnapshots ?? 0,
        ),
        has_file_changes: Boolean(p.has_file_changes ?? p.hasFileChanges),
        prompt_preview: (p.prompt_preview ?? p.promptPreview) as
          | string
          | undefined,
      })),
    };
  }

  /**
   * 完整回退：对话 + 文件（mode=all）。
   * targetPromptIndex：恢复到该 user prompt **执行前**（丢弃 index 及之后）。
   */
  async rewindExecute(
    targetPromptIndex: number,
    opts?: { force?: boolean },
  ): Promise<{
    success: boolean;
    target_prompt_index: number;
    mode?: string;
    reverted_files?: string[];
    clean_files?: string[];
    conflicts?: Array<{ path?: string; conflict_type?: string }>;
    prompt_text?: string;
    error?: string;
  }> {
    if (!this.sessionId) {
      throw new HostError("NOT_ATTACHED", "No ACP session attached");
    }
    if (!Number.isFinite(targetPromptIndex) || targetPromptIndex < 0) {
      throw new HostError("INVALID_ARGUMENT", "invalid targetPromptIndex");
    }
    const result = (await this.extMethod(
      "_x.ai/rewind/execute",
      {
        sessionId: this.sessionId,
        targetPromptIndex,
        // agent：false=dry-run 预览；true=真正执行
        force: opts?.force === true,
        mode: "all",
      },
      120_000,
    )) as Record<string, unknown>;

    const conflicts = (result.conflicts as Array<Record<string, unknown>>) ?? [];
    return {
      success: result.success === true,
      target_prompt_index: Number(
        result.target_prompt_index ?? result.targetPromptIndex ?? targetPromptIndex,
      ),
      mode: (result.mode as string) ?? "all",
      reverted_files: (result.reverted_files ??
        result.revertedFiles ??
        []) as string[],
      clean_files: (result.clean_files ?? result.cleanFiles ?? []) as string[],
      conflicts: conflicts.map((c) => ({
        path: c.path as string | undefined,
        conflict_type: (c.conflict_type ?? c.conflictType) as string | undefined,
      })),
      prompt_text: (result.prompt_text ?? result.promptText) as string | undefined,
      error:
        typeof result.error === "string"
          ? result.error
          : result.error != null
            ? String(result.error)
            : undefined,
    };
  }

  /**
   * 会话中途切换模型 / 推理力度（对齐 CLI `/model` `/effort`）。
   * wire 方法名：当前 grok agent 认 `session/set_model`（snake）；
   * 部分文档/leader 测试写 `session/setModel`（camel）— 失败时回退尝试。
   * params: { sessionId, modelId, _meta?: { reasoningEffort } }
   */
  async setModel(
    modelId: string,
    opts?: { effort?: string },
  ): Promise<void> {
    if (!this.sessionId) {
      throw new HostError("NOT_ATTACHED", "No ACP session attached");
    }
    const id = modelId.trim();
    if (!id) {
      throw new HostError("INVALID_ARGUMENT", "modelId is required");
    }
    const params: Record<string, unknown> = {
      sessionId: this.sessionId,
      modelId: id,
    };
    const effort = (opts?.effort ?? "").toString().trim().toLowerCase();
    if (effort && ["low", "medium", "high", "xhigh"].includes(effort)) {
      params._meta = { reasoningEffort: effort };
    }
    // 实测 grok 0.2.x：session/set_model 可用；session/setModel → Method not found
    const methods = ["session/set_model", "session/setModel"] as const;
    let lastErr: unknown;
    for (const method of methods) {
      try {
        await this.request(method, params, 30_000);
        this.opts.logger?.info("acp.setModel", {
          sessionId: this.sessionId,
          modelId: id,
          effort: effort || undefined,
          method,
        });
        return;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!/method not found/i.test(msg)) throw err;
        this.opts.logger?.warn("acp.setModel_method_fallback", {
          method,
          msg,
        });
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new HostError("INTERNAL", String(lastErr));
  }

  respondPermission(
    requestId: string,
    decision: "allow_once" | "allow_session" | "allow_always" | "deny",
  ): void {
    const waiter = this.permissionWaiters.get(requestId);
    if (!waiter) {
      throw new HostError(
        "INVALID_ARGUMENT",
        `Unknown permission requestId: ${requestId}`,
      );
    }
    this.permissionWaiters.delete(requestId);
    const optionId =
      decision === "deny"
        ? "reject"
        : decision === "allow_always"
          ? "allow_always"
          : decision === "allow_session"
            ? "allow_session"
            : "allow_once";
    waiter.resolve(optionId);
  }

  /**
   * 会话模式切换（对齐 CLI /plan · Shift+Tab）。
   * ACP: session/set_mode { sessionId, modeId: "plan" | "default" | "ask" }
   */
  async setSessionMode(modeId: "plan" | "default" | "ask"): Promise<void> {
    if (!this.sessionId) {
      throw new HostError("NOT_ATTACHED", "No ACP session attached");
    }
    const params = {
      sessionId: this.sessionId,
      modeId,
    };
    const methods = ["session/set_mode", "session/setMode"] as const;
    let lastErr: unknown;
    for (const method of methods) {
      try {
        await this.request(method, params, 20_000);
        this.opts.logger?.info("acp.setSessionMode", {
          sessionId: this.sessionId,
          modeId,
          method,
        });
        this.opts.onEvent({
          type: "plan.mode.changed",
          threadId: this.opts.threadId,
          sessionId: this.sessionId,
          modeId,
          active: modeId === "plan",
        });
        return;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!/method not found/i.test(msg)) throw err;
        this.opts.logger?.warn("acp.setSessionMode_fallback", { method, msg });
      }
    }
    // 回退：ext 通知 toggle（仅翻转，无绝对 mode）
    if (modeId === "plan" || modeId === "default") {
      try {
        this.notify("x.ai/toggle_plan_mode", {
          sessionId: this.sessionId,
        });
        this.opts.onEvent({
          type: "plan.mode.changed",
          threadId: this.opts.threadId,
          sessionId: this.sessionId,
          modeId,
          active: modeId === "plan",
        });
        return;
      } catch {
        /* fall through */
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new HostError("INTERNAL", String(lastErr));
  }

  /** 是否有未决 plan 审批（含精确 requestId 或任意一个） */
  hasPlanApproval(requestId?: string): boolean {
    if (requestId) return this.planApprovalWaiters.has(requestId);
    return this.planApprovalWaiters.size > 0;
  }

  /** 响应用户对 exit_plan_mode 的审批 */
  respondPlanApproval(
    requestId: string,
    outcome: "approved" | "cancelled" | "abandoned",
    feedback?: string,
  ): void {
    let waiter = this.planApprovalWaiters.get(requestId);
    let resolvedId = requestId;
    // 容错：requestId 对不上时，若仅有一个未决审批则认领
    if (!waiter && this.planApprovalWaiters.size === 1) {
      const only = this.planApprovalWaiters.entries().next().value as
        | [string, { resolve: (r: {
            outcome: "approved" | "cancelled" | "abandoned";
            feedback?: string;
          }) => void }]
        | undefined;
      if (only) {
        resolvedId = only[0];
        waiter = only[1];
        this.opts.logger?.warn("acp.plan_approval_id_fallback", {
          wanted: requestId,
          used: resolvedId,
        });
      }
    }
    if (!waiter) {
      throw new HostError(
        "INVALID_ARGUMENT",
        `Unknown plan approval requestId: ${requestId}`,
      );
    }
    this.planApprovalWaiters.delete(resolvedId);
    waiter.resolve({
      outcome,
      feedback: feedback?.trim() || undefined,
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    this.failAll(new HostError("AGENT_CRASHED", "ACP client closed"));
    this.rl?.close();
    this.rl = null;
    if (this.proc && !this.proc.killed) {
      this.proc.kill();
    }
    this.proc = null;
  }

  private failAll(err: Error): void {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
    // 未决 plan 审批：放弃
    for (const [id, w] of this.planApprovalWaiters) {
      w.resolve({ outcome: "abandoned" });
      this.planApprovalWaiters.delete(id);
    }
  }

  private notify(method: string, params: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  private request(
    method: string,
    params: unknown,
    timeoutMs = 120_000,
  ): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new HostError("TIMEOUT", `ACP request timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  private respond(id: JsonRpcId, result: unknown): void {
    this.write({ jsonrpc: "2.0", id, result });
  }

  private respondError(id: JsonRpcId, message: string): void {
    this.write({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message },
    });
  }

  private write(msg: unknown): void {
    if (!this.proc?.stdin.writable) {
      throw new HostError("AGENT_CRASHED", "Agent stdin not writable");
    }
    this.proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  private onLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      this.opts.logger?.warn("acp.bad_json", { line: trimmed.slice(0, 200) });
      return;
    }

    if ("id" in msg && (msg.result !== undefined || msg.error !== undefined)) {
      const id = msg.id as JsonRpcId;
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      if (msg.error) {
        const err = msg.error as {
          message?: string;
          data?: unknown;
          code?: number | string;
        };
        // 透传 data（如 MODEL_SWITCH_INCOMPATIBLE_AGENT），供 UI 对齐 CLI 新会话确认
        pending.reject(
          new HostError(
            "INTERNAL",
            err.message ?? "ACP error",
            err.data !== undefined
              ? { code: err.code, message: err.message, data: err.data }
              : msg.error,
          ),
        );
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    const method = msg.method as string | undefined;
    if (!method) return;

    // session/update + _x.ai/* 扩展（goal_updated 常走 _x.ai/session/update）
    if (
      method === "session/update" ||
      method === "_x.ai/session/update" ||
      method.endsWith("/session/update")
    ) {
      const params = (msg.params ?? {}) as Record<string, unknown>;
      const update = (params.update ?? params) as Record<string, unknown>;
      const sid = (params.sessionId as string) ?? this.sessionId ?? "unknown";
      for (const ev of normalizeSessionUpdate(this.opts.threadId, sid, update)) {
        if (ev.type === "message.delta" && ev.role === "assistant") {
          this.streamedAssistantThisTurn = true;
        }
        this.opts.onEvent(ev);
      }
      return;
    }

    // auto-compact 等：x.ai/session_notification
    if (
      method === "x.ai/session_notification" ||
      method === "_x.ai/session_notification" ||
      method.endsWith("/session_notification")
    ) {
      const params = (msg.params ?? {}) as Record<string, unknown>;
      const sid =
        (params.sessionId as string) ??
        this.sessionId ??
        "unknown";
      const update = (params.update ?? params) as Record<string, unknown>;
      for (const ev of normalizeSessionNotification(
        this.opts.threadId,
        sid,
        update,
      )) {
        this.opts.onEvent(ev);
      }
      return;
    }

    if (
      method === "session/request_permission" ||
      method === "request_permission"
    ) {
      void this.handlePermissionRequest(msg);
      return;
    }

    // Plan 审批：shell → client reverse request
    if (
      method === "x.ai/exit_plan_mode" ||
      method === "exit_plan_mode" ||
      method.endsWith("/exit_plan_mode")
    ) {
      void this.handleExitPlanMode(msg);
      return;
    }

    if (method === "fs/read_text_file" || method === "read_text_file") {
      void this.handleReadTextFile(msg);
      return;
    }

    if ("id" in msg) {
      this.respondError(msg.id as JsonRpcId, `Unsupported method: ${method}`);
    }
  }

  private async handleExitPlanMode(msg: Record<string, unknown>): Promise<void> {
    const id = msg.id as JsonRpcId;
    const params = (msg.params ?? {}) as Record<string, unknown>;
    const requestId = `plan_${this.opts.threadId}_${String(id)}`;
    const sid =
      (params.sessionId as string) ??
      this.sessionId ??
      "unknown";
    const planContent =
      (params.planContent as string | undefined) ??
      (params.plan_content as string | undefined) ??
      null;
    const toolCallId =
      (params.toolCallId as string | undefined) ??
      (params.tool_call_id as string | undefined);

    this.opts.onEvent({
      type: "plan.approval.requested",
      threadId: this.opts.threadId,
      sessionId: sid,
      requestId,
      toolCallId,
      planContent,
      raw: params,
    });
    this.opts.onEvent({
      type: "session.status",
      threadId: this.opts.threadId,
      sessionId: sid,
      status: "needs_input",
    });

    const decision = await new Promise<{
      outcome: "approved" | "cancelled" | "abandoned";
      feedback?: string;
    }>((resolve) => {
      this.planApprovalWaiters.set(requestId, { resolve });
    });

    // camelCase wire（对齐 ExitPlanModeExtResponse：outcome + optional feedback）
    try {
      this.respond(id, {
        outcome: decision.outcome,
        ...(decision.feedback ? { feedback: decision.feedback } : {}),
      });
      this.opts.logger?.info("acp.exit_plan_mode_responded", {
        requestId,
        outcome: decision.outcome,
        hasFeedback: Boolean(decision.feedback),
      });
      this.opts.onEvent({
        type: "session.status",
        threadId: this.opts.threadId,
        sessionId: sid,
        status: "working",
      });
    } catch (err) {
      this.opts.logger?.warn("acp.exit_plan_mode_respond_failed", {
        requestId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async handlePermissionRequest(
    msg: Record<string, unknown>,
  ): Promise<void> {
    const id = msg.id as JsonRpcId;
    const params = (msg.params ?? {}) as Record<string, unknown>;
    const requestId = `perm_${this.opts.threadId}_${String(id)}`;
    const sid = this.sessionId ?? (params.sessionId as string) ?? "unknown";

    const toolCall = params.toolCall as Record<string, unknown> | undefined;
    const summary =
      (params.description as string) ??
      (toolCall?.title as string) ??
      (toolCall?.kind as string) ??
      JSON.stringify(params).slice(0, 200);

    this.opts.onEvent({
      type: "permission.requested",
      threadId: this.opts.threadId,
      sessionId: sid,
      requestId,
      summary,
      raw: params,
    });
    this.opts.onEvent({
      type: "session.status",
      threadId: this.opts.threadId,
      sessionId: sid,
      status: "needs_input",
    });

    const optionId = await new Promise<string>((resolve) => {
      this.permissionWaiters.set(requestId, { resolve });
    });

    this.respond(id, {
      outcome: { outcome: "selected", optionId },
      selectedOption: optionId,
    });
  }

  private async handleReadTextFile(msg: Record<string, unknown>): Promise<void> {
    const id = msg.id as JsonRpcId;
    if (!this.opts.allowFs) {
      this.respondError(id, "fs read not allowed");
      return;
    }
    try {
      const params = (msg.params ?? {}) as { path?: string };
      const fs = await import("node:fs/promises");
      const content = await fs.readFile(params.path ?? "", "utf8");
      this.respond(id, { content });
    } catch (err) {
      this.respondError(id, err instanceof Error ? err.message : String(err));
    }
  }
}
