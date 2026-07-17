/**
 * Fix remaining Chinese UI strings after i18n-continue partial apply.
 * Uses only string literals so ${} is never evaluated at load time.
 */
import fs from "node:fs";

function patch(path, reps) {
  let s = fs.readFileSync(path, "utf8");
  let ok = 0;
  const miss = [];
  for (const [a, b] of reps) {
    if (!s.includes(a)) {
      miss.push(JSON.stringify(a).slice(0, 120));
      continue;
    }
    // replace first occurrence only for safety when needed
    s = s.replace(a, b);
    ok++;
  }
  fs.writeFileSync(path, s);
  console.log(path, "ok", ok, "miss", miss.length);
  for (const m of miss) console.log("  MISS:", m);
}

function replaceAll(path, reps) {
  let s = fs.readFileSync(path, "utf8");
  let ok = 0;
  const miss = [];
  for (const [a, b] of reps) {
    if (!s.includes(a)) {
      miss.push(JSON.stringify(a).slice(0, 120));
      continue;
    }
    const n = s.split(a).length - 1;
    s = s.split(a).join(b);
    ok += n;
  }
  fs.writeFileSync(path, s);
  console.log(path, "replaced", ok, "miss", miss.length);
  for (const m of miss) console.log("  MISS:", m);
}

// ── side-pane import ──
{
  let s = fs.readFileSync("src/renderer/side-pane.ts", "utf8");
  if (!s.includes('from "../shared/i18n/index.js"')) {
    s = s.replace(
      'import type { HostIpcMethod } from "../shared/host-api.js";\n',
      'import type { HostIpcMethod } from "../shared/host-api.js";\nimport { tr } from "../shared/i18n/index.js";\n',
    );
    fs.writeFileSync("src/renderer/side-pane.ts", s);
    console.log("side-pane: added tr import");
  } else {
    console.log("side-pane: tr import already present");
  }
}

patch("src/renderer/side-pane.ts", [
  [
    'this.showInfo(\n        "文件 / 变更\\n\\n" +\n          (lines || "工作树干净 · 无未提交变更") +\n          "\\n\\n从右侧文件树选择文件预览。",\n      );',
    'this.showInfo(\n        tr("side.changesHeader") +\n          (lines || tr("side.changesClean")) +\n          tr("side.changesFooter"),\n      );',
  ],
]);

