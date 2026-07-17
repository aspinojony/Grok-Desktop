/**
 * One-shot i18n string replacements for continue pass.
 * All patterns are plain strings (no outer template literals) so ${...} is not evaluated.
 */
import fs from "node:fs";

function patch(path, reps) {
  let s = fs.readFileSync(path, "utf8");
  let ok = 0;
  const miss = [];
  for (const [a, b] of reps) {
    if (!s.includes(a)) {
      miss.push(a.slice(0, 100).replace(/\n/g, "\\n"));
      continue;
    }
    s = s.split(a).join(b);
    ok++;
  }
  fs.writeFileSync(path, s);
  console.log(path, "ok", ok, "miss", miss.length);
  for (const m of miss) console.log("  MISS:", m);
}

// ── plugins-page ─────────────────────────────────────────
patch("src/renderer/plugins-page.ts", [
  [
    'this.setSectionsHtml(`<div class="plugins-loading">加载中…</div>`)',
    'this.setSectionsHtml(`<div class="plugins-loading">${this.cb.esc(tr("plug.loading"))}</div>`)',
  ],
  [
    'this.setSectionsHtml(`<div class="plugins-loading">加载市场目录…</div>`)',
    'this.setSectionsHtml(`<div class="plugins-loading">${this.cb.esc(tr("plug.loadingMarket"))}</div>`)',
  ],
  [
    'this.setSectionsHtml(`<div class="plugins-loading">加载详情…</div>`)',
    'this.setSectionsHtml(`<div class="plugins-loading">${this.cb.esc(tr("plug.loadingDetail"))}</div>`)',
  ],
  [
    'this.setSectionsHtml(`<div class="plugins-loading">诊断 MCP…</div>`)',
    'this.setSectionsHtml(`<div class="plugins-loading">${this.cb.esc(tr("plug.loadingDoctor"))}</div>`)',
  ],
  [
    'this.setSectionsHtml(`<div class="plugins-loading">刷新中…</div>`)',
    'this.setSectionsHtml(`<div class="plugins-loading">${this.cb.esc(tr("plug.loadingRefresh"))}</div>`)',
  ],
  ['this.toast("请填写安装源")', 'this.toast(tr("plug.needSource"))'],
  [
    '`正在安装 ${src}…`',
    'tr("plug.installing", { src })',
  ],
  [
    '}, `正在安装 ${t.dataset.name}…`);',
    '}, tr("plug.installingName", { name: t.dataset.name ?? "" }));',
  ],
  [
    'this.toast(res.error?.message || "详情失败")',
    'this.toast(res.error?.message || tr("plug.detailFail"))',
  ],
  [
    'this.detailText = res.data?.text || "(无详情)"',
    'this.detailText = res.data?.text || tr("plug.noDetail")',
  ],
  [
    'this.toast(res.error?.message || "doctor 失败")',
    'this.toast(res.error?.message || tr("plug.doctorFail"))',
  ],
  [
    'this.toast(res.error?.message || "操作失败")',
    'this.toast(res.error?.message || tr("plug.opFail"))',
  ],
  [
    'this.toast(res.data?.message || "完成")',
    'this.toast(res.data?.message || tr("plug.done"))',
  ],
  [
    'this.toast("请填写名称与命令/URL")',
    'this.toast(tr("plug.needMcpFields"))',
  ],
  [
    'this.toast("请填写市场源 URL 或 user/repo")',
    'this.toast(tr("plug.needMarketUrl"))',
  ],
  [
    'if (title) title.textContent = "插件";\n      if (search) search.placeholder = "搜索插件…";',
    'if (title) title.textContent = tr("plug.titlePlugins");\n      if (search) search.placeholder = tr("plug.searchPlugins");',
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
    'if (title) title.textContent = "市场";',
    'if (title) title.textContent = tr("plug.titleMarket");',
  ],
  [
    'if (search) search.placeholder = "搜索可安装插件…";',
    'if (search) search.placeholder = tr("plug.searchMarket");',
  ],
  [
    'data-action="reload">刷新目录</button>\n          <button type="button" class="plugins-link-btn" data-action="market-refresh">更新所有源</button>',
    'data-action="reload">${this.cb.esc(tr("plug.refreshCatalog"))}</button>\n          <button type="button" class="plugins-link-btn" data-action="market-refresh">${this.cb.esc(tr("plug.updateAllSources"))}</button>',
  ],
  [
    'if (title) title.textContent = "技能";\n      if (search) search.placeholder = "搜索技能…";',
    'if (title) title.textContent = tr("plug.titleSkills");\n      if (search) search.placeholder = tr("plug.searchSkills");',
  ],
  [
    'if (search) search.placeholder = "搜索 MCP 服务器…";',
    'if (search) search.placeholder = tr("plug.searchMcp");',
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
    'data-action="close-detail">关闭</button>',
    'data-action="close-detail">${this.cb.esc(tr("plug.close"))}</button>',
  ],
  [
    'return `<div class="plugins-empty">暂无匹配技能。</div>`;',
    'return `<div class="plugins-empty">${this.cb.esc(tr("plug.noSkills"))}</div>`;',
  ],
  [
    '(s.scope === "project" ? "项目技能" : "个人技能")',
    '(s.scope === "project" ? tr("plug.skillsProject") : tr("plug.skillsUser"))',
  ],
  [
    '<h2 class="plugins-section-title">安装插件</h2>\n      <div class="plugins-form-row">\n        <input id="plugin-install-source" class="plugins-input" placeholder="user/repo、git URL 或本地路径" />\n        <button type="button" class="plugins-card-btn primary" data-action="install-custom" id="btn-plugin-install">安装</button>\n      </div>\n      <p class="plugins-form-hint">等同 <span class="mono">grok plugin install &lt;source&gt; --trust</span></p>',
    '<h2 class="plugins-section-title">${this.cb.esc(tr("plug.installSection"))}</h2>\n      <div class="plugins-form-row">\n        <input id="plugin-install-source" class="plugins-input" placeholder="${this.cb.esc(tr("plug.installPh"))}" />\n        <button type="button" class="plugins-card-btn primary" data-action="install-custom" id="btn-plugin-install">${this.cb.esc(tr("plug.install"))}</button>\n      </div>\n      <p class="plugins-form-hint">${this.cb.esc(tr("plug.installHint"))}</p>',
  ],
  [
    'html += `<section class="plugins-section">\n        <h2 class="plugins-section-title">插件 · ${plugs.length}</h2>',
    'html += `<section class="plugins-section">\n        <h2 class="plugins-section-title">${this.cb.esc(tr("plug.listTitle", { n: plugs.length }))}</h2>',
  ],
  [
    'html += `<div class="plugins-empty">暂无已安装/发现的插件。可从「市场」安装，或使用上方表单。</div>`;',
    'html += `<div class="plugins-empty">${this.cb.esc(tr("plug.noPlugins"))}</div>`;',
  ],
  [
    '<h2 class="plugins-section-title">添加 MCP</h2>\n      <div class="plugins-form-card">\n        <div class="plugins-form-grid">\n          <input id="mcp-add-name" class="plugins-input" placeholder="名称" />\n          <select id="mcp-add-transport" class="plugins-input">\n            <option value="stdio">stdio</option>\n            <option value="http">http</option>\n            <option value="sse">sse</option>\n          </select>\n          <input id="mcp-add-cmd" class="plugins-input" placeholder="命令 或 URL" />\n          <input id="mcp-add-args" class="plugins-input" placeholder="stdio 参数（空格分隔，可选）" />\n        </div>\n        <button type="button" class="plugins-card-btn primary" data-action="mcp-add-submit">添加 MCP</button>\n      </div>\n      <p class="plugins-form-hint">等同 <span class="mono">grok mcp add</span> · 配置写入 Desktop GROK_HOME</p>\n    </section>\n    <section class="plugins-section">\n      <h2 class="plugins-section-title">已配置 · ${mcps.length}</h2>',
    '<h2 class="plugins-section-title">${this.cb.esc(tr("plug.addMcp"))}</h2>\n      <div class="plugins-form-card">\n        <div class="plugins-form-grid">\n          <input id="mcp-add-name" class="plugins-input" placeholder="${this.cb.esc(tr("plug.mcpName"))}" />\n          <select id="mcp-add-transport" class="plugins-input">\n            <option value="stdio">stdio</option>\n            <option value="http">http</option>\n            <option value="sse">sse</option>\n          </select>\n          <input id="mcp-add-cmd" class="plugins-input" placeholder="${this.cb.esc(tr("plug.mcpCmd"))}" />\n          <input id="mcp-add-args" class="plugins-input" placeholder="${this.cb.esc(tr("plug.mcpArgs"))}" />\n        </div>\n        <button type="button" class="plugins-card-btn primary" data-action="mcp-add-submit">${this.cb.esc(tr("plug.mcpAddBtn"))}</button>\n      </div>\n      <p class="plugins-form-hint">${this.cb.esc(tr("plug.mcpHint"))}</p>\n    </section>\n    <section class="plugins-section">\n      <h2 class="plugins-section-title">${this.cb.esc(tr("plug.mcpConfigured", { n: mcps.length }))}</h2>',
  ],
  [
    '?: `<div class="plugins-empty">尚未配置 MCP。可用上方表单添加，或点底部「编辑 MCP 配置」。</div>`',
    '?: `<div class="plugins-empty">${this.cb.esc(tr("plug.noMcp"))}</div>`',
  ],
  [
    '<h2 class="plugins-section-title">市场源 · ${this.markets.length}</h2>\n      <div class="plugins-form-row">\n        <input id="market-add-url" class="plugins-input" placeholder="git URL 或 user/repo" />\n        <button type="button" class="plugins-card-btn primary" data-action="market-add-submit">添加源</button>\n      </div>',
    '<h2 class="plugins-section-title">${this.cb.esc(tr("plug.marketSources", { n: this.markets.length }))}</h2>\n      <div class="plugins-form-row">\n        <input id="market-add-url" class="plugins-input" placeholder="${this.cb.esc(tr("plug.marketUrlPh"))}" />\n        <button type="button" class="plugins-card-btn primary" data-action="market-add-submit">${this.cb.esc(tr("plug.addSource"))}</button>\n      </div>',
  ],
  [
    ': `<div class="plugins-empty">无市场源</div>`',
    ': `<div class="plugins-empty">${this.cb.esc(tr("plug.noMarketSrc"))}</div>`',
  ],
  [
    '<h2 class="plugins-section-title">可安装 · ${list.length}${list.length > CAP ? `（显示前 ${CAP}）` : ""}</h2>',
    '<h2 class="plugins-section-title">${this.cb.esc(tr("plug.availableTitle", { n: list.length }) + (list.length > CAP ? tr("plug.availableCap", { cap: CAP }) : ""))}</h2>',
  ],
  [
    '?: `<div class="plugins-empty">无匹配插件。可刷新目录或添加市场源。</div>`',
    '?: `<div class="plugins-empty">${this.cb.esc(tr("plug.noMarketPlugins"))}</div>`',
  ],
  [
    'data-action="use-skill" data-name="${this.cb.esc(s.name)}">使用</button>',
    'data-action="use-skill" data-name="${this.cb.esc(s.name)}">${this.cb.esc(tr("plug.use"))}</button>',
  ],
  [
    'data-action="open-path" data-path="${this.cb.esc(s.path)}">打开</button>',
    'data-action="open-path" data-path="${this.cb.esc(s.path)}">${this.cb.esc(tr("plug.open"))}</button>',
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
    'data-action="open-path" data-path="${this.cb.esc(p.path)}">目录</button>',
    'data-action="open-path" data-path="${this.cb.esc(p.path)}">${this.cb.esc(tr("plug.folder"))}</button>',
  ],
  [
    'data-action="mcp-doctor" data-name="${this.cb.esc(m.name)}">诊断</button>\n          <button type="button" class="plugins-card-btn" data-action="mcp-remove" data-name="${this.cb.esc(m.name)}">移除</button>',
    'data-action="mcp-doctor" data-name="${this.cb.esc(m.name)}">${this.cb.esc(tr("plug.diagnose"))}</button>\n          <button type="button" class="plugins-card-btn" data-action="mcp-remove" data-name="${this.cb.esc(m.name)}">${this.cb.esc(tr("plug.remove"))}</button>',
  ],
  [
    'data-action="market-refresh" data-name="${this.cb.esc(m.name)}">更新</button>\n          <button type="button" class="plugins-card-btn" data-action="market-remove" data-url="${this.cb.esc(m.url)}">移除</button>',
    'data-action="market-refresh" data-name="${this.cb.esc(m.name)}">${this.cb.esc(tr("plug.update"))}</button>\n          <button type="button" class="plugins-card-btn" data-action="market-remove" data-url="${this.cb.esc(m.url)}">${this.cb.esc(tr("plug.remove"))}</button>',
  ],
  [
    'if (!confirm(`卸载插件「${t.dataset.name}」？`)) return;\n      await this.runMut("plugins.uninstall", { name: t.dataset.name, confirm: true }, "卸载中…");',
    'if (!confirm(tr("plug.confirmUninstall", { name: t.dataset.name ?? "" }))) return;\n      await this.runMut("plugins.uninstall", { name: t.dataset.name, confirm: true }, tr("plug.uninstalling"));',
  ],
  [
    'await this.runMut("plugins.enable", { name: t.dataset.name }, "启用中…");',
    'await this.runMut("plugins.enable", { name: t.dataset.name }, tr("plug.enabling"));',
  ],
  [
    'await this.runMut("plugins.disable", { name: t.dataset.name }, "禁用中…");',
    'await this.runMut("plugins.disable", { name: t.dataset.name }, tr("plug.disabling"));',
  ],
  [
    'await this.runMut("plugins.update", { name: t.dataset.name }, "更新中…");',
    'await this.runMut("plugins.update", { name: t.dataset.name }, tr("plug.updating"));',
  ],
  [
    'if (!confirm(`移除 MCP「${t.dataset.name}」？`)) return;',
    'if (!confirm(tr("plug.confirmMcpRemove", { name: t.dataset.name ?? "" }))) return;',
  ],
  ['"移除 MCP…"', 'tr("plug.removingMcp")'],
  [
    'if (!confirm(`移除市场源并卸载其插件？\\n${t.dataset.url}`)) return;\n      await this.runMut("plugins.marketplace.remove", { url: t.dataset.url }, "移除市场源…");',
    'if (!confirm(tr("plug.confirmMarketRemove", { url: t.dataset.url ?? "" }))) return;\n      await this.runMut("plugins.marketplace.remove", { url: t.dataset.url }, tr("plug.removingMarket"));',
  ],
  ['"刷新市场…"', 'tr("plug.refreshingMarket")'],
  ['"添加 MCP…"', 'tr("plug.addingMcp")'],
  [
    'await this.runMut("plugins.marketplace.add", { url }, "添加市场源…");',
    'await this.runMut("plugins.marketplace.add", { url }, tr("plug.addingMarket"));',
  ],
  [
    '(res.data?.json ? JSON.stringify(res.data.json, null, 2) : "(无输出)")',
    '(res.data?.json ? JSON.stringify(res.data.json, null, 2) : tr("plug.noOutput"))',
  ],
]);

