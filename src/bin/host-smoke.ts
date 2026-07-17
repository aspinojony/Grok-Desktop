#!/usr/bin/env node
/**
 * Headless Host entry for S0 verification (no Electron required).
 * Usage:
 *   npx tsx src/bin/host-smoke.ts
 *   npx tsx src/bin/host-smoke.ts --cwd <path> --prompt "hi"
 *   GROK_DESKTOP_AGENT=node GROK_DESKTOP_AGENT_ARGS=test/fake-acp-agent.mjs ...
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { DesktopHost } from "../host/host.js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

async function main(): Promise<void> {
  const cwd = path.resolve(argValue("--cwd") ?? process.cwd());
  const prompt = argValue("--prompt") ?? "Reply with exactly: pong";
  const agentOverride = process.env.GROK_DESKTOP_AGENT;
  const agentArgsEnv = process.env.GROK_DESKTOP_AGENT_ARGS;

  const host = new DesktopHost({
    grokPath: agentOverride ?? undefined,
    agentArgs: agentArgsEnv
      ? agentArgsEnv.split(/\s+/).filter(Boolean)
      : agentOverride
        ? []
        : undefined,
  });

  const si = await host.initSingleInstance();
  console.log(
    JSON.stringify({
      event: "single_instance",
      isPrimary: si.isPrimary,
      port: si.port,
    }),
  );

  const info = host.grokInfo();
  console.log(JSON.stringify({ event: "grokInfo", info }));

  if (!si.isPrimary) {
    console.log(JSON.stringify({ event: "secondary_exit" }));
    await host.dispose();
    process.exit(0);
  }

  if (!info.path && !agentOverride) {
    console.error("BINARY_NOT_FOUND: grok not resolved");
    await host.dispose();
    process.exit(2);
  }

  const events: unknown[] = [];
  host.subscribe((ev) => {
    events.push(ev);
    console.log(JSON.stringify({ event: "normalized", data: ev }));
  });

  try {
    const created = await host.threadsCreate({
      cwd,
      prompt,
      title: "host-smoke",
      alwaysApprove: true,
    });
    console.log(JSON.stringify({ event: "threads.create", data: created }));

    const sessionDir = host.findSessionDir(created.sessionId);
    console.log(
      JSON.stringify({
        event: "session_dir",
        sessionId: created.sessionId,
        sessionDir,
      }),
    );

    const history = host.historyLoad(created.sessionId);
    console.log(
      JSON.stringify({
        event: "history.load",
        entryCount: history.entries.length,
        sessionDir: history.sessionDir,
      }),
    );

    console.log(
      JSON.stringify({
        event: "smoke_ok",
        threadId: created.threadId,
        sessionId: created.sessionId,
        normalizedEventCount: events.length,
      }),
    );
    await host.dispose();
    process.exit(0);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "smoke_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    await host.dispose();
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain || process.argv[1]?.includes("host-smoke")) {
  void main();
}
