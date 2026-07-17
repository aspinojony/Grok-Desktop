/**
 * Codex 式全页设置：左导航 + 右内容，基于现有 Host 能力。
 */
import type { HostIpcMethod } from "../shared/host-api.js";

type Inv = <T>(method: HostIpcMethod, params?: unknown) => Promise<{
  ok: boolean;
  data?: T;
  error?: { message?: string };
}>;

export type SettingsPermMode = "always_approve" | "normal" | "plan";
/** explorer | code | cursor | codium | windsurf | editor(遗留) */
export type SettingsOpenTarget = string;

export interface DesktopConfigData {
  defaultModel?: string;
  grokPathOverride?: string;
  alwaysApproveDefault?: boolean;
  defaultPermMode?: SettingsPermMode;
  defaultOpenTarget?: SettingsOpenTarget;
  paths?: {
    settings: string;
    configToml: string;
    grokHome: string;
  };
}

export interface SettingsPageCallbacks {
  inv: Inv;
  getSelectedProjectPath?: () => string | undefined;
  getSelectedProjectId?: () => string | null;
  onConfigApplied: (cfg: {
    defaultPermMode: SettingsPermMode;
    defaultModel: string;
    defaultOpenTarget: SettingsOpenTarget;
  }) => void;
  /** 关闭设置页后（恢复主界面交互 / 焦点） */
  onClosed?: () => void;
  esc: (s: string) => string;
}

type SectionId =
  | "general"
  | "account"
  | "memory"
  | "shortcuts"
  | "about";

type AccountTab = "official" | "custom";

type CustomProviderRow = {
  id: string;
  model: string;
  baseUrl: string;
  name: string;
  hasApiKey: boolean;
  apiBackend: string;
  isDefault: boolean;
};

const SECTIONS: Array<{
  id: SectionId;
  group: string;
  label: string;
  icon: string;
  keywords: string;
}> = [
  { id: "general", group: "个人", label: "常规", icon: "⚙", keywords: "权限 打开 默认 完全访问 plan" },
  {
    id: "account",
    group: "个人",
    label: "账户与提供商",
    icon: "👤",
    keywords: "登录 oauth 官方 中转 提供商 api key base_url 鉴权 账户",
  },
  { id: "about", group: "个人", label: "关于", icon: "ℹ", keywords: "版本 诊断" },
  { id: "memory", group: "集成", label: "记忆", icon: "◎", keywords: "memory 记忆" },
  { id: "shortcuts", group: "个人", label: "键盘快捷键", icon: "⌨", keywords: "快捷键 shortcut hotkey" },
];

export class SettingsPageController {
  private open = false;
  private section: SectionId = "general";
  private filter = "";
  private cfg: DesktopConfigData = {};
  private accountTab: AccountTab = "official";
  private editingProviderId: string | null = null;
  /** 当前表单已拉取的远程模型 id 列表 */
  private remoteModelIds: string[] = [];
  private modelMenuOpen = false;
  private modelMenuDocClose: ((ev: MouseEvent) => void) | null = null;

  constructor(private readonly cb: SettingsPageCallbacks) {
    this.bindShell();
  }

  isOpen(): boolean {
    return this.open;
  }

  async show(section?: SectionId): Promise<void> {
    this.open = true;
    if (section) this.section = section;
    const page = document.getElementById("settings-page");
    page?.classList.remove("hidden");
    const app = document.getElementById("app");
    app?.classList.add("settings-open");
    app?.setAttribute("aria-hidden", "true");
    // inert：禁止主界面在设置打开时获得焦点 / 接收输入（比 pointer-events 更可靠）
    if (app && "inert" in app) {
      (app as HTMLElement & { inert: boolean }).inert = true;
    }
    await this.reloadConfig();
    this.renderNav();
    await this.renderContent();
    const q = document.getElementById("settings-search") as HTMLInputElement | null;
    requestAnimationFrame(() => q?.focus());
  }

  hide(): void {
    this.open = false;
    this.teardownModelMenu();
    // 避免焦点停在即将 display:none 的设置控件上，导致主界面按键失效
    const ae = document.activeElement as HTMLElement | null;
    if (ae && document.getElementById("settings-page")?.contains(ae)) {
      ae.blur();
    }
    document.getElementById("settings-page")?.classList.add("hidden");
    const app = document.getElementById("app");
    app?.classList.remove("settings-open");
    app?.removeAttribute("aria-hidden");
    if (app && "inert" in app) {
      (app as HTMLElement & { inert: boolean }).inert = false;
    }
    this.cb.onClosed?.();
  }

  /** 关闭模型下拉并卸掉 document 捕获监听（防止泄漏影响主界面） */
  private teardownModelMenu(): void {
    this.modelMenuOpen = false;
    if (this.modelMenuDocClose) {
      document.removeEventListener("click", this.modelMenuDocClose, true);
      this.modelMenuDocClose = null;
    }
  }

