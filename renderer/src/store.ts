import { create } from "zustand";

export interface Provider {
  name: string;
  type: "openai" | "anthropic";
  baseUrl: string;
  apiKey: string;
}

export interface ModelMapping {
  cursorModel: string;
  providerName: string;
  realModel: string;
}

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

interface AppState {
  config: Record<string, unknown>;
  providers: Provider[];
  modelMappings: ModelMapping[];
  gatewayRunning: boolean;
  gatewayPort: number | null;
  logEntries: LogEntry[];
  updateInfo: { status: string; info?: Record<string, unknown>; currentVersion?: string; percent?: number };
  version: string;
  page: string;
  toast: string;

  setConfig: (c: Record<string, unknown>) => void;
  setProviders: (p: Provider[]) => void;
  setModelMappings: (m: ModelMapping[]) => void;
  setGateway: (running: boolean, port: number | null) => void;
  setLogEntries: (l: LogEntry[]) => void;
  addLogEntry: (e: LogEntry) => void;
  setUpdateInfo: (u: Record<string, unknown>) => void;
  setVersion: (v: string) => void;
  setPage: (p: string) => void;
  showToast: (msg: string) => void;
}

export const useStore = create<AppState>((set) => ({
  config: {},
  providers: [],
  modelMappings: [],
  gatewayRunning: false,
  gatewayPort: null,
  logEntries: [],
  updateInfo: { status: "idle" },
  version: "",
  page: "dashboard",
  toast: "",

  setConfig: (config) => set({ config }),
  setProviders: (providers) => set({ providers }),
  setModelMappings: (modelMappings) => set({ modelMappings }),
  setGateway: (running, port) => set({ gatewayRunning: running, gatewayPort: port }),
  setLogEntries: (logEntries) => set({ logEntries }),
  addLogEntry: (entry) => set((s) => ({ logEntries: [entry, ...s.logEntries].slice(0, 500) })),
  setUpdateInfo: (updateInfo) => set({ updateInfo: updateInfo as AppState["updateInfo"] }),
  setVersion: (version) => set({ version }),
  setPage: (page) => set({ page }),
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: "" }), 2500);
  },
}));
