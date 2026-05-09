import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mimo", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (payload: unknown) => ipcRenderer.invoke("config:save", payload),
  startGateway: () => ipcRenderer.invoke("gateway:start"),
  stopGateway: () => ipcRenderer.invoke("gateway:stop"),
  getStatus: () => ipcRenderer.invoke("gateway:status"),
  getPort: () => ipcRenderer.invoke("gateway:port"),
  copy: (text: string) => ipcRenderer.invoke("clipboard:write", text),
  openExternal: (url: string) => ipcRenderer.invoke("open:external", url),
  openLogDir: () => ipcRenderer.invoke("open:logDir"),
  getLogs: (count?: number) => ipcRenderer.invoke("logs:get", count),
  getLogFiles: () => ipcRenderer.invoke("logs:files"),
  onLogEntry: (cb: (entry: unknown) => void) => ipcRenderer.on("log:entry", (_, entry) => cb(entry)),
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateStatus: (cb: (data: unknown) => void) => ipcRenderer.on("update:status", (_, data) => cb(data)),
});
