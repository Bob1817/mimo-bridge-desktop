if (!window.mimoBridge) {
  document.addEventListener("DOMContentLoaded", () => {
    const pill = document.getElementById("runningPill");
    const result = document.getElementById("testResult");
    if (pill) {
      pill.classList.add("stopped");
      pill.querySelector("span:last-child").textContent = "预加载失败";
    }
    if (result) result.textContent = "Electron preload 加载失败，请确认使用 v2 版本。";
  });
  throw new Error("window.mimoBridge is not available");
}

const $ = (id) => document.getElementById(id);
let config = {};
let logs = [];

const tabInfo = {
  dashboard: ["状态面板", "在 Claude Code 和 Codex 两种配置中切换使用。"],
  config: ["统一配置", "同时配置 Claude Code / Anthropic 兼容代理与 Codex / OpenAI 兼容代理。"],
  claude: ["Claude Code", "写入或复制 ~/.claude/settings.json 配置。"],
  codex: ["Codex", "写入或复制 ~/.codex/config.toml 和环境变量。"],
  logs: ["运行日志", "查看中转服务运行状态和请求日志。"]
};

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function claudeBaseUrl() { return `http://localhost:${config.port || 8787}/anthropic`; }
function codexBaseUrl() { return `http://localhost:${config.port || 8787}/codex/v1`; }
function currentClient() { return config.activeClient || "claude"; }
function currentBaseUrl() { return currentClient() === "codex" ? codexBaseUrl() : claudeBaseUrl(); }

function renderFlow() {
  const box = $("flowBox");
  if (!box) return;

  if (currentClient() === "codex") {
    box.innerHTML = `
      <div class="flow-node"><span>Codex 读取</span><b>~/.codex/config.toml</b></div>
      <div class="arrow">↓</div>
      <div class="flow-node hot"><span>本地代理</span><b>${codexBaseUrl()}</b></div>
      <div class="arrow">↓</div>
      <div class="flow-node"><span>上游 OpenAI 兼容接口</span><b>${config.codexModel || "gpt-5-codex"}</b></div>
    `;
  } else {
    box.innerHTML = `
      <div class="flow-node"><span>Claude Code 选择</span><b>${config.claudeModel || "claude-sonnet-4-20250514"}</b></div>
      <div class="arrow">↓</div>
      <div class="flow-node hot"><span>本地代理映射</span><b>${claudeBaseUrl()}</b></div>
      <div class="arrow">↓</div>
      <div class="flow-node"><span>上游真实模型</span><b>${config.upstreamModel || "mimo-v2.5-pro"}</b></div>
    `;
  }
}

function renderConfig() {
  $("port").value = config.port || 8787;
  $("activeClient").value = currentClient();

  $("upstreamBaseUrl").value = config.upstreamBaseUrl || "";
  $("upstreamApiKey").value = config.upstreamApiKey || "";
  $("upstreamModel").value = config.upstreamModel || "mimo-v2.5-pro";
  $("claudeModel").value = config.claudeModel || "claude-sonnet-4-20250514";
  $("compatClean").value = String(Boolean(config.compatClean));

  $("codexBaseUrl").value = config.codexBaseUrl || "https://api.openai.com/v1";
  $("codexApiKey").value = config.codexApiKey || "";
  $("codexModel").value = config.codexModel || "gpt-5-codex";
  $("codexProviderId").value = config.codexProviderId || "mimo_proxy";
  $("codexEnvKey").value = config.codexEnvKey || "MIMO_BRIDGE_CODEX_API_KEY";
  $("codexWireApi").value = config.codexWireApi || "responses";
  $("codexUseLocalProxy").value = String(config.codexUseLocalProxy !== false);

  $("sideMode").textContent = currentClient() === "codex" ? "Codex" : "Claude Code";
  $("sideBaseUrl").textContent = `http://localhost:${config.port || 8787}`;
  $("quickBaseUrl").textContent = currentBaseUrl();

  $("clientClaude").classList.toggle("active", currentClient() === "claude");
  $("clientCodex").classList.toggle("active", currentClient() === "codex");

  renderFlow();
}

async function renderSnippets() {
  $("claudeSnippet").textContent = await window.mimoBridge.getClaudeSnippet();
  const codex = await window.mimoBridge.getCodexSnippet();
  $("codexSnippet").textContent = codex.configToml || "";
  $("codexEnvSnippet").textContent = codex.shellEnv || "";
}

