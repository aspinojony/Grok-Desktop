import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildGrokInfo,
  readAgentBinMeta,
  resolveGrokBinary,
} from "../src/host/resolve-grok.js";

describe("resolveGrokBinary", () => {
  it("prefers override over bundled and PATH", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grok-res-"));
    const fake = path.join(
      dir,
      process.platform === "win32" ? "grok.exe" : "grok",
    );
    fs.writeFileSync(fake, "");
    if (process.platform !== "win32") fs.chmodSync(fake, 0o755);

    const r = resolveGrokBinary({
      overridePath: fake,
      bundledPath: path.join(dir, "other"),
      env: { PATH: "" },
      home: dir,
    });
    expect(r.path).toBe(path.resolve(fake));
    expect(r.source).toBe("override");
  });

  it("prefers bundled over PATH", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grok-bun-"));
    const name = process.platform === "win32" ? "grok.exe" : "grok";
    const bundled = path.join(dir, "bundled-" + name);
    const onPath = path.join(dir, "path-" + name);
    fs.writeFileSync(bundled, "");
    fs.writeFileSync(onPath, "");
    if (process.platform !== "win32") {
      fs.chmodSync(bundled, 0o755);
      fs.chmodSync(onPath, 0o755);
    }
    const r = resolveGrokBinary({
      bundledPath: bundled,
      env: { PATH: dir },
      home: dir,
      extraPathDirs: [dir],
    });
    expect(r.path).toBe(path.resolve(bundled));
    expect(r.source).toBe("bundled");
  });

  it("returns missing when nothing found", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grok-miss-"));
    const r = resolveGrokBinary({
      env: { PATH: dir },
      home: dir,
      extraPathDirs: [dir],
    });
    expect(r.path).toBeNull();
    expect(r.source).toBe("missing");
  });

  it("buildGrokInfo reports capabilities.acp from path presence", () => {
    const info = buildGrokInfo({});
    expect(info.agentBinMeta === null || typeof info.agentBinMeta === "object").toBe(
      true,
    );
    if (info.path) {
      expect(info.capabilities.acp).toBe(true);
      expect(info.version === null || info.version.length > 0).toBe(true);
    } else {
      expect(info.capabilities.acp).toBe(false);
      expect(info.source).toBe("missing");
      expect(info.agentBinMeta).toBeNull();
    }
  });

  it("readAgentBinMeta parses VERSION.txt next to binary", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grok-ver-"));
    const name = process.platform === "win32" ? "grok.exe" : "grok";
    const bin = path.join(dir, name);
    fs.writeFileSync(bin, "");
    fs.writeFileSync(
      path.join(dir, "VERSION.txt"),
      [
        "version=1.2.3-test",
        "source=/tmp/src",
        "synced_at=2026-07-17T00:00:00.000Z",
        "sha256=abc123def456",
        "binary=" + name,
        "",
      ].join("\n"),
      "utf8",
    );
    const meta = readAgentBinMeta(bin);
    expect(meta?.version).toBe("1.2.3-test");
    expect(meta?.sha256).toBe("abc123def456");
    expect(meta?.source).toBe("/tmp/src");
    expect(readAgentBinMeta(null)).toBeNull();
  });
});