// ── side-pane ────────────────────────────────────────────
{
  let s = fs.readFileSync("src/renderer/side-pane.ts", "utf8");
  if (!s.includes('from "../shared/i18n/index.js"')) {
    s = s.replace(
      'import type { HostIpcMethod } from "../shared/host-api.js";\n',
      'import type { HostIpcMethod } from "../shared/host-api.js";\nimport { tr } from "../shared/i18n/index.js";\n',
    );
  }
  fs.writeFileSync("src/renderer/side-pane.ts", s);
}

patch("src/renderer/side-pane.ts", [
  [
    'focusBtn.title = this.focusMode ? "退出全屏侧栏" : "全屏展开侧栏";',
    'focusBtn.title = this.focusMode ? tr("side.focusExit") : tr("side.focusEnter");',
  ],
  [
    '"当前项目：\\n" + (this.getCwd() ?? "（未选择）")',
    'tr("side.cwdLine", { cwd: this.getCwd() ?? tr("side.cwdNone") })',
  ],
  [
    '`<div class="file-tree-empty">请先选择项目</div>`',
    '`<div class="file-tree-empty">${esc(tr("side.needProject"))}</div>`',
  ],
  [
    'root.innerHTML = `<div class="file-tree-empty">请先选择项目</div>`;',
    'root.innerHTML = `<div class="file-tree-empty">${esc(tr("side.needProject"))}</div>`;',
  ],
  [
    'root.innerHTML = `<div class="file-tree-empty">无匹配文件</div>`;',
    'root.innerHTML = `<div class="file-tree-empty">${esc(tr("side.noMatchFiles"))}</div>`;',
  ],
  [
    'btn.title = this.treeVisible ? "收起文件目录" : "展开文件目录";',
    'btn.title = this.treeVisible ? tr("side.collapseTree") : tr("side.expandTree");',
  ],
  [
    'this.treeVisible ? "收起文件目录" : "展开文件目录",',
    'this.treeVisible ? tr("side.collapseTree") : tr("side.expandTree"),',
  ],
  [
    'this.showInfo(res.error?.message ?? "无法读取文件");',
    'this.showInfo(res.error?.message ?? tr("side.readFail"));',
  ],
  [
    'this.showInfo(`这是目录：\\n${d.absPath}\\n\\n请点击具体文件路径。`);',
    'this.showInfo(tr("side.isDir", { path: d.absPath }));',
  ],
  [
    'this.showInfo("请先选择项目");',
    'this.showInfo(tr("side.needProject"));',
  ],
  [
    '"文件 / 变更\\n\\n" +\n          (lines || "工作树干净 · 无未提交变更") +\n          "\\n\\n从右侧文件树选择文件预览。"',
    'tr("side.changesHeader") +\n          (lines || tr("side.changesClean")) +\n          tr("side.changesFooter")',
  ],
  ['title="关闭"', 'title="${esc(tr("side.tabClose"))}"'],
  [
    'info.textContent = `二进制文件，无法在侧栏预览。\\n${tab.absPath}\\n\\n请通过 ⋯ →「在编辑器中打开」外部查看。`;',
    'info.textContent = tr("side.binary", { path: tab.absPath });',
  ],
  [
    'note.textContent = "文件较大，内容已截断显示。";',
    'note.textContent = tr("side.truncatedNote");',
  ],
  [
    'this.showInfo(res.error?.message ?? "保存失败");',
    'this.showInfo(res.error?.message ?? tr("side.saveFail"));',
  ],
]);