async function refreshStatus() {
  const status = await window.mimoBridge.getStatus();
  const pill = $("runningPill");
  const title = $("statusTitle");
  const desc = $("statusDesc");

  pill.classList.remove("running", "stopped");
  if (status.running) {
    pill.classList.add("running");
    pill.querySelector("span:last-child").textContent = `运行中：${status.port}`;
    title.textContent = "中转服务运行中";
    desc.textContent = currentClient() === "codex"
      ? `Codex Base URL：${codexBaseUrl()}`
      : `Claude Code Base URL：${claudeBaseUrl()}`;
  } else {
    pill.classList.add("stopped");
    pill.querySelector("span:last-child").textContent = "未运行";
    title.textContent = "中转服务未运行";
    desc.textContent = "点击启动中转后再使用 Claude Code 或 Codex。";
  }

  logs = status.logs || logs;
  $("logsBox").textContent = logs.length ? logs.join("\n") : "暂无日志。";
}

async function load() {
  config = await window.mimoBridge.getConfig();
  renderConfig();
  await renderSnippets();
  await refreshStatus();
}

async function saveConfig(extra = {}) {
  const payload = {
    port: Number($("port").value || 8787),
    activeClient: $("activeClient").value,

    upstreamBaseUrl: $("upstreamBaseUrl").value.trim(),
    upstreamApiKey: $("upstreamApiKey").value.trim(),
    upstreamModel: $("upstreamModel").value.trim(),
    claudeModel: $("claudeModel").value.trim(),
    compatClean: $("compatClean").value === "true",

    codexBaseUrl: $("codexBaseUrl").value.trim(),
    codexApiKey: $("codexApiKey").value.trim(),
    codexModel: $("codexModel").value.trim(),
    codexProviderId: $("codexProviderId").value.trim(),
    codexProviderName: "MIMO Bridge Proxy",
    codexEnvKey: $("codexEnvKey").value.trim(),
    codexWireApi: $("codexWireApi").value,
    codexUseLocalProxy: $("codexUseLocalProxy").value === "true",
    ...extra
  };

  config = await window.mimoBridge.saveConfig(payload);
  renderConfig();
  await renderSnippets();
  toast("配置已保存");
}

async function setActiveClient(name) {
  config.activeClient = name;
  config = await window.mimoBridge.saveConfig({ activeClient: name });
  $("activeClient").value = name;
  renderConfig();
  await renderSnippets();
  await refreshStatus();
  toast(name === "codex" ? "已切换到 Codex 模式" : "已切换到 Claude Code 模式");
}

async function startBridge() {
  const r = await window.mimoBridge.startBridge();
  await refreshStatus();
  toast(r.ok ? "中转服务已启动" : `启动失败：${r.message}`);
}

async function stopBridge() {
  const r = await window.mimoBridge.stopBridge();
  await refreshStatus();
  toast(r.ok ? "中转服务已停止" : `停止失败：${r.message}`);
}

async function testClaude(target = $("claudeTestResult")) {
  target.textContent = "正在测试 Claude/MIMO 上游...";
  const r = await window.mimoBridge.testClaude();
  target.textContent = JSON.stringify(r, null, 2);
  toast(r.ok ? "Claude/MIMO 上游测试成功" : "Claude/MIMO 上游测试失败");
}

async function testCodex(target = $("codexTestResult")) {
  target.textContent = "正在测试 Codex 上游...";
  const r = await window.mimoBridge.testCodex();
  target.textContent = JSON.stringify(r, null, 2);
  toast(r.ok ? "Codex 上游测试成功" : "Codex 上游测试失败");
}

async function writeClaude() {
  const r = await window.mimoBridge.writeClaudeSettings();
  toast(r.ok ? `已写入：${r.settingsPath}` : `写入失败：${r.message}`);
}

async function writeCodex() {
  const r = await window.mimoBridge.writeCodexConfig();
  toast(r.ok ? `已写入：${r.configPath}` : `写入失败：${r.message}`);
}

async function writeCodexEnv() {
  const r = await window.mimoBridge.writeCodexEnv();
  toast(r.ok ? `环境变量已写入：${r.profilePath}` : `写入失败：${r.message}`);
}

async function copyClaude() {
  await window.mimoBridge.copy(await window.mimoBridge.getClaudeSnippet());
  toast("Claude 配置已复制");
}

async function copyCodex() {
  const c = await window.mimoBridge.getCodexSnippet();
  await window.mimoBridge.copy(c.configToml);
  toast("Codex config.toml 已复制");
}

async function writeCurrent() {
  currentClient() === "codex" ? await writeCodex() : await writeClaude();
}

