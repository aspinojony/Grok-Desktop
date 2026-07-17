import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface PullRequestSummary {
  number: number;
  title: string;
  state: string;
  url?: string;
  headRef?: string;
  baseRef?: string;
  author?: string;
}

export interface PrDiffResult {
  number: number;
  patch: string;
  source: "gh" | "git" | "empty";
}

export interface PrListResult {
  cwd: string;
  prs: PullRequestSummary[];
  source: "gh" | "git-fallback" | "empty";
  message?: string;
}

/**
 * PR review Host path: prefer `gh pr list/diff`, fall back to recent git branches.
 */
export function listPullRequests(cwd: string, limit = 20): PrListResult {
  const root = path.resolve(cwd);
  if (!fs.existsSync(root)) {
    return { cwd: root, prs: [], source: "empty", message: "cwd missing" };
  }

  const gh = spawnSync(
    "gh",
    ["pr", "list", "--json", "number,title,state,url,headRefName,baseRefName,author", "--limit", String(limit)],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000 },
  );

  if (gh.status === 0 && gh.stdout?.trim()) {
    try {
      const raw = JSON.parse(gh.stdout) as Array<{
        number: number;
        title: string;
        state: string;
        url?: string;
        headRefName?: string;
        baseRefName?: string;
        author?: { login?: string };
      }>;
      return {
        cwd: root,
        source: "gh",
        prs: raw.map((p) => ({
          number: p.number,
          title: p.title,
          state: p.state,
          url: p.url,
          headRef: p.headRefName,
          baseRef: p.baseRefName,
          author: p.author?.login,
        })),
      };
    } catch {
      /* fall through */
    }
  }

  // Fallback: local branches as pseudo-PR review targets
  const br = spawnSync("git", ["branch", "-a", "--no-color"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (br.status !== 0) {
    return {
      cwd: root,
      prs: [],
      source: "empty",
      message: gh.stderr?.trim() || "gh unavailable; not a git repo",
    };
  }
  const prs: PullRequestSummary[] = [];
  let n = 1000;
  for (const line of (br.stdout ?? "").split(/\r?\n/)) {
    const name = line.replace(/^\*?\s+/, "").trim();
    if (!name || name.includes("->")) continue;
    if (name === "main" || name === "master" || name.endsWith("/main") || name.endsWith("/master")) {
      continue;
    }
    prs.push({
      number: n++,
      title: `branch ${name}`,
      state: "OPEN",
      headRef: name,
      baseRef: "HEAD",
    });
    if (prs.length >= limit) break;
  }
  return {
    cwd: root,
    prs,
    source: prs.length ? "git-fallback" : "empty",
    message: prs.length
      ? "gh not available; showing local branches as review targets"
      : "no PRs or feature branches",
  };
}

export function getPullRequestDiff(
  cwd: string,
  number: number,
  headRef?: string,
): PrDiffResult {
  const root = path.resolve(cwd);
  const gh = spawnSync("gh", ["pr", "diff", String(number)], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 12 * 1024 * 1024,
  });
  if (gh.status === 0 && (gh.stdout ?? "").length > 0) {
    return { number, patch: gh.stdout ?? "", source: "gh" };
  }

  if (headRef) {
    const base = "main";
    let r = spawnSync("git", ["diff", `${base}...${headRef}`], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 12 * 1024 * 1024,
    });
    if (r.status !== 0 || !(r.stdout ?? "").trim()) {
      r = spawnSync("git", ["diff", "HEAD", headRef], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 12 * 1024 * 1024,
      });
    }
    if ((r.stdout ?? "").trim()) {
      return { number, patch: r.stdout ?? "", source: "git" };
    }
  }

  // last commit as last resort
  const last = spawnSync("git", ["show", "--format=", "--patch", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    number,
    patch: last.stdout ?? "",
    source: (last.stdout ?? "").trim() ? "git" : "empty",
  };
}