  private bindShell(): void {
    document.getElementById("btn-settings-back")?.addEventListener("click", () => {
      this.hide();
    });
    const search = document.getElementById("settings-search") as HTMLInputElement | null;
    search?.addEventListener("input", () => {
      this.filter = search.value.trim().toLowerCase();
      this.renderNav();
    });
    document.addEventListener("keydown", (e) => {
      if (!this.open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.hide();
      }
    });
  }

  private async reloadConfig(): Promise<void> {
    const res = await this.cb.inv<DesktopConfigData>("config.get");
    this.cfg = res.data ?? {};
  }

  private async patch(partial: Partial<DesktopConfigData>): Promise<void> {
    const res = await this.cb.inv<DesktopConfigData>("config.patch", partial);
    if (res.ok && res.data) this.cfg = res.data;
    else await this.reloadConfig();
    this.applyToApp();
  }

  private applyToApp(): void {
    const mode = this.cfg.defaultPermMode ?? "normal";
    const model = (this.cfg.defaultModel ?? "").trim() || "grok";
    const openTarget = this.cfg.defaultOpenTarget ?? "explorer";
    this.cb.onConfigApplied({
      defaultPermMode: mode,
      defaultModel: model,
      defaultOpenTarget: openTarget,
    });
  }

  private renderNav(): void {
    const nav = document.getElementById("settings-nav-list");
    if (!nav) return;
    const f = this.filter;
    const items = SECTIONS.filter((s) => {
      if (!f) return true;
      const hay = `${s.label} ${s.group} ${s.keywords}`.toLowerCase();
      return hay.includes(f);
    });
    const groups = new Map<string, typeof items>();
    for (const s of items) {
      const arr = groups.get(s.group) ?? [];
      arr.push(s);
      groups.set(s.group, arr);
    }
    // 保持定义顺序的分组
    const order = ["个人", "集成"];
    let html = "";
    for (const g of order) {
      const list = groups.get(g);
      if (!list?.length) continue;
      html += `<div class="settings-nav-group">${this.cb.esc(g)}</div>`;
      for (const s of list) {
        html += `<button type="button" class="settings-nav-item${s.id === this.section ? " active" : ""}" data-section="${s.id}">
          <span class="settings-nav-ico">${s.icon}</span>
          <span>${this.cb.esc(s.label)}</span>
        </button>`;
      }
    }
    if (!html) {
      html = `<div class="settings-nav-empty">无匹配设置</div>`;
    }
    nav.innerHTML = html;
    for (const btn of Array.from(nav.querySelectorAll("[data-section]"))) {
      (btn as HTMLElement).onclick = () => {
        this.section = (btn as HTMLElement).dataset.section as SectionId;
        this.renderNav();
        void this.renderContent();
      };
    }
  }

  private async renderContent(): Promise<void> {
    const root = document.getElementById("settings-content");
    if (!root) return;
    // 重绘前卸掉旧 DOM 上的捕获监听，避免 combo 节点失效后监听仍挂着
    this.teardownModelMenu();
    root.innerHTML = `<div class="settings-loading">加载中…</div>`;
    try {
      switch (this.section) {
        case "general":
          root.innerHTML = await this.htmlGeneral();
          this.bindGeneral(root);
          break;
        case "account":
          root.innerHTML = await this.htmlAccount();
          this.bindAccount(root);
          break;
        case "about":
          root.innerHTML = await this.htmlAbout();
          this.bindAbout(root);
          break;
        case "memory":
          root.innerHTML = await this.htmlMemory();
          this.bindMemory(root);
          break;
        case "shortcuts":
          root.innerHTML = this.htmlShortcuts();
          break;
        default:
          root.innerHTML = `<p class="settings-muted">未知分区</p>`;
      }
    } catch (err) {
      root.innerHTML = `<p class="settings-error">${this.cb.esc(String(err))}</p>`;
    }
  }

  // ── 常规 ───────────────────────────────────────────────

