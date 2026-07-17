import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export type GraphIndexStatus =
  | "ready"
  | "empty"
  | "indexing"
  | "unavailable"
  | "error";

export interface GraphStatus {
  projectPath: string;
  status: GraphIndexStatus;
  fileCount: number;
  symbolHintCount: number;
  message?: string;
  indexPath?: string | null;
}

export interface GraphSymbolHit {
  name: string;
  path: string;
  line: number;
  kind: "def" | "ref" | "file";
  snippet: string;
}

export interface GraphNeighborhood {
  root: string;
  neighbors: Array<{ path: string; relation: string }>;
}

const CODE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".rs",
  ".py",
  ".go",
  ".java",
  ".kt",
  ".cs",
  ".cpp",
  ".c",
  ".h",
  ".md",
]);

/**
 * Lightweight codebase graph projection for Desktop Host.
 * Uses git ls-files + text scan (does not reimplement agent runtime).
 */
export function graphStatus(projectPath: string): GraphStatus {
  const root = path.resolve(projectPath);
  if (!fs.existsSync(root)) {
    return {
      projectPath: root,
      status: "error",
      fileCount: 0,
      symbolHintCount: 0,
      message: "path does not exist",
    };
  }

  const files = listProjectFiles(root);
  const cacheHint = path.join(root, ".grok", "codebase-graph");
  const hasCache = fs.existsSync(cacheHint);

  if (files.length === 0) {
    return {
      projectPath: root,
      status: "empty",
      fileCount: 0,
      symbolHintCount: 0,
      message: "no source files found",
      indexPath: hasCache ? cacheHint : null,
    };
  }

  // Sample a few files for symbol hints cost bound
  let symbolHintCount = 0;
  for (const f of files.slice(0, 40)) {
    symbolHintCount += countSymbolHints(f);
  }

  return {
    projectPath: root,
    status: "ready",
    fileCount: files.length,
    symbolHintCount,
    message: hasCache
      ? "FS graph ready (local cache dir present)"
      : "FS graph ready (git/text projection)",
    indexPath: hasCache ? cacheHint : null,
  };
}

export function graphSearch(
  projectPath: string,
  query: string,
  limit = 40,
): GraphSymbolHit[] {
  const root = path.resolve(projectPath);
  const q = query.trim();
  if (!q || !fs.existsSync(root)) return [];

  const files = listProjectFiles(root);
  const hits: GraphSymbolHit[] = [];
  const re = new RegExp(
    `\\b(${escapeRegExp(q)})\\b|function\\s+${escapeRegExp(q)}|class\\s+${escapeRegExp(q)}|fn\\s+${escapeRegExp(q)}|def\\s+${escapeRegExp(q)}`,
    "i",
  );

  for (const file of files) {
    if (hits.length >= limit) break;
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    const rel = path.relative(root, file).replace(/\\/g, "/");

    // File name match
    if (path.basename(file).toLowerCase().includes(q.toLowerCase())) {
      hits.push({
        name: path.basename(file),
        path: rel,
        line: 1,
        kind: "file",
        snippet: rel,
      });
    }

    for (let i = 0; i < lines.length && hits.length < limit; i++) {
      const line = lines[i];
      if (!re.test(line)) continue;
      const kind =
        /^\s*(export\s+)?(async\s+)?function\b|^\s*(export\s+)?class\b|^\s*fn\s|^\s*def\s|^\s*(pub\s+)?(async\s+)?fn\s/i.test(
          line,
        )
          ? "def"
          : "ref";
      hits.push({
        name: q,
        path: rel,
        line: i + 1,
        kind,
        snippet: line.trim().slice(0, 160),
      });
    }
  }
  return hits;
}

export function graphNeighborhood(
  projectPath: string,
  fileRel: string,
  limit = 20,
): GraphNeighborhood {
  const root = path.resolve(projectPath);
  const abs = path.resolve(root, fileRel);
  const neighbors: Array<{ path: string; relation: string }> = [];
  if (!fs.existsSync(abs)) {
    return { root: fileRel, neighbors };
  }
  let text = "";
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    return { root: fileRel, neighbors };
  }

  const importRe =
    /(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|mod\s+(\w+)|use\s+([\w:]+))/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(text)) && neighbors.length < limit) {
    const raw = m[1] || m[2] || m[3] || m[4] || m[5];
    if (!raw) continue;
    neighbors.push({ path: raw, relation: "import" });
  }

  // Same-directory siblings as soft neighborhood
  try {
    const dir = path.dirname(abs);
    for (const ent of fs.readdirSync(dir)) {
      if (neighbors.length >= limit) break;
      const full = path.join(dir, ent);
      if (!fs.statSync(full).isFile()) continue;
      if (full === abs) continue;
      const rel = path.relative(root, full).replace(/\\/g, "/");
      neighbors.push({ path: rel, relation: "sibling" });
    }
  } catch {
    /* ignore */
  }

  return { root: fileRel, neighbors };
}

function listProjectFiles(root: string): string[] {
  const git = spawnSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const out: string[] = [];
  if (git.status === 0 && git.stdout) {
    for (const line of git.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const ext = path.extname(line).toLowerCase();
      if (!CODE_EXT.has(ext)) continue;
      out.push(path.join(root, line));
    }
    return out.slice(0, 2000);
  }
  walk(root, out, 0);
  return out.slice(0, 2000);
}

function walk(dir: string, out: string[], depth: number): void {
  if (depth > 6 || out.length >= 2000) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "target" || ent.name === "dist") {
      continue;
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out, depth + 1);
    else if (CODE_EXT.has(path.extname(ent.name).toLowerCase())) out.push(full);
  }
}

function countSymbolHints(file: string): number {
  try {
    const text = fs.readFileSync(file, "utf8");
    const m = text.match(
      /\b(function|class|fn|def|struct|interface|type|enum)\s+\w+/g,
    );
    return m?.length ?? 0;
  } catch {
    return 0;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
