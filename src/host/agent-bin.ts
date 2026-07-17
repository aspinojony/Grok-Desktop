/**
 * 项目 / 安装包内的 agent 二进制（agent-bin 目录）。
 * - 开发：<appRoot>/agent-bin/grok[.exe]
 * - 安装包：process.resourcesPath/agent/grok[.exe]
 */
import fs from "node:fs";
import path from "node:path";

export function agentBinaryName(platform = process.platform): string {
  return platform === "win32" ? "grok.exe" : "grok";
}

function isExecutableFile(p: string): boolean {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return false;
    if (process.platform === "win32") return true;
    return (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

export interface AgentBinResolveOpts {
  isPackaged: boolean;
  resourcesPath?: string | null;
  /** 含 package.json 的应用根（开发态 = 仓库根） */
  appRoot: string;
  envBundled?: string | null;
  platform?: NodeJS.Platform;
}

/** 候选路径：环境变量 → 安装包 resources/agent → 项目 agent-bin */
export function agentBinCandidates(opts: AgentBinResolveOpts): string[] {
  const name = agentBinaryName(opts.platform ?? process.platform);
  const out: string[] = [];
  const env = (opts.envBundled ?? "").trim();
  if (env) out.push(path.resolve(env));

  if (opts.isPackaged && opts.resourcesPath) {
    out.push(path.join(opts.resourcesPath, "agent", name));
    out.push(path.join(opts.resourcesPath, name));
  }

  out.push(path.join(opts.appRoot, "agent-bin", name));
  return out;
}

export function resolveAgentBinPath(opts: AgentBinResolveOpts): string | null {
  for (const c of agentBinCandidates(opts)) {
    if (isExecutableFile(c)) return path.resolve(c);
  }
  return null;
}