// ── plugins-page remaining ──
patch("src/renderer/plugins-page.ts", [
  [
    'if (!confirm(`卸载插件「${t.dataset.name}」？`)) return;\n      await this.runMut("plugins.uninstall", { name: t.dataset.name, confirm: true }, "卸载中…");',
    'if (!confirm(tr("plug.confirmUninstall", { name: t.dataset.name ?? "" }))) return;\n      await this.runMut("plugins.uninstall", { name: t.dataset.name, confirm: true }, tr("plug.uninstalling"));',
  ],
  [
    'if (!confirm(`移除市场源并卸载其插件？\\n${t.dataset.url}`)) return;\n      await this.runMut("plugins.marketplace.remove", { url: t.dataset.url }, "移除市场源…");',
    'if (!confirm(tr("plug.confirmMarketRemove", { url: t.dataset.url ?? "" }))) return;\n      await this.runMut("plugins.marketplace.remove", { url: t.dataset.url }, tr("plug.removingMarket"));',
  ],
  [
    'if (title) title.textContent = "插件";\n      if (search) search.placeholder = "搜索插件…";',
    'if (title) title.textContent = tr("plug.titlePlugins");\n      if (search) search.placeholder = tr("plug.searchPlugins");',
  ],
  [
    'if (title) title.textContent = "技能";\n      if (search) search.placeholder = "搜索技能…";',
    'if (title) title.textContent = tr("plug.titleSkills");\n      if (search) search.placeholder = tr("plug.searchSkills");',
  ],
  [
    '${this.chip("user", "个人")}\n          ${this.chip("project", "项目")}',
    '${this.chip("user", tr("plug.scope.user"))}\n          ${this.chip("project", tr("plug.scope.project"))}',
  ],
  [
    'data-action="reload">刷新</button>\n          <button type="button" class="plugins-link-btn" data-action="open-plugins-dir">打开 Plugins 目录</button>',
    'data-action="reload">${this.cb.esc(tr("plug.refresh"))}</button>\n          <button type="button" class="plugins-link-btn" data-action="open-plugins-dir">${this.cb.esc(tr("plug.openPluginsDir"))}</button>',
  ],
  [
    'data-action="reload">刷新目录</button>\n          <button type="button" class="plugins-link-btn" data-action="market-refresh">更新所有源</button>',
    'data-action="reload">${this.cb.esc(tr("plug.refreshCatalog"))}</button>\n          <button type="button" class="plugins-link-btn" data-action="market-refresh">${this.cb.esc(tr("plug.updateAllSources"))}</button>',
  ],
  [
    'data-action="reload">刷新</button>\n          <button type="button" class="plugins-link-btn" data-action="open-mcp-config">编辑 MCP 配置</button>',
    'data-action="reload">${this.cb.esc(tr("plug.refresh"))}</button>\n          <button type="button" class="plugins-link-btn" data-action="open-mcp-config">${this.cb.esc(tr("plug.editMcpConfig"))}</button>',
  ],
  [
    'data-action="reload">刷新</button>\n          <button type="button" class="plugins-link-btn" data-action="open-skills-dir">打开 Skills 目录</button>',
    'data-action="reload">${this.cb.esc(tr("plug.refresh"))}</button>\n          <button type="button" class="plugins-link-btn" data-action="open-skills-dir">${this.cb.esc(tr("plug.openSkillsDir"))}</button>',
  ],
  [
    '<h2 class="plugins-section-title">安装插件</h2>\n      <div class="plugins-form-row">\n        <input id="plugin-install-source" class="plugins-input" placeholder="user/repo、git URL 或本地路径" />\n        <button type="button" class="plugins-card-btn primary" data-action="install-custom" id="btn-plugin-install">安装</button>\n      </div>\n      <p class="plugins-form-hint">等同 <span class="mono">grok plugin install &lt;source&gt; --trust</span></p>',
    '<h2 class="plugins-section-title">${this.cb.esc(tr("plug.installSection"))}</h2>\n      <div class="plugins-form-row">\n        <input id="plugin-install-source" class="plugins-input" placeholder="${this.cb.esc(tr("plug.installPh"))}" />\n        <button type="button" class="plugins-card-btn primary" data-action="install-custom" id="btn-plugin-install">${this.cb.esc(tr("plug.install"))}</button>\n      </div>\n      <p class="plugins-form-hint">${this.cb.esc(tr("plug.installHint"))}</p>',
  ],
  [
    '<h2 class="plugins-section-title">插件 · ${plugs.length}</h2>',
    '<h2 class="plugins-section-title">${this.cb.esc(tr("plug.listTitle", { n: plugs.length }))}</h2>',
  ],
  [
    '<h2 class="plugins-section-title">添加 MCP</h2>\n      <div class="plugins-form-card">\n        <div class="plugins-form-grid">\n          <input id="mcp-add-name" class="plugins-input" placeholder="名称" />\n          <select id="mcp-add-transport" class="plugins-input">\n            <option value="stdio">stdio</option>\n            <option value="http">http</option>\n            <option value="sse">sse</option>\n          </select>\n          <input id="mcp-add-cmd" class="plugins-input" placeholder="命令 或 URL" />\n          <input id="mcp-add-args" class="plugins-input" placeholder="stdio 参数（空格分隔，可选）" />\n        </div>\n        <button type="button" class="plugins-card-btn primary" data-action="mcp-add-submit">添加 MCP</button>\n      </div>\n      <p class="plugins-form-hint">等同 <span class="mono">grok mcp add</span> · 配置写入 Desktop GROK_HOME</p>\n    </section>\n    <section class="plugins-section">\n      <h2 class="plugins-section-title">已配置 · ${mcps.length}</h2>',
    '<h2 class="plugins-section-title">${this.cb.esc(tr("plug.addMcp"))}</h2>\n      <div class="plugins-form-card">\n        <div class="plugins-form-grid">\n          <input id="mcp-add-name" class="plugins-input" placeholder="${this.cb.esc(tr("plug.mcpName"))}" />\n          <select id="mcp-add-transport" class="plugins-input">\n            <option value="stdio">stdio</option>\n            <option value="http">http</option>\n            <option value="sse">sse</option>\n          </select>\n          <input id="mcp-add-cmd" class="plugins-input" placeholder="${this.cb.esc(tr("plug.mcpCmd"))}" />\n          <input id="mcp-add-args" class="plugins-input" placeholder="${this.cb.esc(tr("plug.mcpArgs"))}" />\n        </div>\n        <button type="button" class="plugins-card-btn primary" data-action="mcp-add-submit">${this.cb.esc(tr("plug.mcpAddBtn"))}</button>\n      </div>\n      <p class="plugins-form-hint">${this.cb.esc(tr("plug.mcpHint"))}</p>\n    </section>\n    <section class="plugins-section">\n      <h2 class="plugins-section-title">${this.cb.esc(tr("plug.mcpConfigured", { n: mcps.length }))}</h2>',
  ],
  [
    '`<div class="plugins-empty">尚未配置 MCP。可用上方表单添加，或点底部「编辑 MCP 配置」。</div>`',
    '`<div class="plugins-empty">${this.cb.esc(tr("plug.noMcp"))}</div>`',
  ],
  [
    '<h2 class="plugins-section-title">市场源 · ${this.markets.length}</h2>\n      <div class="plugins-form-row">\n        <input id="market-add-url" class="plugins-input" placeholder="git URL 或 user/repo" />\n        <button type="button" class="plugins-card-btn primary" data-action="market-add-submit">添加源</button>\n      </div>',
    '<h2 class="plugins-section-title">${this.cb.esc(tr("plug.marketSources", { n: this.markets.length }))}</h2>\n      <div class="plugins-form-row">\n        <input id="market-add-url" class="plugins-input" placeholder="${this.cb.esc(tr("plug.marketUrlPh"))}" />\n        <button type="button" class="plugins-card-btn primary" data-action="market-add-submit">${this.cb.esc(tr("plug.addSource"))}</button>\n      </div>',
  ],
  [
    '`<div class="plugins-empty">无匹配插件。可刷新目录或添加市场源。</div>`',
    '`<div class="plugins-empty">${this.cb.esc(tr("plug.noMarketPlugins"))}</div>`',
  ],
  [
    'data-action="install" data-name="${this.cb.esc(p.name)}" data-source="${this.cb.esc(p.name)}">安装</button>\n        <button type="button" class="plugins-card-btn" data-action="details" data-name="${this.cb.esc(p.name)}">详情</button>',
    'data-action="install" data-name="${this.cb.esc(p.name)}" data-source="${this.cb.esc(p.name)}">${this.cb.esc(tr("plug.install"))}</button>\n        <button type="button" class="plugins-card-btn" data-action="details" data-name="${this.cb.esc(p.name)}">${this.cb.esc(tr("plug.details"))}</button>',
  ],
  [
    'data-action="details" data-name="${this.cb.esc(p.name)}">详情</button>\n        ${\n          disabled\n            ? `<button type="button" class="plugins-card-btn primary" data-action="enable" data-name="${this.cb.esc(p.name)}">启用</button>`\n            : `<button type="button" class="plugins-card-btn" data-action="disable" data-name="${this.cb.esc(p.name)}">禁用</button>`\n        }\n        <button type="button" class="plugins-card-btn" data-action="update-plugin" data-name="${this.cb.esc(p.name)}">更新</button>\n        <button type="button" class="plugins-card-btn" data-action="uninstall" data-name="${this.cb.esc(p.name)}">卸载</button>',
    'data-action="details" data-name="${this.cb.esc(p.name)}">${this.cb.esc(tr("plug.details"))}</button>\n        ${\n          disabled\n            ? `<button type="button" class="plugins-card-btn primary" data-action="enable" data-name="${this.cb.esc(p.name)}">${this.cb.esc(tr("plug.enable"))}</button>`\n            : `<button type="button" class="plugins-card-btn" data-action="disable" data-name="${this.cb.esc(p.name)}">${this.cb.esc(tr("plug.disable"))}</button>`\n        }\n        <button type="button" class="plugins-card-btn" data-action="update-plugin" data-name="${this.cb.esc(p.name)}">${this.cb.esc(tr("plug.update"))}</button>\n        <button type="button" class="plugins-card-btn" data-action="uninstall" data-name="${this.cb.esc(p.name)}">${this.cb.esc(tr("plug.uninstall"))}</button>',
  ],
  [
    'data-action="mcp-doctor" data-name="${this.cb.esc(m.name)}">诊断</button>\n          <button type="button" class="plugins-card-btn" data-action="mcp-remove" data-name="${this.cb.esc(m.name)}">移除</button>',
    'data-action="mcp-doctor" data-name="${this.cb.esc(m.name)}">${this.cb.esc(tr("plug.diagnose"))}</button>\n          <button type="button" class="plugins-card-btn" data-action="mcp-remove" data-name="${this.cb.esc(m.name)}">${this.cb.esc(tr("plug.remove"))}</button>',
  ],
  [
    'data-action="market-refresh" data-name="${this.cb.esc(m.name)}">更新</button>\n          <button type="button" class="plugins-card-btn" data-action="market-remove" data-url="${this.cb.esc(m.url)}">移除</button>',
    'data-action="market-refresh" data-name="${this.cb.esc(m.name)}">${this.cb.esc(tr("plug.update"))}</button>\n          <button type="button" class="plugins-card-btn" data-action="market-remove" data-url="${this.cb.esc(m.url)}">${this.cb.esc(tr("plug.remove"))}</button>',
  ],
]);

