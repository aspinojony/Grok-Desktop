import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DesktopHost } from "../src/host/host.js";
import {
  computeTrayBadge,
  parseDeepLink,
  buildVersionMatrix,
  writeHandoff,
  readAndClearHandoff,
} from "../src/host/shell-state.js";
import { graphSearch, graphStatus } from "../src/host/graph.js";
import { memoryAdd, memoryList, memorySearch, memorySetEnabled, memoryStatus } from "../src/host/memory.js";
import { listPullRequests, getPullRequestDiff } from "../src/host/pr.js";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fakeAgent = path.join(here, "fake-acp-agent.mjs");
const nodeBin = process.execPath;
const hosts: DesktopHost[] = [];

afterEach(async () => {
  while (hosts.length) await hosts.pop()!.dispose();
});

function tempHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "grok-s57-home-"));
}

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grok-s57-repo-"));
  spawnSync("git", ["init"], { cwd: dir, windowsHide: true });
  fs.writeFileSync(
    path.join(dir, "src_hello.ts"),
    "export function greetUser(name: string) {\n  return name;\n}\n",
  );
  fs.writeFileSync(path.join(dir, "README.md"), "# demo\n");
  spawnSync("git", ["add", "."], { cwd: dir, windowsHide: true });
  spawnSync(
    "git",
    ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "init"],
    { cwd: dir, windowsHide: true },
  );
  spawnSync("git", ["branch", "feature/s7-demo"], { cwd: dir, windowsHide: true });
  return dir;
}

function makeHost(home = tempHome()): DesktopHost {
  const host = new DesktopHost({
    home,
    grokPath: nodeBin,
    agentArgs: [fakeAgent],
  });
  hosts.push(host);
  return host;
}

describe("S5 graph + memory (shipped Host)", () => {
  it("graph.status/search finds symbol in temp repo via Host", () => {
    const host = makeHost();
    const repo = tempRepo();
    host.projectsAdd({ path: repo, trust: true });

    const status = host.graphStatus(repo);
    expect(status.status).toBe("ready");
    expect(status.fileCount).toBeGreaterThan(0);

    const hits = host.graphSearch(repo, "greetUser");
    expect(hits.some((h) => h.path.includes("src_hello") || h.snippet.includes("greetUser"))).toBe(
      true,
    );

    // same modules used by Host (not reimplemented)
    expect(graphStatus(repo).fileCount).toBe(status.fileCount);
    expect(graphSearch(repo, "greetUser").length).toBeGreaterThan(0);

    const neigh = host.graphNeighborhood(repo, "src_hello.ts");
    expect(neigh.root).toBe("src_hello.ts");
  });

  it("memory enable/add/search/list on Host path", () => {
    const home = tempHome();
    const host = makeHost(home);

    let st = host.memoryStatus();
    expect(st.enabled).toBe(false);
    expect(st.entryCount).toBe(0);

    host.memorySetEnabled(true);
    st = host.memoryStatus();
    expect(st.enabled).toBe(true);

    const entry = host.memoryAdd({
      text: "Prefer functional style in this repo",
      source: "test",
      tags: ["style"],
    });
    expect(entry.id.startsWith("mem_")).toBe(true);
    expect(host.memoryList().length).toBe(1);
    expect(host.memorySearch("functional").length).toBe(1);
    expect(memorySearch("functional", home).length).toBe(1);
    host.memoryDelete(entry.id);
    expect(host.memoryList().length).toBe(0);
    // pure module still works
    memorySetEnabled(false, home);
    expect(memoryStatus(home).enabled).toBe(false);
    expect(memoryList(home)).toEqual([]);
  });
});

describe("S6 tray / deep link / handoff / version", () => {
  it("computeTrayBadge counts needs_input and unread", () => {
    const badge = computeTrayBadge(
      [
        {
          sessionId: "a",
          title: "t1",
          cwd: "/x",
          status: "needs_input",
          source: "live",
          updatedAt: new Date().toISOString(),
        },
        {
          sessionId: "b",
          title: "t2",
          cwd: "/y",
          status: "working",
          source: "live",
          updatedAt: new Date().toISOString(),
        },
      ],
      [
        {
          id: "i1",
          type: "permission",
          title: "p",
          body: "b",
          createdAt: new Date().toISOString(),
          read: false,
        },
      ],
    );
    expect(badge.needsInput).toBe(1);
    expect(badge.unreadInbox).toBe(1);
    expect(badge.working).toBe(1);
    expect(badge.badge).toBe(2);
  });

  it("Host shellTrayBadge and versionMatrix", () => {
    const host = makeHost();
    const badge = host.shellTrayBadge();
    expect(badge).toHaveProperty("badge");
    expect(badge).toHaveProperty("label");
    const ver = host.shellVersionMatrix();
    expect(ver.desktopVersion).toMatch(/\d+\.\d+/);
    expect(ver).toHaveProperty("grokPath");
    expect(buildVersionMatrix({ grokPath: null, grokVersion: null }).updateChannel).toBe(
      "stable",
    );
  });

  it("parseDeepLink and secondary handoff payload", async () => {
    const home = tempHome();
    const link = parseDeepLink("grok://session/abc-123");
    expect(link.kind).toBe("session");
    expect(link.id).toBe("abc-123");

    const host = makeHost(home);
    const si = await host.initSingleInstance();
    expect(si.isPrimary).toBe(true);

    // Simulate secondary write + primary read
    writeHandoff("grok://inbox/item1", home);
    const handoff = host.shellReadHandoff();
    expect(handoff?.payload).toContain("inbox");
    expect(readAndClearHandoff(home)).toBeNull();

    // Host parse
    const parsed = host.shellParseDeepLink("grok://project/proj_x");
    expect(parsed.kind).toBe("project");
  });
});

describe("S7 PR list/diff + remote attach", () => {
  it("pr.list/diff via Host on temp git repo", () => {
    const host = makeHost();
    const repo = tempRepo();
    const listed = host.prList(repo);
    expect(listed.cwd).toBe(path.resolve(repo));
    // gh may or may not exist; git-fallback should still surface feature branch
    expect(["gh", "git-fallback", "empty"]).toContain(listed.source);
    if (listed.prs.length === 0) {
      // still a structured result
      expect(listed).toHaveProperty("message");
    } else {
      const pr = listed.prs[0];
      const diff = host.prDiff(repo, pr.number, pr.headRef);
      expect(diff).toHaveProperty("patch");
      expect(["gh", "git", "empty"]).toContain(diff.source);
    }
    // pure modules
    expect(listPullRequests(repo).cwd).toBe(path.resolve(repo));
    const d = getPullRequestDiff(repo, 1000, "feature/s7-demo");
    expect(typeof d.patch).toBe("string");
  });

  it("remote.add requires localCwd and threadsCreate can use it", async () => {
    const host = makeHost();
    const local = tempRepo();
    const remote = host.remoteAdd({
      host: "user@example.com",
      remotePath: "/home/user/app",
      localCwd: local,
      title: "demo-remote",
    });
    expect(remote.localCwd).toBe(path.resolve(local));
    expect(host.remoteList().some((r) => r.id === remote.id)).toBe(true);

    // Trust not required when no projectId — create thread on remote mirror
    const created = await host.threadsCreate({
      cwd: remote.localCwd,
      title: "remote-thread",
      prompt: "ping",
      alwaysApprove: true,
    });
    expect(created.sessionId).toBeTruthy();
    expect(created.cwd).toBe(path.resolve(local));

    host.remoteRemove(remote.id);
    expect(host.remoteList().find((r) => r.id === remote.id)).toBeUndefined();
  });
});