  private async htmlGeneral(): Promise<string> {
    const mode = this.cfg.defaultPermMode ?? "normal";
    const openTarget = this.cfg.defaultOpenTarget ?? "explorer";
    const edRes = await this.cb.inv<{
      editors: Array<{ id: string; label: string; command: string }>;
    }>("system.listEditors");
    const editors = edRes.data?.editors ?? [];
    const editorOpts = editors
      .map(
        (e) =>
          `<option value="${this.cb.esc(e.id)}" ${openTarget === e.id ? "selected" : ""}>${this.cb.esc(e.label)}</option>`,
      )
      .join("");
    // 遗留 editor 或已选但未探测到的 id：仍显示在下拉中
    let legacyOpt = "";
    if (
      openTarget &&
      openTarget !== "explorer" &&
      !editors.some((e) => e.id === openTarget)
    ) {
      const label =
        openTarget === "editor"
          ? "外部编辑器（未检测到）"
          : `${openTarget}（未检测到）`;
      legacyOpt = `<option value="${this.cb.esc(openTarget)}" selected>${this.cb.esc(label)}</option>`;
    }
    const emptyHint =
      editors.length === 0
        ? `<div class="settings-row-sub" style="margin-top:8px">未在 PATH 中检测到 VS Code / Cursor。可安装后重启，或使用文件资源管理器。</div>`
        : "";
    return `
      <h1 class="settings-title">常规</h1>

      <section class="settings-block">
        <h2 class="settings-h2">默认权限</h2>
        <p class="settings-desc">新对话默认使用的权限策略。输入区可临时覆盖，不影响此处默认值。</p>
        <div class="settings-choice-row">
          ${this.choiceCard("perm", "normal", mode === "normal", "默认确认", "读写工作区文件，敏感操作需你批准")}
          ${this.choiceCard("perm", "always_approve", mode === "always_approve", "完全访问", "无需逐步批准即可读写与执行（高风险）")}
          ${this.choiceCard("perm", "plan", mode === "plan", "Plan 模式", "偏向规划与确认，再执行变更")}
        </div>
      </section>

      <section class="settings-block">
        <h2 class="settings-h2">常规</h2>
        <div class="settings-card">
          <div class="settings-row">
            <div class="settings-row-text">
              <div class="settings-row-title">默认打开目标</div>
              <div class="settings-row-sub">顶栏「打开位置」打开项目时的目标</div>
            </div>
            <select id="cfg-open-target" class="settings-select">
              <option value="explorer" ${openTarget === "explorer" ? "selected" : ""}>文件资源管理器</option>
              ${editorOpts}
              ${legacyOpt}
            </select>
          </div>
          ${emptyHint}
        </div>
      </section>
    `;
  }

  private choiceCard(
    group: string,
    value: string,
    active: boolean,
    title: string,
    sub: string,
  ): string {
    return `<button type="button" class="settings-choice${active ? " active" : ""}" data-group="${group}" data-value="${value}">
      <div class="settings-choice-title">${this.cb.esc(title)}</div>
      <div class="settings-choice-sub">${this.cb.esc(sub)}</div>
      <span class="settings-choice-dot" aria-hidden="true"></span>
    </button>`;
  }

  private bindGeneral(root: HTMLElement): void {
    for (const el of Array.from(root.querySelectorAll(".settings-choice[data-group=perm]"))) {
      (el as HTMLElement).onclick = () => {
        const v = (el as HTMLElement).dataset.value as SettingsPermMode;
        void this.patch({ defaultPermMode: v }).then(() => this.renderContent());
      };
    }
    const sel = root.querySelector("#cfg-open-target") as HTMLSelectElement | null;
    sel?.addEventListener("change", () => {
      void this.patch({
        defaultOpenTarget: sel.value as SettingsOpenTarget,
      });
    });
  }

  // ── 账户与提供商（官方 OAuth / 自定义中转）────────────────

  private async htmlAccount(): Promise<string> {
    const tab = this.accountTab;
    const tabs = `
      <div class="settings-tabs" role="tablist">
        <button type="button" class="settings-tab${tab === "official" ? " active" : ""}" data-account-tab="official" role="tab" aria-selected="${tab === "official"}">官方账户</button>
        <button type="button" class="settings-tab${tab === "custom" ? " active" : ""}" data-account-tab="custom" role="tab" aria-selected="${tab === "custom"}">自定义提供商</button>
      </div>`;
    const body =
      tab === "official"
        ? await this.htmlAccountOfficial()
        : await this.htmlAccountCustom();
    return `
      <h1 class="settings-title">账户与提供商</h1>
      ${tabs}
      <div class="settings-tab-panel">${body}</div>
    `;
  }

  private async htmlAccountOfficial(): Promise<string> {
    const auth = await this.cb.inv<{
      authenticated: boolean;
      label?: string;
      authPath?: string;
      grokHome?: string;
      cliGrokHome?: string;
    }>("system.auth.status");
    const a = auth.data;
    const statusLine = a?.authenticated
      ? `已登录${a.label ? ` · ${this.cb.esc(a.label)}` : ""}`
      : "未登录";
    return `
      <section class="settings-block">
        <h2 class="settings-h2">xAI / Grok 官方</h2>
        <div class="settings-card">
          <div class="settings-row">
            <div class="settings-row-text">
              <div class="settings-row-title">登录状态</div>
              <div class="settings-row-sub">${statusLine}</div>
            </div>
            <div class="settings-inline-actions settings-row-actions">
              ${
                a?.authenticated
                  ? `<button type="button" class="btn-ghost settings-mini-btn" id="btn-auth-logout">退出登录</button>`
                  : `<button type="button" class="btn-dark settings-mini-btn" id="btn-auth-login">OAuth 登录</button>
                     <button type="button" class="btn-ghost settings-mini-btn" id="btn-auth-login-device">设备码登录</button>`
              }
              ${
                a?.authPath
                  ? `<button type="button" class="btn-ghost settings-mini-btn" data-open-path="${this.cb.esc(a.authPath)}">打开 auth</button>`
                  : ""
              }
            </div>
          </div>
          <div class="settings-kv"><span>Desktop GROK_HOME</span><span class="mono">${this.cb.esc(a?.grokHome ?? this.cfg.paths?.grokHome ?? "—")}</span></div>
          <div class="settings-kv"><span>CLI home（不写入）</span><span class="mono">${this.cb.esc(a?.cliGrokHome ?? "—")}</span></div>
        </div>
      </section>
    `;
  }

