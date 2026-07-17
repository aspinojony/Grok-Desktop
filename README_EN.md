# Grok Desktop

<p align="center">
  <img src="./assets/icon.png" alt="Grok Desktop" width="88" height="88" />
</p>

<p align="center">
  <strong>Desktop workbench for Grok Build</strong><br />
  <b>Codex-aligned UX</b> · Custom providers / relays · Multi-project sessions
</p>

<p align="center">
  <a href="./README.md">中文</a> ·
  <a href="https://github.com/fanghui-li/Grok-Desktop/releases">Download</a> ·
  <a href="./docs/README.md">Docs</a>
</p>

<p align="center">
  <img alt="UX" src="https://img.shields.io/badge/UX-Codex--aligned-8B5CF6.svg" />
  <img alt="Providers" src="https://img.shields.io/badge/providers-official%20%2B%20relay-success.svg" />
  <img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" />
  <img alt="Platform" src="https://img.shields.io/badge/Windows-x64-0078D4.svg" />
</p>

---

**Grok Desktop** puts the Grok agent in a GUI. Layout and interaction **align with OpenAI Codex Desktop**; intelligence still runs in the Grok agent.

### Main workspace

<p align="center">
  <img src="./docs/images/workspace.png" alt="Main workspace" width="900" />
</p>

### Custom providers

Settings → Account & providers: official login **and** OpenAI-compatible relays.

<p align="center">
  <img src="./docs/images/providers.png" alt="Custom providers" width="900" />
</p>

| | |
|--|--|
| Fields | Name, Base URL, API key, protocol, model |
| UX | Fetch models; multiple providers; set default; switch via chat chip |
| Safety | **Isolated from OAuth**; relay needs its own key; keys **not shown in clear text** |
| Data | `~/.grok-desktop` (separate from CLI `~/.grok`) |

### Plan · Plugins · Welcome

| Plan mode | Plugins |
|:---:|:---:|
| <img src="./docs/images/plan.png" alt="Plan mode" width="440" /> | <img src="./docs/images/plugins.png" alt="Plugins" width="440" /> |

<p align="center">
  <img src="./docs/images/home.png" alt="Welcome" width="720" />
</p>

## Other highlights

- **Use it like Codex** — three-column workbench, tool blocks, permission bar, model/reasoning chips  
- **Plan & Goal modes** — chip toggles, status always visible  
- **Multi-project / multi-session** — sidebar, search, archive  
- **Familiar input** — `@` files, attachments, `/` commands, skills  
- **Install and go** — Windows builds can bundle the agent  

## Help us maintain this

Still **0.1** — rough edges welcome.  
We track CLI parity in a **[CLI ↔ Desktop capability matrix](./docs/cli-desktop-capability-matrix.md)** (Chinese): what’s done, partial, or Desktop-only.

| How to help | |
|-------------|--|
| Update the matrix | Stale rows → PR the table |
| Pick a gap | 🟡 / ❌ rows are backlog hints |
| File issues | [Issues](https://github.com/fanghui-li/Grok-Desktop/issues) |
| Conventions | [CONTRIBUTING](./CONTRIBUTING.md) *(Chinese)* |

Small PRs are great. No need to finish the whole matrix.

## Quick start

1. Download `Grok Desktop-*-win-x64.exe` from [Releases](https://github.com/fanghui-li/Grok-Desktop/releases)  
2. **Settings → Account & providers** (official **or** custom relay)  
3. Add a project and chat  

```bash
npm install && npm run sync:agent && npm start
```

## More

[Capability matrix](./docs/cli-desktop-capability-matrix.md) · [Packaging](./docs/packaging.md) · [Contributing](./CONTRIBUTING.md) · [Security](./SECURITY.md) · [Architecture](./docs/架构与协议.md)

[Apache-2.0](./LICENSE) · © 2026 [leofanghui](https://github.com/fanghui-li)
