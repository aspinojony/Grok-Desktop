# 安全说明

## 报告漏洞

若发现可被利用的安全问题（任意代码执行、本地提权、密钥泄露、路径逃逸等），请 **不要** 开公开 Issue。

请通过 GitHub 仓库的 **Security Advisories（Private vulnerability reporting）** 或维护者私信渠道报告，并尽量包含：

- 影响版本（Desktop 版本 / agent 版本，设置 → 关于）
- 复现步骤与期望/实际行为
- 是否仅本地可触发、是否依赖已登录会话

我们会尽快确认并协调修复与披露时机。

## 请勿提交或粘贴的内容

- `~/.grok-desktop` 或 `~/.grok` 下的 `auth`、token、`api_key`、会话全文
- 安装包内或本机路径中的完整用户目录结构（若含隐私）
- 未脱敏的 Host 日志（可能含路径与命令）

Issue / PR / 截图前请自行打码密钥与个人路径。

## 数据与打包边界

| 内容 | 是否进入 git / 安装包 |
|------|------------------------|
| 应用代码与文档 | 是 |
| `agent-bin/grok` 二进制 | 仅本地与发行构建；**不入库** |
| `agent-bin/VERSION.txt` | 本地/发版机生成；可随安装包 `resources/agent` 分发（无密钥） |
| `~/.grok-desktop` 用户数据 | **否**，运行时写入本机 |

## 安全相关实现原则（贡献时）

- Renderer 仅通过 preload IPC 调 Host；禁止在 UI 直接 spawn agent 或读写会话目录。
- 自定义提供商的 `api_key` 不得回传明文到 UI（仅 `hasApiKey` 等布尔状态）。
- `openPath` / `openInEditor` 等需防路径逃逸。
- Markdown 渲染需消毒；勿引入任意远程脚本。

## 依赖与供应链

- 使用 `package-lock.json` 锁定依赖；发版机建议 `npm ci`。
- agent 二进制来源应可追溯（`VERSION.txt` 的 `source` / `sha256`）。
