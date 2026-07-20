/**
 * QA E2E — full user journey for Grok Desktop + CPA
 * Role: professional software test engineer
 *
 *   node scripts/qa-e2e-full.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { DesktopHost } = await import(
  pathToFileURL(path.join(root, "dist", "host", "host.js")).href
);

const AGENT =
  process.env.GROK_DESKTOP_AGENT?.trim() ||
  "/Applications/Grok Desktop.app/Contents/Resources/agent/grok";

const results = [];
const now = () => new Date().toISOString();

function record(suite, caseId, title, status, detail = "", evidence = {}) {
  results.push({ suite, caseId, title, status, detail: String(detail).slice(0, 500), evidence, at: now() });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : status === "BLOCKED" ? "■" : "○";
  console.log(`${icon} [${suite}] ${caseId} ${title}${detail ? " — " + String(detail).slice(0, 160) : ""}`);
}

async function waitFor(pred, ms = 90_000, step = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await pred()) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return false;
}

console.log("══════════════════════════════════════════════════");
console.log(" QA E2E FULL FLOW — Grok Desktop + CPA");
console.log(" Role: Software Test Engineer");
console.log(" Time:", now());
console.log("══════════════════════════════════════════════════\n");

// ───────── TC-ENV: Environment ─────────
console.log("── Suite ENV: Environment preconditions ──");
const appExists = fs.existsSync("/Applications/Grok Desktop.app");
record("ENV", "ENV-01", "Application installed", appExists ? "PASS" : "FAIL", "/Applications/Grok Desktop.app");
const agentOk = fs.existsSync(AGENT);
record("ENV", "ENV-02", "Bundled agent binary exists", agentOk ? "PASS" : "FAIL", AGENT);
let agentVer = "";
if (agentOk) {
  const r = spawnSync(AGENT, ["--version"], { encoding: "utf8", timeout: 15000 });
  agentVer = `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n")[0];
  record("ENV", "ENV-03", "Agent --version", agentVer ? "PASS" : "FAIL", agentVer);
}
const authPath = path.join(os.homedir(), ".grok-desktop", "auth.json");
const cfgPath = path.join(os.homedir(), ".grok-desktop", "config.toml");
const settingsPath = path.join(os.homedir(), ".grok-desktop", "desktop", "settings.json");
record("ENV", "ENV-04", "Desktop auth.json present", fs.existsSync(authPath) ? "PASS" : "FAIL", authPath);
record("ENV", "ENV-05", "Desktop config.toml present", fs.existsSync(cfgPath) ? "PASS" : "FAIL", cfgPath);

let cfgText = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, "utf8") : "";
const hasCpa = /\[model\.cpa-/.test(cfgText);
const defaultLine = cfgText.match(/^\s*default\s*=\s*"([^"]+)"/m)?.[1] || "";
record("ENV", "ENV-06", "CPA model tables in config", hasCpa ? "PASS" : "FAIL", `default=${defaultLine}`);
const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
  : {};
record(
  "ENV",
  "ENV-07",
  "settings.defaultModel is CPA",
  String(settings.defaultModel || "").startsWith("cpa-") ? "PASS" : "FAIL",
  JSON.stringify(settings),
);

// ───────── TC-HOST: Host boot ─────────
console.log("\n── Suite HOST: Host initialization ──");
const host = new DesktopHost({ grokPath: agentOk ? AGENT : undefined });
const info = host.grokInfo();
record("HOST", "HOST-01", "grokInfo resolves agent", info?.path ? "PASS" : "FAIL", `${info?.source} ${info?.version}`);
const auth = host.authStatus();
record("HOST", "HOST-02", "authStatus authenticated", auth?.authenticated ? "PASS" : "FAIL", auth?.label || JSON.stringify(auth));
const cfg = host.configGet();
record(
  "HOST",
  "HOST-03",
  "configGet.defaultModel is CPA",
  String(cfg?.defaultModel || "").startsWith("cpa-") ? "PASS" : "FAIL",
  String(cfg?.defaultModel),
);
const providers = host.providersList();
const cpaProviders = (providers.providers || []).filter((p) => p.id.startsWith("cpa-"));
record(
  "HOST",
  "HOST-04",
  "providers.list includes CPA with keys",
  cpaProviders.length >= 1 && cpaProviders.every((p) => p.hasApiKey) ? "PASS" : "FAIL",
  `count=${cpaProviders.length} default=${providers.defaultModel}`,
);
const models = host.modelsList({ force: true });
const defModel = models.find((m) => m.isDefault);
record(
  "HOST",
  "HOST-05",
  "models.list default is CPA (not official grok-4.5)",
  defModel?.id?.startsWith("cpa-") ? "PASS" : "FAIL",
  `default=${defModel?.id} list=${models.map((m) => m.id).join(",")}`,
);

// ───────── TC-PROJ: Projects ─────────
console.log("\n── Suite PROJ: Project lifecycle ──");
const probeCwd = fs.mkdtempSync(path.join(os.tmpdir(), "qa-e2e-"));
fs.writeFileSync(path.join(probeCwd, "README.md"), "# QA E2E probe\n\nhello\n");
fs.writeFileSync(path.join(probeCwd, "sample.ts"), "export const n = 1;\n");

const project = host.projectsAdd({ path: probeCwd, title: "QA-E2E-Project", trust: true });
record("PROJ", "PROJ-01", "projects.add trusted", project?.id ? "PASS" : "FAIL", project?.id);
const list = host.projectsList();
record("PROJ", "PROJ-02", "projects.list contains new", list.some((p) => p.id === project.id) ? "PASS" : "FAIL");
host.projectsUpdate(project.id, { title: "QA-E2E-Renamed" });
const updated = host.projectsList().find((p) => p.id === project.id);
record("PROJ", "PROJ-03", "projects.update title", updated?.title === "QA-E2E-Renamed" ? "PASS" : "FAIL", updated?.title);

// ───────── TC-FILE: Files ─────────
console.log("\n── Suite FILE: File APIs ──");
try {
  const listed = host.filesList({ cwd: probeCwd });
  record("FILE", "FILE-01", "files.list", listed?.entries?.length >= 1 ? "PASS" : "FAIL", JSON.stringify(listed?.entries?.map((e) => e.name)));
} catch (e) {
  record("FILE", "FILE-01", "files.list", "FAIL", e.message);
}
try {
  const hit = host.filesSearch({ cwd: probeCwd, query: "sample" });
  record("FILE", "FILE-02", "files.search sample.ts", hit?.hits?.length >= 1 ? "PASS" : "FAIL");
} catch (e) {
  record("FILE", "FILE-02", "files.search", "FAIL", e.message);
}
try {
  const read = host.filesRead({ path: "README.md", cwd: probeCwd });
  record("FILE", "FILE-03", "files.read README", /QA E2E|hello/.test(read?.content || "") ? "PASS" : "FAIL");
} catch (e) {
  record("FILE", "FILE-03", "files.read", "FAIL", e.message);
}

// ───────── TC-CHAT: Critical path conversation with CPA ─────────
console.log("\n── Suite CHAT: Conversation with CPA (critical) ──");
const events = [];
const unsub = host.subscribe((ev) => events.push(ev));

// Case: create without explicit model — must use CPA default + set_model
let created = null;
try {
  created = await host.threadsCreate({
    cwd: probeCwd,
    projectId: project.id,
    prompt: "Reply with exactly one word: pong",
    title: "QA-default-cpa",
    alwaysApprove: true,
    // NO model param — tests Host default + set_model fix
  });
  record("CHAT", "CHAT-01", "threads.create without model (use default CPA)", "PASS", JSON.stringify(created));
} catch (e) {
  record("CHAT", "CHAT-01", "threads.create without model", "FAIL", e.message, { data: e.data });
}

if (created) {
  const gotPong = await waitFor(
    () => JSON.stringify(events).toLowerCase().includes("pong") || events.some((e) => e.type === "turn.completed"),
    120_000,
  );
  const blob = JSON.stringify(events).toLowerCase();
  record(
    "CHAT",
    "CHAT-02",
    "Agent replies pong (default path)",
    gotPong && blob.includes("pong") ? "PASS" : "FAIL",
    `events=${events.length} pong=${blob.includes("pong")}`,
    { types: [...new Set(events.map((e) => e.type))] },
  );

  // Must NOT have used exhausted official balance only — if failed would not pong
  const logs = fs.readdirSync(path.join(os.homedir(), ".grok-desktop", "desktop", "logs"))
    .filter((f) => f.endsWith(".log"))
    .map((f) => path.join(os.homedir(), ".grok-desktop", "desktop", "logs", f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const latestLog = logs[0] ? fs.readFileSync(logs[0], "utf8") : "";
  const setModelOk = /setModel|set_model|create_set_model/i.test(latestLog);
  const hit402 = /402 Payment Required|usage balance exhausted/i.test(latestLog);
  record(
    "CHAT",
    "CHAT-03",
    "No fatal 402 on successful turn (or set_model attempted)",
    blob.includes("pong") && !(/session\.status","status":"failed"/.test(JSON.stringify(events)) && !blob.includes("pong"))
      ? "PASS"
      : hit402 && !blob.includes("pong")
        ? "FAIL"
        : "PASS",
    `setModelLog=${setModelOk} hit402=${hit402}`,
  );

  // second turn
  try {
    await host.turnsPrompt(created.threadId, "Reply with exactly: ok");
    const t2 = await waitFor(() => events.filter((e) => e.type === "turn.completed").length >= 2, 90_000);
    record("CHAT", "CHAT-04", "Second turn turns.prompt", t2 ? "PASS" : "FAIL", `completedTurns=${events.filter((e) => e.type === "turn.completed").length}`);
  } catch (e) {
    record("CHAT", "CHAT-04", "Second turn turns.prompt", "FAIL", e.message);
  }

  // session ops
  try {
    const hist = host.historyLoad(created.sessionId);
    record("CHAT", "CHAT-05", "history.load has user+assistant", hist?.entries?.length >= 1 ? "PASS" : "FAIL", `entries=${hist?.entries?.length}`);
  } catch (e) {
    record("CHAT", "CHAT-05", "history.load", "FAIL", e.message);
  }
  try {
    const exp = host.threadsExportMarkdown(created.threadId);
    record("CHAT", "CHAT-06", "export markdown", exp?.markdown?.length > 20 ? "PASS" : "FAIL");
  } catch (e) {
    record("CHAT", "CHAT-06", "export markdown", "FAIL", e.message);
  }
  try {
    host.threadsRename(created.threadId, "QA-renamed");
    record("CHAT", "CHAT-07", "threads.rename", "PASS");
  } catch (e) {
    record("CHAT", "CHAT-07", "threads.rename", "FAIL", e.message);
  }
  try {
    host.threadsPin(created.threadId, true);
    record("CHAT", "CHAT-08", "threads.pin", "PASS");
  } catch (e) {
    record("CHAT", "CHAT-08", "threads.pin", "FAIL", e.message);
  }
}

// Explicit CPA models matrix
console.log("\n── Suite MODEL: Explicit CPA model IDs ──");
for (const mid of ["cpa-grok-3-mini-fast", "cpa-grok-4-5", "cpa-grok-composer-fast"]) {
  const ev = [];
  const u = host.subscribe((e) => ev.push(e));
  try {
    const c = await host.threadsCreate({
      cwd: probeCwd,
      projectId: project.id,
      prompt: "Reply with exactly one word: pong",
      title: `QA-${mid}`,
      alwaysApprove: true,
      model: mid,
    });
    const ok = await waitFor(
      () => JSON.stringify(ev).toLowerCase().includes("pong") || ev.some((e) => e.type === "turn.completed"),
      90_000,
    );
    const pong = JSON.stringify(ev).toLowerCase().includes("pong");
    record(
      "MODEL",
      `MODEL-${mid}`,
      `Chat with ${mid}`,
      ok && pong ? "PASS" : "FAIL",
      `events=${ev.length} pong=${pong}`,
    );
    try {
      await host.threadsDelete(c.threadId);
    } catch {
      /* ignore */
    }
  } catch (e) {
    record("MODEL", `MODEL-${mid}`, `Chat with ${mid}`, "FAIL", e.message);
  }
  u?.();
}

