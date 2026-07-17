# CLI vs Desktop 能力对照表

> **原则**：对齐 CLI 的**能力与语义**；交互可 Desktop 化。  
> **状态**：✅ 已对齐 · 🟡 部分 / 入口弱 · ❌ 未做 · — CLI 无或 Desktop 专属 · D+ Desktop 更强  
> **日期**：2026-07-18（请随实现更新本表）  
> **数据目录**：Desktop 默认 `~/.grok-desktop`，与 CLI `~/.grok` **隔离**（session 格式兼容）

**图例**

| 标记 | 含义 |
|------|------|
| ✅ | Desktop 可用，语义与 CLI 基本一致 |
| 🟡 | 有入口或 Host 能力，但 UX/完整度弱于 CLI |
| ❌ | CLI 有、Desktop 基本没有 |
| D+ | Desktop 更强或独有 |
| — | 不适用 / 故意不同 |

**欢迎共建：** 发现状态过时或漏项，请直接改本文件并发 PR，或在 [Issue](https://github.com/fanghui-li/Grok-Desktop/issues) 注明「矩阵 §编号」。见 [CONTRIBUTING](../CONTRIBUTING.md)。

**相关文档：** [架构与协议](./架构与协议.md) · 源码对照：Desktop `src/host/*` · CLI `tmp/grok-build-main`（`xai-grok-shell` / pager）

---

## 1. 输入与上下文（高频）

| # | 能力 | CLI (TUI) | Desktop | 状态 | 备注 |
|---|------|-----------|---------|------|------|
| I1 | `@` 文件/路径引用 + 补全 | 完整 file_search、chip、隐藏/`dir` | `@` 浮层 + `files.search` + 附件 | 🟡 | 缺 CLI 级隐藏模式与原子 chip |
| I2 | `+` / 附件选文件 | 粘贴、附件探测 | `+` 菜单 + `pickFiles` + chips | 🟡 | 有显式附件 |
| I3 | `/` 斜杠命令 | Shell + Pager 双源 + skills | 仅会话命令 + skills（导航走 UI） | 🟡 | 见 §10；故意不塞导航 alias |
| I4 | 图片粘贴 / 多模态 | clipboard 探测等 | 粘贴进附件 + image 类型 | 🟡 | 链路可用；体验可再贴 CLI |
| I5 | 多行输入 / 发送 | Enter 策略完善 | Enter 发送、Shift+Enter 换行 | ✅ | |
| I6 | 停止当前 turn | 有 | 发送钮变停止 + cancel | ✅ | |
| I7 | 权限模式 | `/`、flag、运行时 | 权限 chip + `/always-approve` + `/plan` | ✅ | `/auto` 暂不做 |
| I8 | Plan 模式 | 一等公民 | chip + slash + 计划面板 | 🟡 | 有入口；工作流深度仍可加强 |
| I9 | Goal 模式 | agent 同源 | banner / chip / slash | ✅ | 可视化更好（D+）；投影条件见 A12 |
| I10 | 模型 / 推理切换 | `-m` / slash / 热切换 | chip + `/model` `/effort` + `set_model` | ✅ | 不兼容 harness 时提示新会话 |

---

## 2. 会话生命周期

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| S1 | 新会话 | `/new` 等 | 侧栏「新对话」 | ✅ | 不进 `/` |
| S2 | 继续最近 | `-c` | 侧栏「继续上次」+ `threads.continueRecent` | ✅ | 打开最近用户会话历史；发送时 attach |
| S3 | 按 ID / 搜索 resume | `-r` / `/resume` | 全局搜索打开 | 🟡 | 不在 `/` |
| S4 | fork | `/fork` | `/fork`（不复制历史） | 🟡 | |
| S5 | rewind | `/rewind` | 用户气泡 ↩（对话+文件） | 🟡 | ACP `_x.ai/rewind/*` 已接；未进 slash |
| S6 | compact | `/compact`、自动 | `/compact` 请求 + 占用 chip | 🟡 | 收 agent `auto_compact_*` 通知；手动策略弱于 CLI |
| S7 | 重命名 | `/rename` | 侧栏会话 ⋯ | ✅ | 写 `summary.json`，CLI 可读同 home 会话 |
| S8 | 导出 | `/export` | `/export` MD | 🟡 | |
| S9 | 列表/搜索 | `grok sessions` | 项目树 + 全局搜索 | 🟡 | 仅扫 Desktop `GROK_HOME` |
| S10 | 归档 | CLI 弱 | 项目下归档夹 | D+ | |
| S11 | 删除 | 手动/工具 | 归档内删除 | ✅/D+ | |
| S12 | 会话目录 | `~/.grok/sessions` | `~/.grok-desktop/sessions` | — | **目录隔离**；格式兼容 |
| S13 | 会话磁盘格式 | `summary.json` / `chat_history.jsonl` / updates 等 | 同 schema（agent 落盘） | ✅ | Host 不另起 schema；历史回放读 jsonl |
| S14 | 跨端会话互通 | 同 `~/.grok` 内 CLI/TUI 互通 | 默认**看不到** CLI 会话 | — | 故意隔离 auth/sessions；共享 home 才互通 |
| S15 | 历史回放路径 | load 时 ACP 回放 + TUI | 以磁盘 `chat_history.jsonl` 为主；attach 再 load | 🟡 | 语义可 resume；UI 不依赖完整 load 回放流 |

---

## 3. 项目 / Worktree / 工作区

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| P1 | 绑定 cwd / 项目 | `--cwd` | 项目列表 + chip | ✅ | trust 门禁 |
| P2 | 多项目切换 | 换目录 | 侧栏多项目 | D+ | |
| P3 | Worktree | `-w` / agent 池 | Host git worktree list/创建；向导弱 | 🟡 | `worktreeApi` 能力位 false；旁路实现 |
| P4 | inspect | `grok inspect` | 无对等页 | ❌ | |
| P5 | AGENTS.md | 自动 | 随 agent cwd | ✅ | |
| P6 | 无项目模式 | 任意 cwd | 支持 | ✅ | |

---

## 4. Agent 运行时与工具

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| A1 | ACP / stdio agent | 原生 | Host spawn + ACP | ✅ | agent-bin / 安装包 / PATH；同源 `grok agent stdio` |
| A2 | 工具调用展示 | 可折叠步骤 | 直播 + 历史回放过程块 | ✅ | 默认折叠 |
| A3 | 权限审批 | 交互 | permission-bar + Inbox | ✅ | |
| A4 | Sandbox | flags / 配置 | 设置入口弱 | 🟡 | |
| A5 | 细粒度禁用联网等 | flags | 无 UI | ❌ | |
| A6 | Subagent 树 / 进度 | `SubagentSpawned/Progress/Finished` + TUI | 归一化 + `subagents.json` 投影 + 侧栏树 + toast | ✅ | Host 投影 + 侧栏「子代理」分类实时树 |
| A7 | best-of-n 等 | headless | 无 | ❌ | |
| A8 | effort / max-turns | flags / `/effort` | chip + `/effort` + `_meta.reasoningEffort` | 🟡 | max-turns 无 |
| A9 | Leader / 多端 | leader 默认（Pager） | **每 Thread 一 stdio 子进程**；无 leader | 🟡→偏 ❌ | 架构文档 Mode A 未接；`leaderRoster: false` |
| A10 | 后台 / monitor | 有 + auto-wake | `task.updated` + 过程区/toast + 失败 Inbox | ✅ | TaskBackgrounded/Completed/MonitorEvent 已归一；无独立任务面板 |
| A11 | Plan 退出审批 | `x.ai/exit_plan_mode` | 同 reverse request + 面板 | ✅ | |
| A12 | Goal 运行时事件 | `goal_updated` 完整 | 收事件且首启即写 `goal.json` | ✅ | Host 无条件投影；UI 自动 opt-in |
| A13 | YOLO / always-approve | flag + leader 注入 | `_meta.yoloMode` + chip | ✅ | |
| A14 | 模型切换 wire | `session/set_model` 等 | set_model + camel 回退 | ✅ | 实测 snake 优先 |
| A15 | 能力探测 | leader / 版本 | `GrokCapabilities` **写死** | 🟡 | 未按 agent initialize 动态探测 |
| A16 | 打包内置 agent | CLI 安装 | agent-bin / resources/agent | D+ | 见 Y8 |

### 4.1 进程与附着模型（差异摘要）

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| R1 | 进程拓扑 | Leader 共享 agent 进程池（主） | Mode B：每 Thread 一 `grok agent stdio` | — | 隔离强、内存高；非 bug |
| R2 | 同一 session 可写者 | leader driver + 只读 subscriber | Host 内 `writable` 互斥 | 🟡 | 无跨 Host↔CLI 统一锁 |
| R3 | Attach / resume | leader `session/load` + live buffer | 新子进程 + `session/load` | 🟡 | 语义有；无 load 期 live 缓冲 |
| R4 | 崩溃恢复 | leader 可重连 / resume | 标记 failed；可再 attach | 🟡 | 磁盘 session 不丢 |
| R5 | 多窗口同 Host | TUI 多附着策略 | 单实例 Host + 多窗口 IPC | 🟡 | 二次启动 handoff deep link |

### 4.2 ACP Client 能力与 `_meta`（差异摘要）

| # | 字段 / 能力 | CLI（常经 leader 注入） | Desktop Host | 状态 |
|---|-------------|-------------------------|--------------|------|
| M1 | `initialize.clientInfo` | TUI / leader 标识 | `grok-desktop` | ✅ 有标识 |
| M2 | `_meta.clientIdentifier` | 注入（如 `grok-tui`） | **未写** | ❌ |
| M3 | `_meta.yoloMode` | 有 | 有 | ✅ |
| M4 | `_meta.modelId` | 有 | 有 | ✅ |
| M5 | `_meta.planMode` / set_mode | 有 | 有 | ✅ |
| M6 | `_meta.reasoningEffort` | 有 | 有 | ✅ |
| M7 | `_meta.autoMode` | leader 可注入 | **未写** | ❌ |
| M8 | `_meta.codeNavEnabled` | leader 注入 | **未写** | ❌ |
| M9 | `_meta.clientTerminal` | 可 true → 终端回 TUI | **未写** | ❌ |
| M10 | `clientCapabilities.fs` | 视客户端 | `readTextFile: true, writeTextFile: false` | 🟡 |
| M11 | `clientCapabilities.terminal` | 可 true | **false** | ❌ |
| M12 | `GROK_CLIENT_VERSION` 等诊断 env | 部分路径有 | **未见设置** | 🟡 |
| M13 | `GROK_HOME` | 默认 `~/.grok` | 强制 `~/.grok-desktop` | — 故意 |

### 4.3 事件归一化覆盖

Host 将 ACP / x.ai 通知归一为 `NormalizedEvent`（`src/host/normalize.ts` + `acp-client.ts`）。

| # | 事件族 | CLI 产出 | Desktop 消费 | 状态 |
|---|--------|----------|--------------|------|
| N1 | message / thought / tool chunks | ✅ | `message.delta` / `thought.delta` / `tool.*` | ✅ |
| N2 | permission | ✅ | `permission.requested` + Inbox | ✅ |
| N3 | plan 审批 | ✅ | `plan.approval.requested` | ✅ |
| N4 | goal_updated | ✅ | `goal.updated` | 🟡 投影条件见 A12 |
| N5 | auto_compact_* | ✅ | `context.compacted` | ✅ |
| N6 | SubagentSpawned / Progress / Finished | ✅ | `subagent.updated` + 落盘 + 侧栏树 | ✅ | toast + subagents.json + 侧栏 Agents |
| N7 | TaskCompleted / monitor 唤醒 | ✅ | `task.updated` + toast/过程区 + willWake 提示 | ✅ | 专用 method 与 session_notification 双路径 |
| N8 | Hooks / plugins / memory dream / recap 等 | ✅ 多种 | **未映射** | ❌ |
| N9 | agent 进程退出 | — | `agent.error` / failed | ✅ Desktop 侧 |

---

## 5. 扩展生态

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| E1 | Skills | 安装 + 运行 | list + slash 插入 | 🟡 | 非完整 skill 运行器；发现路径随 `GROK_HOME` |
| E2 | Plugins / 市场 | `grok plugin` | 插件页 list / 市场入口 | 🟡 | 管理深度弱 |
| E3 | MCP | `grok mcp` | list；配置偏外部 | 🟡 | session/new 可透传 mcpServers |
| E4 | Hooks | 文档 + agent `_meta` | 无管理 UI；ACP 未挂 hooks meta | ❌ | |
| E5 | Memory | CLI 实验能力 | toggle + status | 🟡 | CRUD 弱 |
| E6 | 模型列表 | `grok models` | chip + 设置提供商 | 🟡 | 自定义供应商见 Y1 |

---

## 6. 代码审阅 / 产物

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| C1 | Diff | TUI | side-pane / diff-view | 🟡 | |
| C2 | 打开编辑器 | 有 | openInEditor / 文件链 | ✅ | |
| C3 | Hunk 时间线 | 有 | Host 有、UI 弱 | 🟡 | `hunkTimeline: false` 能力位 |
| C4 | Markdown | 终端有限 | prose + highlight | D+ | |
| C5 | Mermaid 等 | 部分 | 视进度 | 🟡 | |
| C6 | 集成终端 | 终端即环境 | 无；ACP `terminal: false` | ❌ | 与 M11 一致 |
| C7 | PR | 有限 | Host 有、UI 弱 | 🟡 | |

---

## 7. 设置 / 账号 / 系统

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| Y1 | 登录 / 自定义中转 | `grok login` + config | **账户与提供商双 Tab**；中转图形化 | ✅/D+ | 双通道隔离；中转必须自带 api_key；login 写 Desktop `GROK_HOME` |
| Y2 | config.toml | 全量 | 设置子集 + 可打开文件 | 🟡 | |
| Y3 | 主题 | TUI 主题 | 固定浅色（Codex 向） | ❌ | |
| Y4 | 应用更新 | `grok update` | 无自动更新 | ❌ | 靠 Releases |
| Y5 | 托盘 | 弱 | tray + hide | D+ | |
| Y6 | 无原生菜单栏 | — | 已去 | D+ | 对齐 Codex |
| Y7 | 主区圆角卡片 | — | 有 | D+ | 对齐 Codex |
| Y8 | 打包内置 agent | CLI 安装 | agent-bin → 安装包 | D+ | `sync:agent` + VERSION.txt |
| Y9 | 关于 / 诊断 | version 命令 | 设置 → 关于 | ✅ | 路径、版本、sha256 |
| Y10 | 单实例 | CLI 多进程常见 | Host 单实例 + handoff | D+ | deep link / 二次启动 |

---

## 8. Desktop 专属 / 更强

| # | 能力 | 状态 | 说明 |
|---|------|------|------|
| D1 | 左栏项目树 + 会话 | ✅ | |
| D2 | 项目下归档夹 | ✅ | |
| D3 | 可拖拽分屏 + 侧栏 | 🟡 | 文件/浏览器等 |
| D4 | Goal 进度 UI | ✅ | 可视化强于纯 TUI 文本 |
| D5 | Codex 式壳层 | ✅ | 三栏、chip、无菜单 |
| D6 | 自定义供应商一等公民 | ✅ | 拉模型、多供应商、设默认 |
| D7 | Automations / Inbox | 🟡 | Host 有，UI 深度视进度 |
| D8 | 统一 Host 事件面 | D+ | UI 只订 `NormalizedEvent`，不解析 agent 原始 JSON |
| D9 | Roster 过滤子会话噪音 | D+ | 隐藏 `subagent` / goal 基建会话（列表更干净；树缺失见 A6） |

---

## 9. 建议对齐优先级（欢迎认领）

### P0（迁移不痛）

1. `@` 引用体验贴齐 CLI（I1）  
2. Worktree 创建/选用向导（P3）  
3. 一键继续最近会话（S2）  

### P1（Agent 指挥面）

4. Subagent 事件归一化 + 树 UI（A6 / N6）  
5. Goal 投影：agent 首启 goal 也写盘（A12）  
6. 完整 history fork / 更稳的 rewind 入口（S4 / S5）  
7. Skills / MCP / Plugins **管理**而不只 list（E1–E3）  
8. Memory 浏览与编辑（E5）  
9. Diff / PR 深度（C1 / C7）  

### P2（拓扑与能力）

10. Leader 或等价共享 runtime（A9 / R1）— 或文档明确长期 Mode B  
11. `clientIdentifier` / `autoMode` / terminal 能力声明（§4.2）  
12. 动态 `GrokCapabilities` 探测（A15）  
13. 主题、hooks、best-of-n  
14. 集成终端（C6）  
15. 应用内更新（Y4）  

### 产品决策（非纯实现）

- 是否提供「共享 `GROK_HOME` / 导入 CLI 会话」开关（S14）  
- Desktop 是否永远不做 `/auto`（I7）  

### 保持 Desktop 领先

- 归档、多项目、Goal 条、自定义供应商 UI、Codex 式壳、Inbox/Automations  

---

## 10. Slash 命令对照

> Desktop 源：`src/renderer/slash-commands.ts`  
> `/` **仅** 会话命令 + 动态 skills；导航/设置/项目走 UI。

### 10.1 Desktop 已注册（静态）

| 命令 | 作用 | 状态 |
|------|------|------|
| `/always-approve` | 完全访问 toggle | ✅ 与权限 chip 同步 |
| `/plan` | 计划模式 | ✅ |
| `/view-plan` | 打开计划面板 | ✅ |
| `/goal` `/goal-status` `/goal-clear` | 目标 | ✅ |
| `/model` | 模型菜单 | ✅ |
| `/effort` | 推理力度 | ✅ |
| `/context` | 上下文占用 | ✅ chip + slash |
| `/compact` | 压缩 | 🟡 |
| `/export` | 导出 MD | 🟡 |
| `/fork` | 分支会话 | 🟡 不复制历史 |
| `/status` | 会话状态 | 🟡 |

### 10.2 动态

| 来源 | 行为 | 状态 |
|------|------|------|
| Skills | 插入提示文本 | 🟡 非完整运行器 |

### 10.3 CLI 有、Desktop 弱/无（节选）

| CLI | Desktop |
|-----|---------|
| `/rewind` | 🟡 气泡 ↩，未进 `/` |
| `/auto` | ❌ 暂不做 |
| TUI 专用（vim/fullscreen 等） | ❌ 不跟 |
| 记忆子命令全集 | 🟡 Host 有，slash/UI 待补 |

### 10.4 UI 主路径（不在 `/`）

新对话 · 重命名 · 搜索/恢复 · 项目 · 设置 · 插件页 · 打开位置  

---

## 11. 原则映射

| 原则 | 本表 |
|------|------|
| 能力对齐 | §1–§5、§10 中 🟡/❌ 优先 |
| 语义对齐 | plan / goal / 权限 / agent ACP（§4） |
| 目录策略 | Desktop 用 `~/.grok-desktop`，不与 CLI 抢 home（S12 / S14） |
| 进程策略 | 当前 Mode B（每 Thread stdio）；Leader 为可选未来（R1 / A9） |
| 交互 Desktop 化 | `@` 面板、设置全页、侧栏，不嵌 TUI |
| Desktop 可更多 | §8 D+、自定义供应商 |
| 不重写 agent | A1：智能同源；缺口在指挥面与事件消费 |

---

## 12. 对齐结论（一页纸）

| 维度 | 判断 |
|------|------|
| 协议层 ACP wire | ✅ 高：同 `grok agent stdio` + JSON-RPC |
| Session 磁盘格式 | ✅ 高：同 schema，不同 `GROK_HOME` |
| 单会话 turn（消息/工具/权限/plan/model） | ✅ 基本对齐 |
| 进程拓扑 / Leader | ❌ 未对齐（故意 Mode B） |
| Subagent 指挥面 | ✅ 事件归一化 + subagents.json + 侧栏树；缺 monitor/TaskCompleted |
| Client 能力（terminal / codeNav / auto） | ❌ 弱于 CLI+leader |
| 扩展事件（hooks/task/subagent…） | 🟡 subagent + task/monitor 已归一；hooks/dream 仍缺 |
| 产品互通（默认） | — 目录隔离，列表不互通 |

**一句话：** 会话「大脑」对齐（同一 agent）；Subagent + 后台任务/monitor 指挥面已落地；Leader / hooks 仍有差距。

---

## 13. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-17 | 初版与多轮 slash / 模型 chip / rewind 等迭代 |
| 2026-07-17 | S12 更正为 `~/.grok-desktop` 隔离 |
| 2026-07-17 | 开源树恢复本表；对齐 v0.1：自定义供应商、Codex 壳、`/context`/`/view-plan`、安装包 agent；诚邀社区共维 |
| 2026-07-18 | 后台任务/monitor：`task.updated`（N7/A10）归一化 + UI toast/过程区 |
| 2026-07-18 | 侧栏 Subagent 树：`side-cat-agents` + `subagents.tree` / `subagent.updated` 增量 |
| 2026-07-18 | P0：Goal 首启投影、Subagent 事件归一化、继续上次会话 |
| 2026-07-18 | 对照 CLI 源码补充：S13–S15、§4.1–4.3（进程/meta/事件）、A11–A16、Y10/D8/D9、§12 对齐结论；细化 A6/A9/A12 与 P1 agent 项 |

---

**维护提示：** 改功能时顺手改对应行状态；PR 描述可写「矩阵 I3 → ✅」。不必一次补完所有 ❌。Agent 协议级变更优先改 §4 / §4.1–4.3 / §12。