// ── main.ts remaining high-frequency ──
patch("src/renderer/main.ts", [
  [
    '  $("welcome-title").textContent = p\n    ? `我们应该在 ${p.title} 中做些什么？`\n    : "我们应该做些什么？";',
    '  $("welcome-title").textContent = p\n    ? tr("welcome.askProject", { title: p.title })\n    : tr("welcome.askGeneric");',
  ],
  [
    '  if (ms < 1000) return `已处理 ${Math.max(ms, 0)}ms`;\n  const sec = Math.round(ms / 1000);\n  if (sec < 60) return `已处理 ${sec}s`;\n  const m = Math.floor(sec / 60);\n  const s = sec % 60;\n  return s > 0 ? `已处理 ${m}分${s}s` : `已处理 ${m}分`;',
    '  if (ms < 1000) return tr("process.elapsedMs", { n: Math.max(ms, 0) });\n  const sec = Math.round(ms / 1000);\n  if (sec < 60) return tr("process.elapsedSec", { n: sec });\n  const m = Math.floor(sec / 60);\n  const s = sec % 60;\n  return s > 0\n    ? tr("process.elapsedMinSec", { m, s })\n    : tr("process.elapsedMin", { m });',
  ],
  [
    '              ? "已开启完全访问（与权限 chip 同步）"\n              : "已关闭完全访问，恢复默认确认"',
    '              ? tr("slash.fullOn")\n              : tr("slash.fullOff")',
  ],
  [
    '    title: "重命名会话",\n    hint: "侧栏与导出将使用此标题",',
    '    title: tr("slash.renameTitle"),\n    hint: tr("slash.renameHint"),',
  ],
  [
    '  if (!res.ok) return { ok: false, message: res.error?.message ?? "导出失败" };\n  if (res.data?.canceled) return { ok: true, message: "已取消导出" };',
    '  if (!res.ok) return { ok: false, message: res.error?.message ?? tr("slash.exportFail") };\n  if (res.data?.canceled) return { ok: true, message: tr("slash.exportCancel") };',
  ],
]);

// ── settings-page provider form ──
replaceAll("src/renderer/settings-page.ts", [
  [
    '`<div class="settings-empty">尚未配置自定义提供商。可添加 OpenAI 兼容中转站。</div>`',
    '`<div class="settings-empty">${this.cb.esc(tr("prov.empty"))}</div>`',
  ],
  [
    '<h2 class="settings-h2">已配置的提供商</h2>',
    '<h2 class="settings-h2">${this.cb.esc(tr("sett.providersConfigured") || "Configured providers")}</h2>',
  ],
]);

console.log("done");
