# 本 Fork 改动说明（aspinojony/Grok-Desktop）

> 上游：[fanghui-li/Grok-Desktop](https://github.com/fanghui-li/Grok-Desktop)（v0.1.0，主推 Windows）  
> 本仓库：https://github.com/aspinojony/Grok-Desktop  
> 维护：基于上游 Electron Desktop 客户端，补 macOS 打包与性能/模型体验。

---

## 1. 相对上游改了哪里

### 1.1 打包与 macOS

| 文件 / 区域 | 改动 |
|-------------|------|
| `package.json` | 增加 `dist:mac` / `dist:mac:arm64` / `dist:mac:x64`；完善 `build.mac`（dmg、artifactName、hardenedRuntime） |
| `scripts/gen-app-icon.mjs` | 图标改为 1024×1024，并修复 Retina 下 `capturePage` 尺寸错误 |
| `assets/icon.png` | 满足 electron-builder macOS ≥512 要求 |
| `docs/packaging.md` | 补充 macOS agent 架构、未签名 Gatekeeper 说明 |
| `CONTRIBUTING.md` | 补充 mac 打包命令说明 |
| `README.md` / `README_EN.md` | 增加 macOS 下载与安装说明 |

### 1.2 模型与 CPA 中转

| 文件 / 区域 | 改动 |
|-------------|------|
| `src/host/host.ts` | 新建会话时显式 `session/set_model`，避免落到官方 `grok-4.5`；`models.list` 默认以 Desktop 配置为准；支持 **CPA-only** 模型菜单 |
| `src/host/extensibility.ts` | `DesktopConfig.modelsScope`（`cpa-only` \| `all`） |
| `src/renderer/main.ts` | 启动时从 config/providers 同步默认模型 chip；占位 `grok` 时回落已配置默认 |

### 1.3 性能（对齐 CLI / Codex 热后端思路）

| 文件 / 区域 | 改动 |
|-------------|------|
| `src/host/host.ts` | **共享 multi-session runtime**：一个 `grok agent stdio` 承载多 Thread；启动预热；detach/delete 只注销 session |
| `src/host/acp-client.ts` | session 路由表；`rebind` / `unregisterSession`；事件按 `sessionId` 分发 |
| `src/renderer/main.ts` | 默认推理力度改为 **medium**（可手调 high/xhigh） |

### 1.4 多 Agent 可视化

| 文件 / 区域 | 改动 |
|-------------|------|
| `src/renderer/main.ts` | 对话流 **子代理卡片**；顶部协作浮条 |
| `src/renderer/side-pane.ts` | 子代理统计条、live 脉冲、快照 API |
| `src/renderer/styles.css` | 卡片 / 浮条 / 侧栏样式 |
| `src/renderer/index.html` | 浮条与侧栏提示 DOM |
| `src/shared/i18n/locales/*` | 中英文案 |

### 1.5 视觉（Codex 气质）

| 文件 / 区域 | 改动 |
|-------------|------|
| `src/renderer/styles.css` | 设计 token、侧栏、悬浮输入、气泡、过程块等 Codex 向视觉统一 |

### 1.6 工程脚本（可选）

| 文件 | 用途 |
|------|------|
| `scripts/qa-e2e-full.mjs` | 全流程 QA（环境 / Host / 对话 / 模型） |
| `scripts/full-functional-probe.mjs` | Host API 功能面探测（可按需入库） |

---

## 2. 改进了什么（用户可感知）

1. **macOS 可安装**：Apple Silicon DMG，内置 agent，本机可直接装。  
2. **中转可用**：修复「配置了 CPA 仍打官方 grok-4.5 → 402」的路径问题。  
3. **模型菜单更干净**：CPA-only 模式下只显示可用中转，减少点到死模型。  
4. **启动更快**：共享 agent 进程 + 预热，新对话少 2–4s 冷启动（第二次起更明显）。  
5. **多 Agent 看得见**：侧栏树 + 主聊天卡片 + 协作浮条。  
6. **界面更接近 Codex**：浅灰壳、白主舞台、悬浮输入区。

---

## 3. 已知缺点与未完成项

### 3.1 本 Fork 引入 / 仍存在的限制

| 缺点 | 说明 |
|------|------|
| **macOS 未代码签名 / 未公证** | 首次打开可能被 Gatekeeper 拦截，需「仍要打开」或 `xattr -cr` |
| **仅 arm64 发版产物** | Intel Mac 需自行 `dist:mac:x64` 并准备 x64 agent |
| **CPA 4.5 路径不稳** | 默认已去掉；易误触官方额度或中转映射问题 |
| **CPA 网络延迟** | 中转约 2–3s 级，与进程模型无关 |
| **图标为放大生成** | 非原画矢量重绘，高 DPI 观感一般 |

### 3.2 相对 Grok CLI 仍弱（上游矩阵 + 现状）

| 缺口 | 说明 |
|------|------|
| Hooks 管理 UI | CLI 有，Desktop 基本无 |
| 集成终端 | ACP `terminal: false` |
| `/share`、`/recap` | 未做 |
| best-of-n | 未做 |
| Skills 完整 runner | 多为插入提示，非 shell 同路径解析 |
| 与 CLI 会话默认互通 | 故意 `~/.grok-desktop` 与 `~/.grok` 隔离 |
| 自动更新 | 无完整更新通道 |

### 3.3 架构取舍

- 共享 multi-session runtime 已接近 Codex「热后端」，但**不是**完整接 `grok agent leader` socket 协议。  
- 官方 OAuth 仍可登录，但在 CPA-only 配置下**菜单不再主推官方模型**。

---

## 4. 建议使用方式

1. 安装本仓库 Release 中的 **macOS arm64 DMG**。  
2. 配置 CPA：`Base URL` + `API Key`，默认模型 **CPA Mini**。  
3. 使用 **新对话**，避免旧会话绑死坏模型。  
4. 需要深度推理时再手动把 effort 调到 high / xhigh。

---

## 5. 上游关系

- 协议与 UI 主体版权归属原作者与贡献者（Apache-2.0）。  
- 本 fork 在上游基础上增加 macOS 与体验补丁；欢迎将可上游化的部分回馈 [fanghui-li/Grok-Desktop](https://github.com/fanghui-li/Grok-Desktop)。

## 6. 相关提交（摘要）

| Commit | 主题 |
|--------|------|
| `3d8fc38` | macOS DMG 打包与 1024 图标 |
| `a7c371b` | Codex 向视觉 |
| `f118ea2` | 强制默认模型 + set_model |
| `04afddb` | agent 预热 + medium effort |
| `72c4a87` | 共享 multi-session runtime |
| `d319f2b` | 多 Agent 卡片与浮条 |
| `11bf022` | CPA-only 模型菜单 |

---

*文档随本 fork 维护，日期以仓库提交为准。*
