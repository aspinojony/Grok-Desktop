import fs from "node:fs";
import path from "node:path";
import { HostError } from "../shared/errors.js";
import { desktopDir, ensureDesktopDirs } from "./paths.js";

export interface RemoteProject {
  id: string;
  title: string;
  /** SSH-style host, e.g. user@host */
  host: string;
  /** Remote absolute path */
  remotePath: string;
  /** Local mirror / mount path used as Thread cwd */
  localCwd: string;
  createdAt: string;
}

interface RemoteFile {
  version: number;
  remotes: RemoteProject[];
}

function file(home?: string): string {
  return path.join(desktopDir(home), "remote-projects.json");
}

function read(home?: string): RemoteFile {
  ensureDesktopDirs(home);
  const f = file(home);
  if (!fs.existsSync(f)) return { version: 1, remotes: [] };
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as RemoteFile;
  } catch {
    return { version: 1, remotes: [] };
  }
}

function write(data: RemoteFile, home?: string): void {
  const f = file(home);
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, f);
}

export function listRemoteProjects(home?: string): RemoteProject[] {
  return read(home).remotes;
}

/**
 * Register a remote project attach path.
 * For local dev/tests, localCwd must exist (SSHFS mount or mirror checkout).
 */
export function addRemoteProject(
  input: {
    title?: string;
    host: string;
    remotePath: string;
    localCwd: string;
  },
  home?: string,
): RemoteProject {
  const localCwd = path.resolve(input.localCwd);
  if (!fs.existsSync(localCwd) || !fs.statSync(localCwd).isDirectory()) {
    throw new HostError(
      "IO_ERROR",
      `Remote localCwd does not exist (mount or mirror first): ${localCwd}`,
    );
  }
  const now = new Date().toISOString();
  const remote: RemoteProject = {
    id: `remote_${Buffer.from(`${input.host}:${input.remotePath}`).toString("hex").slice(0, 16)}`,
    title: input.title ?? `${input.host}:${input.remotePath}`,
    host: input.host,
    remotePath: input.remotePath,
    localCwd,
    createdAt: now,
  };
  const data = read(home);
  const existing = data.remotes.find((r) => r.id === remote.id);
  if (existing) {
    existing.localCwd = localCwd;
    existing.title = remote.title;
    write(data, home);
    return existing;
  }
  data.remotes.push(remote);
  write(data, home);
  return remote;
}

export function removeRemoteProject(id: string, home?: string): void {
  const data = read(home);
  data.remotes = data.remotes.filter((r) => r.id !== id);
  write(data, home);
}

export function getRemoteProject(id: string, home?: string): RemoteProject | undefined {
  return read(home).remotes.find((r) => r.id === id);
}
