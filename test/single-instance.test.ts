import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireSingleInstance } from "../src/host/single-instance.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

describe("single-instance lock", () => {
  it("primary acquires lock; secondary is not primary", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "grok-si-"));
    const a = await acquireSingleInstance({ home });
    cleanups.push(() => a.release());
    expect(a.isPrimary).toBe(true);
    expect(a.port).toBeTypeOf("number");

    const b = await acquireSingleInstance({ home });
    cleanups.push(() => b.release());
    expect(b.isPrimary).toBe(false);

    const notified = await b.notifyPrimary("focus");
    expect(notified).toBe(true);
  });

  it("writes lock under ~/.grok/desktop/lock relative to home", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "grok-si2-"));
    const a = await acquireSingleInstance({ home });
    cleanups.push(() => a.release());
    const lockPath = path.join(home, ".grok-desktop", "desktop", "lock");
    expect(fs.existsSync(lockPath)).toBe(true);
    const body = JSON.parse(fs.readFileSync(lockPath, "utf8")) as {
      pid: number;
      port: number;
    };
    expect(body.pid).toBe(process.pid);
    expect(body.port).toBe(a.port);
  });
});
