import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireSingleInstance } from "../src/host/single-instance.js";
import {
  extractHandoffPayload,
  extractNavView,
  parseDeepLink,
  readAndClearHandoff,
  writeHandoff,
} from "../src/host/shell-state.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

describe("handoff / deep link shell fixes", () => {
  it("extractHandoffPayload and extractNavView parse activity field", () => {
    expect(extractHandoffPayload("handoff:grok://session/abc")).toBe(
      "grok://session/abc",
    );
    expect(extractHandoffPayload("nav:command")).toBeNull();
    expect(extractNavView("nav:inbox")).toBe("inbox");
    expect(extractNavView("handoff:x")).toBeNull();
  });

  it("parseDeepLink routes session/project/inbox/automation", () => {
    expect(parseDeepLink("grok://session/abc-123")).toMatchObject({
      kind: "session",
      id: "abc-123",
    });
    expect(parseDeepLink("grok://inbox/item1").kind).toBe("inbox");
    expect(parseDeepLink("grok://project/p1").kind).toBe("project");
    expect(parseDeepLink("grok://automation/a1").kind).toBe("automation");
  });

  it("primary TCP server persists secondary payload via writeHandoff", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "grok-handoff-tcp-"));
    const received: string[] = [];

    const primary = await acquireSingleInstance({
      home,
      onSecondaryPayload: (p) => received.push(p),
    });
    cleanups.push(() => primary.release());
    expect(primary.isPrimary).toBe(true);
    expect(primary.port).toBeTypeOf("number");

    const secondary = await acquireSingleInstance({ home });
    cleanups.push(() => secondary.release());
    expect(secondary.isPrimary).toBe(false);

    const ok = await secondary.notifyPrimary("grok://session/from-tcp");
    expect(ok).toBe(true);

    // Allow TCP end handler to flush
    await new Promise((r) => setTimeout(r, 200));

    // Callback and/or FS handoff must see payload
    const fromFs = readAndClearHandoff(home);
    const payload =
      received[0] ?? fromFs?.payload ?? null;
    expect(payload).toBe("grok://session/from-tcp");
    expect(extractHandoffPayload(`handoff:${payload}`)).toBe(
      "grok://session/from-tcp",
    );
  });

  it("writeHandoff + readAndClear is ordered for primary poll", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "grok-handoff-fs-"));
    writeHandoff("grok://inbox/x", home);
    const h = readAndClearHandoff(home);
    expect(h?.payload).toBe("grok://inbox/x");
    expect(readAndClearHandoff(home)).toBeNull();
  });
});