// ───────── TC-SESS: Session lifecycle extras ─────────
console.log("\n── Suite SESS: Session lifecycle ──");
if (created) {
  try {
    await host.threadsStop(created.threadId);
    record("SESS", "SESS-01", "threads.stop", "PASS");
  } catch (e) {
    record("SESS", "SESS-01", "threads.stop", "FAIL", e.message);
  }
  try {
    await host.threadsDetach(created.threadId);
    record("SESS", "SESS-02", "threads.detach", "PASS");
  } catch (e) {
    record("SESS", "SESS-02", "threads.detach", "FAIL", e.message);
  }
  try {
    await host.threadsAttach(created.sessionId, probeCwd);
    record("SESS", "SESS-03", "threads.attach", "PASS");
  } catch (e) {
    record("SESS", "SESS-03", "threads.attach", "FAIL", e.message);
  }
  try {
    await host.threadsArchive(created.threadId, true);
    record("SESS", "SESS-04", "threads.archive", "PASS");
  } catch (e) {
    record("SESS", "SESS-04", "threads.archive", "FAIL", e.message);
  }
  try {
    await host.threadsDelete(created.threadId);
    record("SESS", "SESS-05", "threads.delete", "PASS");
  } catch (e) {
    record("SESS", "SESS-05", "threads.delete", "FAIL", e.message);
  }
}

