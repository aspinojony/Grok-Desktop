# CLI vs Desktop 能力对照表

> **原则**：对齐 CLI 的**能力与语义**；交互可 Desktop 化。  
> **状态**：✅ 已对齐 · 🟡 部分 / 入口弱 · ❌ 未做 · — CLI 无或 Desktop 专属 · D+ Desktop 更强  
> **日期**：2026-07-17（请随实现更新本表）  
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
| I9 | Goal 模式 | agent 同源 | banner / chip / slash | ✅ | 可视化更好（D+） |
| I10 | 模型 / 推理切换 | `-m` / slash / 热切换 | chip + `/model` `/effort` + `set_model` | ✅ | 不兼容 harness 时提示新会话 |

---

## 2. 会话生命周期

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| S1 | 新会话 | `/new` 等 | 侧栏「新对话」 | ✅ | 不进 `/` |
| S2 | 继续最近 | `-c` | 侧栏点会话 + attach | 🟡 | 无一键「继续上次」 |
| S3 | 按 ID / 搜索 resume | `-r` / `/resume` | 全局搜索打开 | 🟡 | 不在 `/` |
| S4 | fork | `/fork` | `/fork`（不复制历史） | 🟡 | |
| S5 | rewind | `/rewind` | 用户气泡 ↩（对话+文件） | 🟡 | 对齐 CLI 完整回退；未进 slash |
| S6 | compact | `/compact`、自动 | `/compact` 请求 + 占用 chip | 🟡 | 非全自动 agent 策略 |
| S7 | 重命名 | `/rename` | 侧栏会话 ⋯ | ✅ | |
| S8 | 导出 | `/export` | `/export` MD | 🟡 | |
| S9 | 列表/搜索 | `grok sessions` | 项目树 + 全局搜索 | 🟡 | |
| S10 | 归档 | CLI 弱 | 项目下归档夹 | D+ | |
| S11 | 删除 | 手动/工具 | 归档内删除 | ✅/D+ | |
| S12 | 会话目录 | `~/.grok/sessions` | `~/.grok-desktop/sessions` | — | **目录隔离**；格式兼容 |

---

## 3. 项目 / Worktree / 工作区

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| P1 | 绑定 cwd / 项目 | `--cwd` | 项目列表 + chip | ✅ | |
| P2 | 多项目切换 | 换目录 | 侧栏多项目 | D+ | |
| P3 | Worktree | `-w` / CLI | list 为主；创建向导弱 | 🟡 | |
| P4 | inspect | `grok inspect` | 无对等页 | ❌ | |
| P5 | AGENTS.md | 自动 | 随 agent cwd | ✅ | |
| P6 | 无项目模式 | 任意 cwd | 支持 | ✅ | |

---

## 4. Agent 运行时与工具

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| A1 | ACP / stdio agent | 原生 | Host spawn + ACP | ✅ | agent-bin / 安装包 / PATH |
| A2 | 工具调用展示 | 可折叠步骤 | 直播 + 历史回放过程块 | ✅ | 默认折叠 |
| A3 | 权限审批 | 交互 | permission-bar | ✅ | |
| A4 | Sandbox | flags / 配置 | 设置入口弱 | 🟡 | |
| A5 | 细粒度禁用联网等 | flags | 无 UI | ❌ | |
| A6 | Subagent 树 | 有 | 部分 API / 噪音过滤 | 🟡 | 可视化不足 |
| A7 | best-of-n 等 | headless | 无 | ❌ | |
| A8 | effort / max-turns | flags / `/effort` | chip + `/effort` | 🟡 | max-turns 无 |
| A9 | Leader / 多端 | leader | attach 单写者 | 🟡 | |
| A10 | 后台 / monitor | 有 | Host 部分，UI 弱 | 🟡 | |

---

## 5. 扩展生态

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| E1 | Skills | 安装 + 运行 | list + slash 插入 | 🟡 | 非完整 skill 运行器 |
| E2 | Plugins / 市场 | `grok plugin` | 插件页 list / 市场入口 | 🟡 | 管理深度弱 |
| E3 | MCP | `grok mcp` | list；配置偏外部 | 🟡 | |
| E4 | Hooks | 文档有 | 无管理 UI | ❌ | |
| E5 | Memory | CLI 实验能力 | toggle + status | 🟡 | CRUD 弱 |
| E6 | 模型列表 | `grok models` | chip + 设置提供商 | 🟡 | 自定义供应商见 Y1 |

