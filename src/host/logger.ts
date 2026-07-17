import fs from "node:fs";
import path from "node:path";
import { desktopLogsDir, ensureDesktopDirs } from "./paths.js";

export class HostLogger {
  private stream: fs.WriteStream | null = null;
  private readonly filePath: string;

  constructor(home?: string) {
    ensureDesktopDirs(home);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.filePath = path.join(desktopLogsDir(home), `host-${stamp}.log`);
  }

  get path(): string {
    return this.filePath;
  }

  private ensureStream(): fs.WriteStream {
    if (!this.stream) {
      this.stream = fs.createWriteStream(this.filePath, { flags: "a" });
    }
    return this.stream;
  }

  log(level: "info" | "warn" | "error" | "debug", message: string, extra?: unknown): void {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      extra: extra === undefined ? undefined : extra,
    });
    try {
      this.ensureStream().write(line + "\n");
    } catch {
      // ignore disk errors in logger
    }
    if (level === "error") {
      console.error(`[host] ${message}`, extra ?? "");
    }
  }

  info(message: string, extra?: unknown): void {
    this.log("info", message, extra);
  }

  warn(message: string, extra?: unknown): void {
    this.log("warn", message, extra);
  }

  error(message: string, extra?: unknown): void {
    this.log("error", message, extra);
  }

  debug(message: string, extra?: unknown): void {
    this.log("debug", message, extra);
  }

  close(): void {
    this.stream?.end();
    this.stream = null;
  }
}