// ── main.ts high-frequency ───────────────────────────────
patch("src/renderer/main.ts", [
  [
    `$("welcome-title").textContent = p
    ? \`我们应该在 \${p.title} 中做些什么？\`
    : "我们应该做些什么？";`,
    `$("welcome-title").textContent = p
    ? tr("welcome.askProject", { title: p.title })
    : tr("welcome.askGeneric");`,
  ],
  [
    `if (ms < 1000) return \`已处理 \${Math.max(ms, 0)}ms\`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return \`已处理 \${sec}s\`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? \`已处理 \${m}分\${s}s\` : \`已处理 \${m}分\`;`,
    `if (ms < 1000) return tr("process.elapsedMs", { n: Math.max(ms, 0) });
  const sec = Math.round(ms / 1000);
  if (sec < 60) return tr("process.elapsedSec", { n: sec });
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0
    ? tr("process.elapsedMinSec", { m, s })
    : tr("process.elapsedMin", { m });`,
  ],
  [
    'if (turnActive) setTurnStatus(`正在运行 · ${name}`);',
    'if (turnActive) setTurnStatus(tr("process.runningTool", { name }));',
  ],
  [
    'showToast("无法连接会话，回退失败", "error");',
    'showToast(tr("chat.rewindAttachFail2"), "error");',
  ],
  [
    'if (btn) btn.title = `模型 ${modelLabel} · 推理 ${effortLabel()}（${effortLevel}）`;',
    'if (btn) btn.title = tr("chat.modelTitle", { model: modelLabel, effort: effortLabel(), level: effortLevel });',
  ],
  [
    'showToast("无活动会话", "error");',
    'showToast(tr("plan.noSession"), "error");',
  ],
  [
    'ap.textContent = busy && approveLabel ? approveLabel : "批准并开始实现";',
    'ap.textContent = busy && approveLabel ? approveLabel : tr("plan.approveBtn");',
  ],
  [
    'showToast("已批准，agent 将开始实现");',
    'showToast(tr("plan.approvedToast"));',
  ],
  [
    'appendLine("已批准计划，agent 继续实现中…", "system");',
    'appendLine(tr("plan.approvedLine"), "system");',
  ],
  [
    'showToast("已批准，正在开始实现…");',
    'showToast(tr("plan.implStartToast"));',
  ],
  [
    'showToast("已放弃计划");',
    'showToast(tr("plan.abandonToast"));',
  ],
  [
    'appendLine("已放弃计划", "system");',
    'appendLine(tr("plan.abandonLine"), "system");',
  ],
  [
    'showToast("当前回合进行中，请稍后再试", "error");',
    'showToast(tr("chat.turnBusy"), "error");',
  ],
  [
    'setTurnStatus("正在连接…");',
    'setTurnStatus(tr("chat.connecting"));',
  ],
  [
    'appendLine("无法连接会话，请手动发送", "error");',
    'appendLine(tr("chat.connectFail"), "error");',
  ],
  [
    'appendLine(res.error?.message ?? "发送失败", "error");',
    'appendLine(res.error?.message ?? tr("chat.sendFail"), "error");',
  ],
  [
    'showToast("已取消设置目标");',
    'showToast(tr("chat.goalCancelled"));',
  ],
  [
    'opts.okLabel ?? "确定"',
    'opts.okLabel ?? tr("dlg.ok")',
  ],
  [
    'opts.cancelLabel ?? "取消"',
    'opts.cancelLabel ?? tr("dlg.cancel")',
  ],
  [
    '? "已开启完全访问（与权限 chip 同步）"\n              : "已关闭完全访问，恢复默认确认"',
    '? tr("slash.fullOn")\n              : tr("slash.fullOff")',
  ],
  [
    'return { ok: true, message: "已退出计划模式" };',
    'return { ok: true, message: tr("slash.exitPlan") };',
  ],
  [
    'return { ok: true, message: `权限 → ${permLabel()}` };',
    'return { ok: true, message: tr("slash.permTo", { label: permLabel() }) };',
  ],
  [
    'return { ok: false, message: "未知命令" };',
    'return { ok: false, message: tr("slash.unknown") };',
  ],
  [
    'title: "重命名会话",\n    hint: "侧栏与导出将使用此标题",',
    'title: tr("slash.renameTitle"),\n    hint: tr("slash.renameHint"),',
  ],
  [
    'placeholder: "会话标题",',
    'placeholder: tr("slash.renamePh"),',
  ],
  [
    'showToast("标题不能为空", "error");',
    'showToast(tr("slash.renameEmpty"), "error");',
  ],
  [
    'showToast(res.error?.message ?? "重命名失败", "error");',
    'showToast(res.error?.message ?? tr("slash.renameFail"), "error");',
  ],
  [
    'if (!tid) return { ok: false, message: "请先打开一个会话" };',
    'if (!tid) return { ok: false, message: tr("slash.needSession") };',
  ],
  [
    'if (!res.ok) return { ok: false, message: res.error?.message ?? "导出失败" };\n  if (res.data?.canceled) return { ok: true, message: "已取消导出" };',
    'if (!res.ok) return { ok: false, message: res.error?.message ?? tr("slash.exportFail") };\n  if (res.data?.canceled) return { ok: true, message: tr("slash.exportCancel") };',
  ],
  [
    'if (turnActive) return { ok: false, message: "请等待当前回合结束" };',
    'if (turnActive) return { ok: false, message: tr("slash.waitTurn") };',
  ],
  [
    'title: "压缩上下文",',
    'title: tr("slash.compactTitle"),',
  ],
  [
    'okLabel: "发送",',
    'okLabel: tr("slash.compactOk"),',
  ],
  [
    'if (!ok) return { ok: true, message: "已取消" };',
    'if (!ok) return { ok: true, message: tr("slash.cancelled") };',
  ],
]);

console.log("done");