// ───────── TC-EXT: Extensibility smoke ─────────
console.log("\n── Suite EXT: Extensibility ──");
try {
  const skills = host.skillsList(probeCwd);
  record("EXT", "EXT-01", "skills.list", Array.isArray(skills) ? "PASS" : "FAIL", `n=${skills?.length}`);
} catch (e) {
  record("EXT", "EXT-01", "skills.list", "FAIL", e.message);
}
try {
  const plugins = host.pluginsList();
  record("EXT", "EXT-02", "plugins.list", Array.isArray(plugins) ? "PASS" : "FAIL", `n=${plugins?.length}`);
} catch (e) {
  record("EXT", "EXT-02", "plugins.list", "FAIL", e.message);
}
try {
  const mem = host.memoryStatus();
  record("EXT", "EXT-03", "memory.status", mem ? "PASS" : "FAIL", JSON.stringify(mem).slice(0, 120));
} catch (e) {
  record("EXT", "EXT-03", "memory.status", "FAIL", e.message);
}

// cleanup
try {
  host.projectsRemove(project.id);
  record("PROJ", "PROJ-04", "projects.remove cleanup", "PASS");
} catch (e) {
  record("PROJ", "PROJ-04", "projects.remove cleanup", "FAIL", e.message);
}
unsub?.();
try {
  await host.dispose();
} catch {
  /* ignore */
}
try {
  fs.rmSync(probeCwd, { recursive: true, force: true });
} catch {
  /* ignore */
}

