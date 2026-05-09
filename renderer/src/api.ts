import { useStore, type Provider, type ModelMapping, type LogEntry } from "./store";

export interface MimoBridge {
  getConfig: () => Promise<Record<string, unknown>>;
  saveConfig: (payload: unknown) => Promise<Record<string, unknown>>;
  startGateway: () => Promise<{ ok: boolean; port?: number; message?: string }>;
  stopGateway: () => Promise<{ ok: boolean }>;
  getStatus: () => Promise<{ running: boolean; port: number | null }>;
  getPort: () => Promise<number | null>;
  copy: (text: string) => Promise<{ ok: boolean }>;
  openLogDir: () => Promise<{ ok: boolean }>;
  getLogs: (count?: number) => Promise<LogEntry[]>;
  getLogFiles: () => Promise<string[]>;
  onLogEntry: (cb: (entry: LogEntry) => void) => void;
  getAppVersion: () => Promise<string>;
  checkUpdate: () => Promise<{ ok: boolean }>;
  downloadUpdate: () => Promise<{ ok: boolean }>;
  installUpdate: () => void;
  onUpdateStatus: (cb: (data: unknown) => void) => void;
}

const mimo = (window as unknown as { mimo: MimoBridge }).mimo;

export async function initApp() {
  const { setConfig, setProviders, setModelMappings, setGateway, setLogEntries, setVersion, setUpdateInfo, addLogEntry } = useStore.getState();

  const config = await mimo.getConfig();
  setConfig(config);
  setProviders((config.providers as Provider[]) || []);
  setModelMappings((config.modelMappings as ModelMapping[]) || []);

  const status = await mimo.getStatus();
  setGateway(status.running, status.port);

  const recentLogs = await mimo.getLogs(200);
  setLogEntries(recentLogs);

  const v = await mimo.getAppVersion();
  setVersion(v);

  mimo.onLogEntry((entry: LogEntry) => addLogEntry(entry));
  mimo.onUpdateStatus((data: unknown) => setUpdateInfo(data as Record<string, unknown>));

  setInterval(async () => {
    const s = await mimo.getStatus();
    setGateway(s.running, s.port);
  }, 3000);
}

export async function saveConfig(patch: Record<string, unknown>) {
  try {
    const result = await mimo.saveConfig(patch);
    useStore.getState().setConfig(result);
    if (result.providers) useStore.getState().setProviders(result.providers as Provider[]);
    if (result.modelMappings) useStore.getState().setModelMappings(result.modelMappings as ModelMapping[]);
    useStore.getState().showToast("配置已保存");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("saveConfig failed:", err);
    useStore.getState().showToast(`保存失败: ${msg}`);
  }
}

export async function saveProviders(providers: Provider[]) {
  try {
    const result = await mimo.saveConfig({ providers });
    useStore.getState().setConfig(result);
    useStore.getState().setProviders(providers);
    useStore.getState().showToast("服务商已保存");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("saveProviders failed:", err);
    useStore.getState().showToast(`保存失败: ${msg}`);
  }
}

export async function saveMappings(mappings: ModelMapping[]) {
  try {
    const result = await mimo.saveConfig({ modelMappings: mappings });
    useStore.getState().setConfig(result);
    useStore.getState().setModelMappings(mappings);
    useStore.getState().showToast("模型映射已保存");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("saveMappings failed:", err);
    useStore.getState().showToast(`保存失败: ${msg}`);
  }
}

export async function startGateway() {
  const r = await mimo.startGateway();
  const s = await mimo.getStatus();
  useStore.getState().setGateway(s.running, s.port);
  useStore.getState().showToast(r.ok ? `网关已在端口 ${r.port} 启动` : `失败: ${r.message}`);
}

export async function stopGateway() {
  await mimo.stopGateway();
  useStore.getState().setGateway(false, null);
  useStore.getState().showToast("网关已停止");
}

export async function copyText(text: string) {
  await mimo.copy(text);
  useStore.getState().showToast("已复制到剪贴板");
}

export async function openLogDir() {
  await mimo.openLogDir();
}
