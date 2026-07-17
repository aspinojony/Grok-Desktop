import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Project } from "../shared/types.js";
import { HostError } from "../shared/errors.js";
import { desktopDir, ensureDesktopDirs } from "./paths.js";

interface ProjectsFile {
  version: number;
  projects: Project[];
}

function projectsPath(home?: string): string {
  return path.join(desktopDir(home), "projects.json");
}

function normalizePath(p: string): string {
  return path.resolve(p);
}

function projectIdForPath(p: string): string {
  const h = createHash("sha256").update(normalizePath(p).toLowerCase()).digest("hex");
  return `proj_${h.slice(0, 16)}`;
}

export class ProjectRegistry {
  constructor(private readonly home?: string) {
    ensureDesktopDirs(home);
  }

  private read(): ProjectsFile {
    const file = projectsPath(this.home);
    if (!fs.existsSync(file)) {
      return { version: 1, projects: [] };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ProjectsFile;
      return { version: raw.version ?? 1, projects: raw.projects ?? [] };
    } catch {
      return { version: 1, projects: [] };
    }
  }

  private write(data: ProjectsFile): void {
    ensureDesktopDirs(this.home);
    const file = projectsPath(this.home);
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, file);
  }

  list(opts?: { includeArchived?: boolean }): Project[] {
    const all = this.read().projects;
    const filtered = opts?.includeArchived ? all : all.filter((p) => !p.archived);
    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
    });
  }

  get(id: string): Project | undefined {
    return this.read().projects.find((p) => p.id === id);
  }

  findByPath(p: string): Project | undefined {
    const n = normalizePath(p);
    return this.read().projects.find(
      (x) => normalizePath(x.path).toLowerCase() === n.toLowerCase(),
    );
  }

  add(input: { path: string; title?: string; trust?: boolean }): Project {
    const resolved = normalizePath(input.path);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new HostError("IO_ERROR", `Not a directory: ${resolved}`);
    }
    const data = this.read();
    const existing = data.projects.find(
      (p) => normalizePath(p.path).toLowerCase() === resolved.toLowerCase(),
    );
    if (existing) {
      existing.lastOpenedAt = new Date().toISOString();
      if (input.trust) existing.trust = "trusted";
      this.write(data);
      return existing;
    }
    const now = new Date().toISOString();
    const project: Project = {
      id: projectIdForPath(resolved),
      path: resolved,
      title: input.title ?? path.basename(resolved),
      pinned: false,
      archived: false,
      trust: input.trust ? "trusted" : "untrusted",
      createdAt: now,
      lastOpenedAt: now,
    };
    data.projects.push(project);
    this.write(data);
    return project;
  }

  update(
    id: string,
    patch: Partial<Pick<Project, "title" | "pinned" | "archived" | "trust">>,
  ): Project {
    const data = this.read();
    const p = data.projects.find((x) => x.id === id);
    if (!p) throw new HostError("INVALID_ARGUMENT", `Unknown project: ${id}`);
    if (patch.title !== undefined) p.title = patch.title;
    if (patch.pinned !== undefined) p.pinned = patch.pinned;
    if (patch.archived !== undefined) p.archived = patch.archived;
    if (patch.trust !== undefined) p.trust = patch.trust;
    p.lastOpenedAt = new Date().toISOString();
    this.write(data);
    return p;
  }

  remove(id: string): void {
    const data = this.read();
    data.projects = data.projects.filter((p) => p.id !== id);
    this.write(data);
  }

  touch(id: string): void {
    const data = this.read();
    const p = data.projects.find((x) => x.id === id);
    if (!p) return;
    p.lastOpenedAt = new Date().toISOString();
    this.write(data);
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
