import { app, BrowserWindow, ipcMain, clipboard, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { createGatewayApp } from "./gateway/server.js";
import { loadConfig, saveConfig, publicConfig } from "./gateway/config.js";
import { findAvailablePort } from "./gateway/port.js";
import { logger, type LogEntry } from "./gateway/logger.js";
import pkg from "electron-updater";
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let server: import("net").Server | null = null;
let serverPort: number | null = null;
let updateStatus = "idle";
let updateInfo: Record<string, unknown> | null = null;

process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err.message}`, { stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  logger.error(`Unhandled rejection: ${msg}`);
});

function pushLog(entry: LogEntry) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send("log:entry", entry);
  }
}

logger.subscribe(pushLog);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "MIMO Gateway",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.loadFile(path.join(__dirname, "renderer/index.html"));
}

async function startGateway() {
  if (server) return { ok: true, running: true, port: serverPort, message: "Gateway is running" };

  const cfg = loadConfig();
  const port = await findAvailablePort(cfg.port);
  const gatewayApp = createGatewayApp();

  return new Promise((resolve) => {
    const s = gatewayApp.listen(port, () => {
      server = s;
      serverPort = port;
      logger.info(`Gateway started: http://localhost:${port}`);
      resolve({ ok: true, running: true, port });
    });
    s.on("error", (err: Error) => {
      logger.error(`Failed to start gateway: ${err.message}`);
      resolve({ ok: false, running: false, message: err.message });
    });
  });
}

async function stopGateway() {
  if (!server) return { ok: true, running: false };
  return new Promise((resolve) => {
    server!.close(() => {
      server = null;
      serverPort = null;
      logger.info("Gateway stopped");
      resolve({ ok: true, running: false });
    });
  });
}

// --- IPC ---

ipcMain.handle("config:get", () => publicConfig());
ipcMain.handle("config:save", (_e, payload) => {
  try {
    logger.info("Config save requested");
    const saved = saveConfig(payload || {});
    logger.info("Config saved", { providers: saved.providers.length, mappings: saved.modelMappings.length });
    return publicConfig(saved);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Config save failed: ${msg}`);
    throw new Error(`Config save failed: ${msg}`);
  }
});
ipcMain.handle("gateway:start", () => startGateway());
ipcMain.handle("gateway:stop", () => stopGateway());
ipcMain.handle("gateway:status", () => ({ running: Boolean(server), port: serverPort }));
ipcMain.handle("gateway:port", () => serverPort);
ipcMain.handle("clipboard:write", (_e, text: string) => { clipboard.writeText(String(text || "")); return { ok: true }; });
ipcMain.handle("open:external", (_e, url: string) => { shell.openExternal(url); return { ok: true }; });
ipcMain.handle("open:logDir", () => { shell.openPath(logger.getLogDir()); return { ok: true }; });
ipcMain.handle("logs:get", (_e, count?: number) => logger.getRecentLogs(count));
ipcMain.handle("logs:files", () => logger.getLogFiles());

// --- Auto Updater ---

function notifyUpdateStatus(extra: Record<string, unknown> = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", { status: updateStatus, info: updateInfo, currentVersion: app.getVersion(), ...extra });
  }
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.on("checking-for-update", () => { updateStatus = "checking"; notifyUpdateStatus(); logger.info("Checking for updates..."); });
autoUpdater.on("update-available", (info: { version: string; releaseDate: string }) => { updateStatus = "available"; updateInfo = { version: info.version }; notifyUpdateStatus(); logger.info(`Update available: v${info.version}`); });
autoUpdater.on("update-not-available", () => { updateStatus = "not-available"; notifyUpdateStatus(); });
autoUpdater.on("download-progress", (p: { percent: number }) => { updateStatus = "downloading"; notifyUpdateStatus({ percent: Math.round(p.percent) }); });
autoUpdater.on("update-downloaded", (info: { version: string }) => { updateStatus = "downloaded"; updateInfo = { version: info.version }; notifyUpdateStatus(); logger.info(`Update downloaded: v${info.version}`); });
autoUpdater.on("error", (err: Error) => { updateStatus = "error"; notifyUpdateStatus({ message: err.message }); logger.error(`Update error: ${err.message}`); });

ipcMain.handle("app:version", () => app.getVersion());

async function checkUpdateViaGitHub() {
  const resp = await fetch("https://api.github.com/repos/Bob1817/mimo-bridge-desktop/releases/latest");
  if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
  const release = await resp.json() as {
    tag_name: string;
    html_url: string;
    body?: string;
    assets?: { name: string; browser_download_url: string; size: number }[];
  };
  const latest = (release.tag_name || "").replace(/^v/, "");
  if (latest && latest !== app.getVersion()) {
    updateStatus = "available";
    updateInfo = {
      version: latest,
      releaseUrl: release.html_url,
      downloadUrl: release.assets?.find((a) => a.name.endsWith(".dmg"))?.browser_download_url || release.html_url,
      body: release.body || "",
    };
  } else {
    updateStatus = "not-available";
  }
  notifyUpdateStatus();
  return { ok: true };
}

ipcMain.handle("update:check", async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch {
    try {
      return await checkUpdateViaGitHub();
    } catch (err2: unknown) {
      updateStatus = "error";
      notifyUpdateStatus({ message: err2 instanceof Error ? err2.message : String(err2) });
      return { ok: false };
    }
  }
});

ipcMain.handle("update:download", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch {
    // Fallback: open download URL in browser
    const url = updateInfo?.downloadUrl || updateInfo?.releaseUrl;
    if (url && typeof url === "string") {
      shell.openExternal(url);
      return { ok: true, browser: true };
    }
    return { ok: false, message: "No download URL available" };
  }
});

ipcMain.handle("update:install", () => { autoUpdater.quitAndInstall(false, true); });

// --- App Lifecycle ---

app.whenReady().then(() => {
  createWindow();
  startGateway();
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
});

app.on("window-all-closed", async () => {
  mainWindow = null;
  await stopGateway();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