// ───────── Report ─────────
const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIP: 0 };
for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
const criticalFails = results.filter(
  (r) =>
    r.status === "FAIL" &&
    (r.suite === "CHAT" || r.suite === "HOST" || r.caseId?.startsWith("MODEL-cpa-grok-3")),
);

console.log("\n══════════════════════════════════════════════════");
console.log(" SUMMARY");
console.log("══════════════════════════════════════════════════");
console.log(`PASS=${counts.PASS}  FAIL=${counts.FAIL}  TOTAL=${results.length}`);
console.log(`Critical fails: ${criticalFails.length}`);
if (results.some((r) => r.status === "FAIL")) {
  console.log("\nFailures:");
  for (const f of results.filter((r) => r.status === "FAIL")) {
    console.log(`  - [${f.suite}] ${f.caseId} ${f.title}: ${f.detail}`);
  }
}

const verdict =
  criticalFails.length === 0 && counts.FAIL === 0
    ? "PASS — release candidate usable with CPA"
    : criticalFails.length === 0
      ? "CONDITIONAL PASS — core CPA chat works; non-critical failures remain"
      : "FAIL — core path broken";

console.log("\nVERDICT:", verdict);

const outPath = path.join(root, "release", "QA-E2E-REPORT.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      at: now(),
      agent: agentVer,
      counts,
      verdict,
      criticalFails: criticalFails.map((f) => f.caseId),
      results,
    },
    null,
    2,
  ),
);
console.log("Report:", outPath);
process.exit(criticalFails.length ? 1 : 0);