  private async htmlAccountCustom(): Promise<string> {
    const res = await this.cb.inv<{
      providers: CustomProviderRow[];
      defaultModel: string | null;
      configPath: string;
    }>("providers.list");
    const list = res.data?.providers ?? [];
    const configPath = res.data?.configPath ?? this.cfg.paths?.configToml ?? "";
    const editing = this.editingProviderId
      ? list.find((p) => p.id === this.editingProviderId)
      : null;
    const isEdit = Boolean(editing);

    const rows =
      list
        .map(
          (p) => `
        <div class="settings-list-item provider-row" data-provider-id="${this.cb.esc(p.id)}">
          <div class="settings-list-title">
            ${this.cb.esc(p.name || "未命名提供商")}
            <span class="settings-badge">${this.cb.esc(p.id)}</span>
            ${p.isDefault ? `<span class="settings-badge">默认</span>` : ""}
            ${p.hasApiKey ? "" : `<span class="settings-badge warn">无 key</span>`}
          </div>
          <div class="settings-list-sub mono">请求 ${this.cb.esc(p.model)} · ${this.cb.esc(p.baseUrl)}</div>
          <div class="provider-row-actions">
            ${p.isDefault ? "" : `<button type="button" class="btn-ghost settings-mini-btn" data-prov-act="default" data-id="${this.cb.esc(p.id)}">设为默认</button>`}
            <button type="button" class="btn-ghost settings-mini-btn" data-prov-act="edit" data-id="${this.cb.esc(p.id)}">编辑</button>
            <button type="button" class="btn-ghost settings-mini-btn" data-prov-act="remove" data-id="${this.cb.esc(p.id)}">删除</button>
          </div>
        </div>`,
        )
        .join("") ||
      `<div class="settings-empty">尚未配置自定义提供商。可添加 OpenAI 兼容中转站。</div>`;

    return `
      <section class="settings-block">
        <h2 class="settings-h2">已配置的提供商</h2>
        <div class="settings-card settings-list">${rows}</div>
        <div class="settings-inline-actions">
          <button type="button" class="btn-ghost settings-mini-btn" data-open-path="${this.cb.esc(configPath)}">打开 config.toml</button>
          <button type="button" class="btn-ghost settings-mini-btn" id="btn-prov-new">新建提供商</button>
        </div>
      </section>
      <section class="settings-block" id="prov-form-section">
        <h2 class="settings-h2">${isEdit ? "编辑提供商" : "添加提供商"}</h2>
        <div class="settings-card settings-form-card">
          <label class="settings-field">
            <span class="settings-field-label">提供商名称</span>
            <input class="settings-input" id="prov-name" value="${this.cb.esc(editing?.name ?? "")}" placeholder="例如 xai、OpenRouter、公司中转" autocomplete="off" />
          </label>
          <label class="settings-field">
            <span class="settings-field-label">Base URL</span>
            <input class="settings-input" id="prov-base" value="${this.cb.esc(editing?.baseUrl ?? "")}" placeholder="https://your-relay.example.com/v1" autocomplete="off" />
            <span class="settings-field-hint">OpenAI 兼容根路径（通常以 /v1 结尾）</span>
          </label>
          <div class="settings-field-row">
            <label class="settings-field">
              <span class="settings-field-label">API Key</span>
              <input class="settings-input" id="prov-key" type="password" value="" placeholder="${editing?.hasApiKey ? "已配置 · 留空则保留" : "sk-…"}" autocomplete="new-password" />
            </label>
            <label class="settings-field">
              <span class="settings-field-label">协议</span>
              <select class="settings-select" id="prov-backend">
                <option value="chat_completions" ${!editing || editing.apiBackend === "chat_completions" ? "selected" : ""}>OpenAI Chat Completions</option>
                <option value="responses" ${editing?.apiBackend === "responses" ? "selected" : ""}>OpenAI Responses</option>
                <option value="messages" ${editing?.apiBackend === "messages" ? "selected" : ""}>Anthropic Messages</option>
              </select>
            </label>
          </div>
          <div class="settings-form-actions" style="padding: 0 16px 8px">
            <button type="button" class="btn-ghost settings-mini-btn" id="btn-prov-fetch-models">拉取模型列表</button>
            <span class="settings-save-hint" id="prov-fetch-hint">GET {"{base_url}"}/models</span>
          </div>
          <div class="settings-field-row settings-field-row-models">
            <label class="settings-field">
              <span class="settings-field-label">显示名称</span>
              <input class="settings-input" id="prov-id" ${isEdit ? "readonly" : ""} value="${this.cb.esc(editing?.id ?? "")}" placeholder="默认与请求模型一致，可改" autocomplete="off" />
            </label>
            <div class="settings-field">
              <span class="settings-field-label">实际请求模型</span>
              <div class="settings-model-combo" id="prov-model-combo">
                <input class="settings-input" id="prov-model" value="${this.cb.esc(editing?.model ?? "")}" placeholder="手输或点右侧选择" autocomplete="off" />
                <button type="button" class="settings-model-combo-btn" id="btn-prov-model-menu" title="选择模型" aria-label="选择模型" aria-haspopup="listbox" aria-expanded="false">▾</button>
                <div class="settings-model-menu hidden" id="prov-model-menu" role="listbox"></div>
              </div>
            </div>
          </div>
          <label class="settings-field settings-field-check">
            <input type="checkbox" id="prov-default" ${editing?.isDefault ? "checked" : ""} />
            <span>设为 Desktop 默认模型</span>
          </label>
          <div class="settings-form-actions">
            <button type="button" class="btn-dark" id="btn-prov-save">${isEdit ? "保存" : "添加"}</button>
            ${isEdit ? `<button type="button" class="btn-ghost" id="btn-prov-cancel">取消编辑</button>` : ""}
            <span class="settings-save-hint" id="prov-save-hint"></span>
          </div>
        </div>
      </section>
    `;
  }