async function copyCurrent() {
  currentClient() === "codex" ? await copyCodex() : await copyClaude();
}

async function testCurrent() {
  currentClient() === "codex" ? await testCodex($("testResult")) : await testClaude($("testResult"));
}

function switchTab(name) {
  document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.id === `tab-${name}`));
  $("pageTitle").textContent = tabInfo[name][0];
  $("pageDesc").textContent = tabInfo[name][1];
}

function bind() {
  document.querySelectorAll(".nav-item").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  $("saveBtn").addEventListener("click", () => saveConfig());
  $("startBtn").addEventListener("click", startBridge);
  $("stopBtn").addEventListener("click", stopBridge);
  $("testCurrentBtn").addEventListener("click", testCurrent);
  $("clientClaude").addEventListener("click", () => setActiveClient("claude"));
  $("clientCodex").addEventListener("click", () => setActiveClient("codex"));
  $("quickWriteCurrent").addEventListener("click", writeCurrent);
  $("quickCopyCurrent").addEventListener("click", copyCurrent);
  $("quickCopyBase").addEventListener("click", async () => { await window.mimoBridge.copy(currentBaseUrl()); toast("Base URL 已复制"); });

  $("writeClaudeBtn").addEventListener("click", writeClaude);
  $("copyClaudeBtn").addEventListener("click", copyClaude);
  $("testClaudeBtn").addEventListener("click", () => testClaude());

  $("writeCodexBtn").addEventListener("click", writeCodex);
  $("writeCodexEnvBtn").addEventListener("click", writeCodexEnv);
  $("copyCodexBtn").addEventListener("click", copyCodex);
  $("testCodexBtn").addEventListener("click", () => testCodex());

  $("refreshLogsBtn").addEventListener("click", refreshStatus);

  $("updateActionBtn").addEventListener("click", handleUpdateAction);

  window.mimoBridge.onLogs((items) => {
    logs = items || [];
    $("logsBox").textContent = logs.length ? logs.join("\n") : "暂无日志。";
  });

  window.mimoBridge.onUpdateStatus((data) => renderUpdateStatus(data));

  setInterval(refreshStatus, 2500);
}

// ─── Update UI ──────────────────────────────────────────────────────────────

let currentUpdateData = null;

function renderUpdateStatus(data) {
  currentUpdateData = data;
  const banner = $("updateBanner");
  const bannerText = $("updateBannerText");
  const actionBtn = $("updateActionBtn");

  if (!banner) return;

  switch (data.status) {
    case "checking":
      banner.style.display = "flex";
      banner.className = "update-banner";
      bannerText.textContent = "检查更新中...";
      actionBtn.style.display = "none";
      break;
    case "available":
      banner.style.display = "flex";
      banner.className = "update-banner update-available";
      bannerText.textContent = `新版本 v${data.info?.version || "?"} 可用`;
      actionBtn.style.display = "";
      actionBtn.textContent = "下载更新";
      actionBtn.disabled = false;
      break;
    case "downloading":
      banner.style.display = "flex";
      banner.className = "update-banner update-downloading";
      const pct = data.percent != null ? ` (${data.percent}%)` : "";
      bannerText.textContent = `正在下载更新${pct}`;
      actionBtn.style.display = "none";
      break;
    case "downloaded":
      banner.style.display = "flex";
      banner.className = "update-banner update-downloaded";
      bannerText.textContent = "更新已就绪";
      actionBtn.style.display = "";
      actionBtn.textContent = "重启安装";
      actionBtn.disabled = false;
      break;
    case "not-available":
      banner.style.display = "none";
      break;
    case "error":
      banner.style.display = "flex";
      banner.className = "update-banner update-error";
      bannerText.textContent = "更新检查失败";
      actionBtn.style.display = "";
      actionBtn.textContent = "重试";
      actionBtn.disabled = false;
      break;
    default:
      banner.style.display = "none";
  }
}

async function handleUpdateAction() {
  if (!currentUpdateData) return;

  if (currentUpdateData.status === "available") {
    const btn = $("updateActionBtn");
    btn.disabled = true;
    btn.textContent = "准备下载...";
    await window.mimoBridge.downloadUpdate();
  } else if (currentUpdateData.status === "downloaded") {
    window.mimoBridge.installUpdate();
  } else if (currentUpdateData.status === "error") {
    await window.mimoBridge.checkUpdate();
  }
}

bind();
load();

// Display version on load
window.mimoBridge.getAppVersion().then((v) => {
  $("sideVersion").textContent = `v${v}`;
});
