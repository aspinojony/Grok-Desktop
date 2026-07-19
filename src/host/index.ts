export { DesktopHost, type DesktopHostOptions } from "./host.js";
export {
  buildGrokInfo,
  resolveGrokBinary,
  readGrokVersion,
  readAgentBinMeta,
} from "./resolve-grok.js";
export {
  agentBinaryName,
  agentBinCandidates,
  resolveAgentBinPath,
} from "./agent-bin.js";
export { acquireSingleInstance } from "./single-instance.js";
export { HostLogger } from "./logger.js";
export {
  findSessionDir,
  desktopDir,
  desktopLogsDir,
  grokHomeDir,
  cliGrokHomeDir,
} from "./paths.js";
export { AcpClient } from "./acp-client.js";
export { normalizeSessionUpdate } from "./normalize.js";
export { ProjectRegistry } from "./projects.js";
export { InboxStore } from "./inbox.js";
export { WorktreeService } from "./worktrees.js";
export { AutomationStore } from "./automations.js";
export { buildRoster } from "./roster.js";
export { graphStatus, graphSearch, graphNeighborhood } from "./graph.js";
export {
  memoryStatus,
  memoryList,
  memorySearch,
  memoryAdd,
  memorySetEnabled,
  listMemoryFiles,
  memoryReadFile,
  memoryAppendNote,
  memoryEnvPatch,
} from "./memory.js";
export {
  computeTrayBadge,
  parseDeepLink,
  buildVersionMatrix,
} from "./shell-state.js";
export { listPullRequests, getPullRequestDiff } from "./pr.js";
export { listRemoteProjects, addRemoteProject } from "./remote.js";