  private bindAccount(root: HTMLElement): void {
    for (const btn of Array.from(root.querySelectorAll("[data-account-tab]"))) {
      (btn as HTMLElement).onclick = () => {
        const t = (btn as HTMLElement).dataset.accountTab as AccountTab;
        if (t === "official" || t === "custom") {
          this.accountTab = t;
          if (t === "official") this.editingProviderId = null;
          void this.renderContent();
        }
      };
    }
    for (const btn of Array.from(root.querySelectorAll("[data-open-path]"))) {
      (btn as HTMLElement).onclick = () => {
        const p = (btn as HTMLElement).dataset.openPath;
        if (p) void this.cb.inv("system.openPath", { path: p });
      };
    }
    if (this.accountTab === "official") {
      const login = root.querySelector("#btn-auth-login") as HTMLElement | null;
      if (login) login.onclick = () => void this.runAuthLogin("oauth");
      const device = root.querySelector(
        "#btn-auth-login-device",
      ) as HTMLElement | null;
      if (device) device.onclick = () => void this.runAuthLogin("device-auth");
      const logout = root.querySelector("#btn-auth-logout") as HTMLElement | null;
      if (logout) logout.onclick = () => void this.runAuthLogout();
      return;
    }
    // custom tab
    root.querySelector("#btn-prov-new")?.addEventListener("click", () => {
      this.editingProviderId = null;
      this.remoteModelIds = [];
      this.modelMenuOpen = false;
      void this.renderContent().then(() => {
        document.getElementById("prov-form-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        (document.getElementById("prov-name") as HTMLInputElement | null)?.focus();
      });
    });
    root.querySelector("#btn-prov-cancel")?.addEventListener("click", () => {
      this.editingProviderId = null;
      this.remoteModelIds = [];
      this.modelMenuOpen = false;
      void this.renderContent();
    });
    root.querySelector("#btn-prov-save")?.addEventListener("click", () => {
      void this.saveProviderForm(root);
    });
    root.querySelector("#btn-prov-fetch-models")?.addEventListener("click", () => {
      void this.fetchRemoteModels(root);
    });
    this.bindModelCombo(root);
    // 提供商名称：独立字段，不随模型自动改
    const nameInput = root.querySelector("#prov-name") as HTMLInputElement | null;
    if (nameInput) {
      nameInput.addEventListener("input", () => {
        nameInput.dataset.userEdited = "1";
      });
    }
    // 显示名称（配置段 id）：用户手改后不再被模型选择覆盖
    const idInput = root.querySelector("#prov-id") as HTMLInputElement | null;
    if (idInput && !this.editingProviderId) {
      idInput.addEventListener("input", () => {
        idInput.dataset.userEdited = "1";
      });
    }
    const modelInput = root.querySelector(
      "#prov-model",
    ) as HTMLInputElement | null;
    if (modelInput) {
      modelInput.addEventListener("input", () => {
        this.syncDisplayNameFromModel(root, modelInput.value.trim(), false);
      });
      modelInput.addEventListener("change", () => {
        this.syncDisplayNameFromModel(root, modelInput.value.trim(), false);
      });
    }
    for (const btn of Array.from(root.querySelectorAll("[data-prov-act]"))) {
      (btn as HTMLElement).onclick = () => {
        const act = (btn as HTMLElement).dataset.provAct;
        const id = (btn as HTMLElement).dataset.id ?? "";
        if (!id) return;
        if (act === "edit") {
          this.editingProviderId = id;
          this.remoteModelIds = [];
          void this.renderContent().then(() => {
            void this.fetchRemoteModels(root, true);
          });
        } else if (act === "remove") {
          void this.removeProvider(id);
        } else if (act === "default") {
          void this.setProviderDefault(id);
        }
      };
    }
  }

  private bindModelCombo(root: HTMLElement): void {
    const combo = root.querySelector("#prov-model-combo") as HTMLElement | null;
    const menuBtn = root.querySelector(
      "#btn-prov-model-menu",
    ) as HTMLButtonElement | null;
    const menu = root.querySelector("#prov-model-menu") as HTMLElement | null;
    // 即使没有 combo 也要卸掉旧监听（render 后 DOM 已换）
    this.teardownModelMenu();
    if (!combo || !menuBtn || !menu) return;

    const closeMenu = () => {
      this.modelMenuOpen = false;
      menu.classList.add("hidden");
      menuBtn.setAttribute("aria-expanded", "false");
    };

    const openMenu = async () => {
      if (!this.remoteModelIds.length) {
        await this.fetchRemoteModels(root, false);
      }
      this.renderModelMenu(root);
      if (!this.remoteModelIds.length) {
        menu.innerHTML =
          `<div class="settings-model-menu-empty">暂无模型，请先填写 Base URL / Key 并拉取列表</div>`;
      }
      this.modelMenuOpen = true;
      menu.classList.remove("hidden");
      menuBtn.setAttribute("aria-expanded", "true");
    };

    menuBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.modelMenuOpen) closeMenu();
      else void openMenu();
    };

