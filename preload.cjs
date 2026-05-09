const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mimoBridge", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (payload) => ipcRenderer.invoke("config:save", payload),
  startBridge: () => ipcRenderer.invoke("bridge:start"),
  stopBridge: () => ipcRenderer.invoke("bridge:stop"),
  getStatus: () => ipcRenderer.invoke("bridge:status"),

  getClaudeSnippet: () => ipcRenderer.invoke("claude:snippet"),
  writeClaudeSettings: () => ipcRenderer.invoke("claude:write"),
  testClaude: () => ipcRenderer.invoke("claude:test"),

  getCodexSnippet: () => ipcRenderer.invoke("codex:snippet"),
  writeCodexConfig: () => ipcRenderer.invoke("codex:writeConfig"),
  writeCodexEnv: () => ipcRenderer.invoke("codex:writeEnv"),
  testCodex: () => ipcRenderer.invoke("codex:test"),

  copy: (text) => ipcRenderer.invoke("clipboard:write", text),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  onLogs: (callback) => ipcRenderer.on("logs", (_, logs) => callback(logs)),

  // Update APIs
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateStatus: (callback) => ipcRenderer.on("update:status", (_, data) => callback(data))
});