---

## 6. 代码审阅 / 产物

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| C1 | Diff | TUI | side-pane / diff-view | 🟡 | |
| C2 | 打开编辑器 | 有 | openInEditor / 文件链 | ✅ | |
| C3 | Hunk 时间线 | 有 | Host 有、UI 弱 | 🟡 | |
| C4 | Markdown | 终端有限 | prose + highlight | D+ | |
| C5 | Mermaid 等 | 部分 | 视进度 | 🟡 | |
| C6 | 集成终端 | 终端即环境 | 无/弱 | ❌ | |
| C7 | PR | 有限 | Host 有、UI 弱 | 🟡 | |

---

## 7. 设置 / 账号 / 系统

| # | 能力 | CLI | Desktop | 状态 | 备注 |
|---|------|-----|---------|------|------|
| Y1 | 登录 / 自定义中转 | `grok login` + config | **账户与提供商双 Tab**；中转图形化 | ✅/D+ | 双通道隔离；中转必须自带 api_key |
| Y2 | config.toml | 全量 | 设置子集 + 可打开文件 | 🟡 | |
| Y3 | 主题 | TUI 主题 | 固定浅色（Codex 向） | ❌ | |
| Y4 | 应用更新 | `grok update` | 无自动更新 | ❌ | 靠 Releases |
| Y5 | 托盘 | 弱 | tray + hide | D+ | |
| Y6 | 无原生菜单栏 | — | 已去 | D+ | 对齐 Codex |
| Y7 | 主区圆角卡片 | — | 有 | D+ | 对齐 Codex |
| Y8 | 打包内置 agent | CLI 安装 | agent-bin → 安装包 | D+ | `sync:agent` + VERSION.txt |
| Y9 | 关于 / 诊断 | version 命令 | 设置 → 关于 | ✅ | 路径、版本、sha256 |

---

## 8. Desktop 专属 / 更强

| # | 能力 | 状态 | 说明 |
|---|------|------|------|
| D1 | 左栏项目树 + 会话 | ✅ | |
| D2 | 项目下归档夹 | ✅ | |
| D3 | 可拖拽分屏 + 侧栏 | 🟡 | 文件/浏览器等 |
| D4 | Goal 进度 UI | ✅ | |
| D5 | Codex 式壳层 | ✅ | 三栏、chip、无菜单 |
| D6 | 自定义供应商一等公民 | ✅ | 拉模型、多供应商、设默认 |
| D7 | Automations / Inbox | 🟡 | Host 有，UI 深度视进度 |

---

## 9. 建议对齐优先级（欢迎认领）

### P0（迁移不痛）

1. `@` 引用体验贴齐 CLI（I1）  
2. Worktree 创建/选用向导（P3）  
3. 一键继续最近会话（S2）  

### P1

4. 完整 history fork / 更稳的 rewind 入口  
5. Skills / MCP / Plugins **管理**而不只 list  
6. Memory 浏览与编辑  
7. Diff / PR 深度  

### P2

8. 主题、hooks、best-of-n  
9. 集成终端  
10. 应用内更新  

### 保持 Desktop 领先

- 归档、多项目、Goal 条、自定义供应商 UI、Codex 式壳  

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
| 语义对齐 | plan / goal / 权限 / agent ACP |
| 目录策略 | Desktop 用 `~/.grok-desktop`，不与 CLI 抢 home |
| 交互 Desktop 化 | `@` 面板、设置全页、侧栏，不嵌 TUI |
| Desktop 可更多 | §8 D+、自定义供应商 |

---

## 12. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-17 | 初版与多轮 slash / 模型 chip / rewind 等迭代 |
| 2026-07-17 | S12 更正为 `~/.grok-desktop` 隔离 |
| 2026-07-17 | 开源树恢复本表；对齐 v0.1：自定义供应商、Codex 壳、`/context`/`/view-plan`、安装包 agent；诚邀社区共维 |

---

**维护提示：** 改功能时顺手改对应行状态；PR 描述可写「矩阵 I3 → ✅」。不必一次补完所有 ❌。