    this.modelMenuDocClose = (ev: MouseEvent) => {
      if (!this.modelMenuOpen) return;
      const t = ev.target as Node | null;
      if (t && combo.contains(t)) return;
      closeMenu();
    };
    document.addEventListener("click", this.modelMenuDocClose, true);
  }

  private renderModelMenu(root: HTMLElement): void {
    const menu = root.querySelector("#prov-model-menu") as HTMLElement | null;
    if (!menu) return;
    const cur = (
      root.querySelector("#prov-model") as HTMLInputElement | null
    )?.value.trim();
    if (!this.remoteModelIds.length) {
      menu.innerHTML = `<div class="settings-model-menu-empty">暂无模型列表</div>`;
      return;
    }
    menu.innerHTML = this.remoteModelIds
      .map((id) => {
        const active = id === cur ? " active" : "";
        return `<button type="button" class="settings-model-menu-item${active}" role="option" data-model-id="${this.cb.esc(id)}">${this.cb.esc(id)}</button>`;
      })
      .join("");
    for (const btn of Array.from(menu.querySelectorAll("[data-model-id]"))) {
      (btn as HTMLElement).onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.modelId ?? "";
        if (!id) return;
        this.applyModelSelection(root, id);
        menu.classList.add("hidden");
        this.modelMenuOpen = false;
        const menuBtn = root.querySelector("#btn-prov-model-menu");
        menuBtn?.setAttribute("aria-expanded", "false");
      };
    }
  }

  /** 选择远程模型：写入请求模型；显示名称默认跟随（未手改时） */
  private applyModelSelection(root: HTMLElement, modelId: string): void {
    const modelInput = root.querySelector(
      "#prov-model",
    ) as HTMLInputElement | null;
    if (modelInput) modelInput.value = modelId;
    this.syncDisplayNameFromModel(root, modelId, true);
  }

  /**
   * 显示名称（#prov-id / 配置段名）默认 = 实际请求模型；用户手改过则不覆盖。
   * 提供商名称（#prov-name）不在此同步。
   */
  private syncDisplayNameFromModel(
    root: HTMLElement,
    modelId: string,
    fromMenu: boolean,
  ): void {
    if (!modelId) return;
    if (this.editingProviderId) return; // 编辑时段名只读，不改
    const idInput = root.querySelector("#prov-id") as HTMLInputElement | null;
    if (!idInput) return;
    if (idInput.dataset.userEdited === "1" && !fromMenu) return;
    if (fromMenu) {
      if (idInput.dataset.userEdited === "1") {
        const modelBefore = idInput.dataset.lastAutoName ?? "";
        if (
          idInput.value.trim() &&
          idInput.value.trim() !== modelBefore &&
          idInput.value.trim() !== modelId
        ) {
          return;
        }
        idInput.dataset.userEdited = "0";
      }
      idInput.value = modelId;
      idInput.dataset.lastAutoName = modelId;
      return;
    }
    if (idInput.dataset.userEdited === "1") return;
    idInput.value = modelId;
    idInput.dataset.lastAutoName = modelId;
  }

  private fillModelMenuData(models: Array<{ id: string }>): void {
    this.remoteModelIds = models.map((m) => m.id);
  }

  private async fetchRemoteModels(
    root: HTMLElement,
    silent = false,
  ): Promise<void> {
    const hint = root.querySelector("#prov-fetch-hint");
    const baseUrl = (
      root.querySelector("#prov-base") as HTMLInputElement | null
    )?.value.trim();
    const apiKey = (
      root.querySelector("#prov-key") as HTMLInputElement | null
    )?.value;
    if (!baseUrl) {
      if (!silent && hint) hint.textContent = "请先填写 Base URL";
      return;
    }
    if (hint) hint.textContent = silent ? "正在拉取模型…" : "正在请求 /models…";
    const res = await this.cb.inv<{
      endpoint: string;
      models: Array<{ id: string }>;
    }>("providers.listRemoteModels", {
      baseUrl,
      apiKey: apiKey || undefined,
      providerId: this.editingProviderId ?? undefined,
    });
    if (!res.ok) {
      if (!silent && hint) {
        hint.textContent = res.error?.message ?? "拉取失败";
      } else if (hint && silent) {
        hint.textContent = "自动拉取失败，可点「拉取模型列表」";
      }
      return;
    }
    const models = res.data?.models ?? [];
    this.fillModelMenuData(models);
    if (this.modelMenuOpen) this.renderModelMenu(root);
    if (hint) {
      hint.textContent =
        models.length > 0
          ? `已加载 ${models.length} 个模型 · ${res.data?.endpoint ?? ""}`
          : `列表为空 · ${res.data?.endpoint ?? ""}`;
    }
  }

  private async saveProviderForm(root: HTMLElement): Promise<void> {
    const id = (
      root.querySelector("#prov-id") as HTMLInputElement | null
    )?.value.trim();
    const name = (
      root.querySelector("#prov-name") as HTMLInputElement | null
    )?.value.trim();
    const model = (
      root.querySelector("#prov-model") as HTMLInputElement | null
    )?.value.trim();
    const baseUrl = (
      root.querySelector("#prov-base") as HTMLInputElement | null
    )?.value.trim();
    const apiKey = (
      root.querySelector("#prov-key") as HTMLInputElement | null
    )?.value;
    const apiBackend = (
      root.querySelector("#prov-backend") as HTMLSelectElement | null
    )?.value as "chat_completions" | "responses" | "messages";
    const setAsDefault = Boolean(
      (root.querySelector("#prov-default") as HTMLInputElement | null)?.checked,
    );
    const hint = root.querySelector("#prov-save-hint");
    if (!id || !baseUrl || !model) {
      if (hint) hint.textContent = "请填写显示名称、实际请求模型与 Base URL";
      return;
    }
    const res = await this.cb.inv("providers.upsert", {
      id,
      name: name || id,
      model,
      baseUrl,
      apiKey: apiKey || undefined,
      apiBackend,
      setAsDefault,
    });
    if (!res.ok) {
      if (hint) hint.textContent = res.error?.message ?? "保存失败";
      else window.alert(res.error?.message ?? "保存失败");
      return;
    }
    if (setAsDefault) {
      await this.patch({ defaultModel: id });
    }
    this.editingProviderId = null;
    if (hint) hint.textContent = "已保存";
    await this.reloadConfig();
    this.applyToApp();
    await this.renderContent();
  }

  private async removeProvider(id: string): Promise<void> {
    if (!window.confirm(`删除提供商「${id}」？将从 config.toml 移除对应 [model.*]。`)) {
      return;
    }
    const res = await this.cb.inv("providers.remove", { id });
    if (!res.ok) {
      window.alert(res.error?.message ?? "删除失败");
      return;
    }
    if (this.editingProviderId === id) this.editingProviderId = null;
    await this.reloadConfig();
    this.applyToApp();
    await this.renderContent();
  }

  private async setProviderDefault(id: string): Promise<void> {
    const res = await this.cb.inv("providers.setDefault", { modelId: id });
    if (!res.ok) {
      window.alert(res.error?.message ?? "设置失败");
      return;
    }
    await this.patch({ defaultModel: id });
    await this.renderContent();
  }

  private async runAuthLogin(method: "oauth" | "device-auth"): Promise<void> {
    const res = await this.cb.inv<{ message?: string }>("system.auth.login", {
      method,
    });
    if (!res.ok) {
      window.alert(res.error?.message ?? "启动登录失败");
      return;
    }
    window.alert(res.data?.message ?? "已启动登录，完成后请刷新本页查看状态。");
    await this.renderContent();
  }

  private async runAuthLogout(): Promise<void> {
    if (!window.confirm("退出 Desktop 官方登录？不会影响 CLI，也不会删除中转站配置。")) {
      return;
    }
    const res = await this.cb.inv("system.auth.logout", {});
    if (!res.ok) {
      window.alert(res.error?.message ?? "退出失败");
      return;
    }
    await this.renderContent();
  }

  // ── 关于 ───────────────────────────────────────────────

  private async htmlAbout(): Promise<string> {
    const [ver, auth, info] = await Promise.all([
      this.cb.inv<Record<string, unknown>>("shell.versionMatrix"),
      this.cb.inv<{
        authenticated: boolean;
        label?: string;
        grokHome?: string;
      }>("system.auth.status"),
      this.cb.inv<{
        path: string | null;
        version: string | null;
        source?: string;
        agentBinMeta?: {
          version: string | null;
          source: string | null;
          syncedAt: string | null;
          sha256: string | null;
          binary: string | null;
        } | null;
      }>("system.grokInfo"),
    ]);
    const a = auth.data;
    const g = info.data;
    const v = ver.data ?? {};
    const meta = g?.agentBinMeta;
    const authLine = a?.authenticated
      ? `已登录${a.label ? ` · ${this.cb.esc(a.label)}` : ""}`
      : "未登录";
    const metaRows = meta
      ? `
          <div class="settings-kv"><span>agent-bin 记录版本</span><span class="mono">${this.cb.esc(meta.version ?? "—")}</span></div>
          <div class="settings-kv"><span>同步时间</span><span class="mono">${this.cb.esc(meta.syncedAt ?? "—")}</span></div>
          <div class="settings-kv"><span>sha256</span><span class="mono" title="${this.cb.esc(meta.sha256 ?? "")}">${this.cb.esc(
            meta.sha256 ? `${meta.sha256.slice(0, 16)}…` : "—",
          )}</span></div>
          <div class="settings-kv"><span>同步来源</span><span class="mono">${this.cb.esc(meta.source ?? "—")}</span></div>`
      : `
          <div class="settings-kv"><span>agent-bin 元数据</span><span>无 VERSION.txt（可 npm run sync:agent）</span></div>`;
    return `
      <h1 class="settings-title">关于</h1>
      <section class="settings-block">
        <h2 class="settings-h2">账户摘要</h2>
        <div class="settings-card">
          <div class="settings-kv"><span>官方账户</span><span>${authLine}</span></div>
          <div class="settings-kv"><span>Desktop GROK_HOME</span><span class="mono">${this.cb.esc(a?.grokHome ?? this.cfg.paths?.grokHome ?? "—")}</span></div>
        </div>
        <div class="settings-inline-actions">
          <button type="button" class="btn-dark settings-mini-btn" id="btn-goto-account">管理账户与提供商</button>
        </div>
      </section>
      <section class="settings-block">
        <h2 class="settings-h2">运行时</h2>
        <div class="settings-card">
          <div class="settings-kv"><span>Grok 路径</span><span class="mono">${this.cb.esc(g?.path ?? "—")}</span></div>
          <div class="settings-kv"><span>版本</span><span class="mono">${this.cb.esc(g?.version ?? "—")}</span></div>
          <div class="settings-kv"><span>来源</span><span>${this.cb.esc(
            g?.source === "bundled"
              ? "bundled（agent-bin / 安装包）"
              : g?.source === "override"
                ? "override（设置/环境变量）"
                : g?.source === "path"
                  ? "path（本机 CLI / PATH）"
                  : g?.source === "missing"
                    ? "missing（请放入 agent-bin 或安装 CLI）"
                    : (g?.source ?? "—"),
          )}</span></div>
          ${metaRows}
        </div>
      </section>
      <section class="settings-block">
        <h2 class="settings-h2">诊断</h2>
        <pre class="settings-pre">${this.cb.esc(JSON.stringify(v, null, 2))}</pre>
      </section>
    `;
  }

  private bindAbout(root: HTMLElement): void {
    const go = root.querySelector("#btn-goto-account") as HTMLElement | null;
    if (go) {
      go.onclick = () => {
        this.section = "account";
        this.renderNav();
        void this.renderContent();
      };
    }
  }

  // ── 记忆 ───────────────────────────────────────────────

  private async htmlMemory(): Promise<string> {
    const st = await this.cb.inv<{
      enabled: boolean;
      entryCount: number;
      storePath: string;
      message?: string;
    }>("memory.status");
    const s = st.data;
    const on = Boolean(s?.enabled);
    return `
      <h1 class="settings-title">记忆</h1>
      <p class="settings-desc">Desktop 侧记忆存储开关。关闭后不会向 agent 注入桌面记忆条目。</p>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-text">
            <div class="settings-row-title">启用记忆</div>
            <div class="settings-row-sub">${this.cb.esc(s?.message ?? (on ? "已启用" : "已关闭"))} · ${s?.entryCount ?? 0} 条</div>
          </div>
          <button type="button" class="settings-toggle${on ? " on" : ""}" id="cfg-memory-toggle" role="switch" aria-checked="${on}" title="切换记忆"></button>
        </div>
        <div class="settings-kv"><span>存储路径</span><span class="mono">${this.cb.esc(s?.storePath ?? "—")}</span></div>
      </div>
    `;
  }

  private bindMemory(root: HTMLElement): void {
    const btn = root.querySelector("#cfg-memory-toggle") as HTMLElement | null;
    btn?.addEventListener("click", async () => {
      const on = btn.classList.contains("on");
      await this.cb.inv("memory.setEnabled", { enabled: !on });
      await this.renderContent();
    });
  }

  // ── 快捷键 ─────────────────────────────────────────────

  private htmlShortcuts(): string {
    const rows: Array<[string, string]> = [
      ["Ctrl + P", "打开文件侧栏"],
      ["Ctrl + T", "打开浏览器分类"],
      ["Ctrl + \\", "展开 / 收起侧栏"],
      ["Enter", "发送消息（Shift+Enter 换行）"],
      ["Esc", "退出全屏侧栏 / 关闭设置"],
    ];
    return `
      <h1 class="settings-title">键盘快捷键</h1>
      <p class="settings-desc">当前已实现的快捷键（只读）。</p>
      <div class="settings-card">
        ${rows
          .map(
            ([k, v]) =>
              `<div class="settings-kv"><span>${this.cb.esc(v)}</span><kbd class="settings-kbd">${this.cb.esc(k)}</kbd></div>`,
          )
          .join("")}
      </div>
    `;
  }
}
