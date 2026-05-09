import { app, BrowserWindow, ipcMain, clipboard, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { autoUpdater } from "electron-updater";
import { createBridgeApp } from "./bridge-server-factory.js";
import {
  loadConfig,
  saveConfig,
  publicConfig,
  claudeSettingsSnippet,
  writeClaudeSettings,
  codexConfigSnippet,
  codexShellEnvSnippet,
  writeCodexConfig,
  writeCodexEnvToShell,
  joinApiUrl,
  claudeHeaders,
  openaiHeaders
} from "./bridge-core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let server = null;
let serverPort = null;
let logs = [];
let updateStatus = "idle";
let updateInfo = null;

function pushLog(line) {
  const text = `[${new Date().toLocaleTimeString()}] ${line}`;
  logs.unshift(text);
  logs = logs.slice(0, 100);

  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.webContents &&
    !mainWindow.webContents.isDestroyed()
  ) {
    mainWindow.webContents.send("logs", logs);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    title: "MIMO Bridge",
    backgroundColor: "#f7f3ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

async function startBridge() {
  if (server) return { ok: true, running: true, port: serverPort, message: "中转服务已运行" };

  const cfg = loadConfig();
  const bridgeApp = createBridgeApp({ logger: pushLog });

  return await new Promise((resolve) => {
    const s = bridgeApp.listen(cfg.port, () => {
      server = s;
      serverPort = cfg.port;
      pushLog(`中转服务已启动：http://localhost:${cfg.port}`);
      resolve({ ok: true, running: true, port: cfg.port });
    });

    s.on("error", (err) => {
      pushLog(`启动失败：${err.message}`);
      resolve({ ok: false, running: false, message: err.message });
    });
  });
}

async function stopBridge() {
  if (!server) return { ok: true, running: false };
  return await new Promise((resolve) => {
    server.close(() => {
      server = null;
      serverPort = null;
      pushLog("中转服务已停止");
      resolve({ ok: true, running: false });
    });
  });
}

async function testClaude() {
  const cfg = loadConfig();
  if (!cfg.upstreamApiKey) return { ok: false, message: "请先填写 Claude/MIMO API Key" };
  const url = joinApiUrl(cfg.upstreamBaseUrl, "/v1/messages");

  try {
    pushLog(`测试 Claude/MIMO 上游：${url}`);
    const resp = await fetch(url, {
      method: "POST",
      headers: claudeHeaders(cfg),
      body: JSON.stringify({ model: cfg.upstreamModel, max_tokens: 64, messages: [{ role: "user", content: "hello" }] })
    });
    const text = await resp.text();
    pushLog(`Claude/MIMO 上游测试状态：${resp.status}`);
    return { ok: resp.ok, status: resp.status, upstream: url, responsePreview: text.slice(0, 1200) };
  } catch (err) {
    pushLog(`Claude/MIMO 上游测试失败：${err?.message || String(err)}`);
    return { ok: false, message: err?.message || String(err) };
  }
}

async function testCodex() {
  const cfg = loadConfig();
  if (!cfg.codexApiKey) return { ok: false, message: "请先填写 Codex API Key" };
  const url = joinApiUrl(cfg.codexBaseUrl, "/v1/responses");

  try {
    pushLog(`测试 Codex 上游：${url}`);
    const resp = await fetch(url, {
      method: "POST",
      headers: openaiHeaders(cfg.codexApiKey),
      body: JSON.stringify({ model: cfg.codexModel, input: "hello" })
    });
    const text = await resp.text();
    pushLog(`Codex 上游测试状态：${resp.status}`);
    return { ok: resp.ok, status: resp.status, upstream: url, responsePreview: text.slice(0, 1200) };
  } catch (err) {
    pushLog(`Codex 上游测试失败：${err?.message || String(err)}`);
    return { ok: false, message: err?.message || String(err) };
  }
}

ipcMain.handle("config:get", () => publicConfig());
ipcMain.handle("config:save", (event, payload) => publicConfig(saveConfig(payload || {})));
ipcMain.handle("bridge:start", () => startBridge());
ipcMain.handle("bridge:stop", () => stopBridge());
ipcMain.handle("bridge:status", () => ({ running: Boolean(server), port: serverPort, logs }));

ipcMain.handle("claude:snippet", () => claudeSettingsSnippet(loadConfig()));
ipcMain.handle("claude:write", () => writeClaudeSettings(loadConfig()));
ipcMain.handle("claude:test", () => testClaude());

ipcMain.handle("codex:snippet", () => ({ configToml: codexConfigSnippet(loadConfig()), shellEnv: codexShellEnvSnippet(loadConfig()) }));
ipcMain.handle("codex:writeConfig", () => writeCodexConfig(loadConfig()));
ipcMain.handle("codex:writeEnv", () => writeCodexEnvToShell(loadConfig()));
ipcMain.handle("codex:test", () => testCodex());

ipcMain.handle("clipboard:write", (event, text) => {
  clipboard.writeText(String(text || ""));
  return { ok: true };
});
ipcMain.handle("open:external", (event, url) => {
  shell.openExternal(url);
  return { ok: true };
});

// ─── Auto Updater ───────────────────────────────────────────────────────────

function notifyUpdateStatus(extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send("update:status", {
      status: updateStatus,
      info: updateInfo,
      currentVersion: app.getVersion(),
      ...extra
    });
  }
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on("checking-for-update", () => {
  updateStatus = "checking";
  notifyUpdateStatus();
  pushLog("正在检查更新...");
});

autoUpdater.on("update-available", (info) => {
  updateStatus = "available";
  updateInfo = { version: info.version, releaseDate: info.releaseDate };
  notifyUpdateStatus();
  pushLog(`发现新版本 v${info.version}`);
});

autoUpdater.on("update-not-available", () => {
  updateStatus = "not-available";
  notifyUpdateStatus();
  pushLog("当前已是最新版本");
});

autoUpdater.on("download-progress", (progress) => {
  updateStatus = "downloading";
  notifyUpdateStatus({ percent: Math.round(progress.percent), speed: progress.bytesPerSecond });
});

autoUpdater.on("update-downloaded", (info) => {
  updateStatus = "downloaded";
  updateInfo = { version: info.version };
  notifyUpdateStatus();
  pushLog(`更新下载完成，准备重启安装 v${info.version}`);
});

autoUpdater.on("error", (err) => {
  updateStatus = "error";
  notifyUpdateStatus({ message: err.message });
  pushLog(`更新检查失败: ${err.message}`);
});

ipcMain.handle("app:version", () => app.getVersion());

ipcMain.handle("update:check", async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch {
    // Fallback for dev mode: check via GitHub API
    try {
      const resp = await fetch("https://api.github.com/repos/Bob1817/mimo-bridge-desktop/releases/latest");
      if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
      const release = await resp.json();
      const latestVersion = (release.tag_name || "").replace(/^v/, "");
      const currentVersion = app.getVersion();
      if (latestVersion && latestVersion !== currentVersion) {
        updateStatus = "available";
        updateInfo = { version: latestVersion, releaseUrl: release.html_url };
      } else {
        updateStatus = "not-available";
      }
      notifyUpdateStatus();
      return { ok: true, available: updateStatus === "available" };
    } catch (err2) {
      updateStatus = "error";
      notifyUpdateStatus({ message: err2.message });
      return { ok: false, message: err2.message };
    }
  }
});

ipcMain.handle("update:download", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

ipcMain.handle("update:install", () => {
  autoUpdater.quitAndInstall(false, true);
});

app.whenReady().then(() => {
  createWindow();
  startBridge();
  // Check for updates after a short delay
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
});

app.on("window-all-closed", async () => {
  mainWindow = null;
  await stopBridge();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
