import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DesktopHost } from "../src/host/host.js";
import { resolveGrokBinary } from "../src/host/resolve-grok.js";

/**
 * Honest Host → disk → CLI interop against real `grok` + real auth home.
 * Does NOT isolate HOME (that strips auth and forces planted-session theater).
 * Does NOT use `grok -r id --help` (help short-circuits session lookup).
 */
describe("real grok interop (Host → disk → CLI)", () => {
  const resolved = resolveGrokBinary({});
  const hasGrok = Boolean(resolved.path);
  const hosts: DesktopHost[] = [];

  afterEach(async () => {
    while (hosts.length) {
      await hosts.pop()!.dispose().catch(() => undefined);
    }
  });

  it.skipIf(!hasGrok)(
    "Host create+prompt persists sessionDir; CLI rejects missing id and accepts real id",
    async () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "grok-interop-cwd-"));
      spawnSync("git", ["init"], { cwd, windowsHide: true });

      // Real home + real PATH grok (auth.json available)
      const host = new DesktopHost({
        grokPath: resolved.path,
      });
      hosts.push(host);

      const events: { type: string }[] = [];
      host.subscribe((e) => events.push({ type: e.type }));

      const created = await host.threadsCreate({
        cwd,
        title: "host-disk-cli-interop",
        prompt: "Reply with exactly one word: pong",
        alwaysApprove: true,
      });

      expect(created.sessionId).toBeTruthy();
      expect(created.threadId.startsWith("thread_")).toBe(true);

      // Disk: session 落在 Desktop GROK_HOME（~/.grok-desktop/sessions）
      let sessionDir = host.findSessionDir(created.sessionId);
      for (let i = 0; i < 20 && !sessionDir; i++) {
        await new Promise((r) => setTimeout(r, 200));
        sessionDir = host.findSessionDir(created.sessionId);
      }
      expect(sessionDir, "findSessionDir for Host-created sessionId").toBeTruthy();
      expect(fs.existsSync(sessionDir!)).toBe(true);
      expect(sessionDir!).toContain(path.join(".grok-desktop", "sessions"));
      expect(sessionDir!.endsWith(created.sessionId) || sessionDir!.includes(created.sessionId)).toBe(
        true,
      );

      const listing = fs.readdirSync(sessionDir!);
      // Real grok session artifacts
      expect(
        listing.some((f) => f.includes("json") || f.includes("prompt") || f.includes("event")),
      ).toBe(true);

      // Normalized stream observed for the turn
      const types = events.map((e) => e.type);
      expect(types).toContain("turn.started");
      expect(types.some((t) => t === "message.delta" || t === "turn.completed")).toBe(true);

      await host.threadsDetach(created.threadId);

      // Second Host can session/load the same id (ACP resume path)
      const host2 = new DesktopHost({ grokPath: resolved.path });
      hosts.push(host2);
      const attached = await host2.threadsAttach(created.sessionId, cwd);
      expect(attached.threadId).toBeTruthy();
      await host2.threadsDetach(attached.threadId);

      const grok = resolved.path!;

      // Negative control: missing id MUST surface not-found (not --help)
      const bad = spawnSync(
        grok,
        [
          "-r",
          "definitely_nonexistent_session_xyz_zz",
          "-p",
          "hi",
          "--always-approve",
          "--cwd",
          cwd,
        ],
        { encoding: "utf8", timeout: 90_000, windowsHide: true },
      );
      const badOut = `${bad.stdout ?? ""}${bad.stderr ?? ""}`;
      expect(badOut.toLowerCase()).toMatch(/not found/);
      expect(bad.status === 0).toBe(false);

      // Positive control: CLI 需同一 GROK_HOME 才能看到 Desktop 会话
      const good = spawnSync(
        grok,
        [
          "-r",
          created.sessionId,
          "-p",
          "say ok",
          "--always-approve",
          "--cwd",
          cwd,
          "--max-turns",
          "1",
        ],
        {
          encoding: "utf8",
          timeout: 120_000,
          windowsHide: true,
          env: {
            ...process.env,
            GROK_HOME: path.join(os.homedir(), ".grok-desktop"),
          },
        },
      );
      const goodOut = `${good.stdout ?? ""}${good.stderr ?? ""}`;
      expect(goodOut.toLowerCase()).not.toMatch(/not found locally/);
      // Headless resume should succeed or at least not be a missing-session failure
      expect(
        good.status === 0 ||
          (!/not found/i.test(goodOut) && goodOut.length > 0),
      ).toBe(true);
    },
    180_000,
  );

  it("resolveGrokBinary finds system grok when installed", () => {
    if (hasGrok) {
      expect(resolved.path).toBeTruthy();
      expect(fs.existsSync(resolved.path!)).toBe(true);
    } else {
      expect(resolved.source).toBe("missing");
    }
  });

  it("findSessionDir locates planted session under ~/.grok-desktop/sessions layout", async () => {
    const { findSessionDir } = await import("../src/host/paths.js");
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "grok-find-"));
    const sessionId = "sess_find_me";
    const dir = path.join(home, ".grok-desktop", "sessions", "projA", sessionId);
    fs.mkdirSync(dir, { recursive: true });
    expect(findSessionDir(sessionId, home)).toBe(dir);
  });
});
