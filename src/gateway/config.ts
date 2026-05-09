import fs from "fs";
import path from "path";
import os from "os";

export const APP_DIR = path.join(os.homedir(), ".mimo-bridge-desktop");
export const CONFIG_PATH = path.join(APP_DIR, "config.json");

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

export interface AppConfig {
  port: number;
  providers: Provider[];
  modelMappings: ModelMapping[];
  defaultProvider: string;
}

const DEFAULT_PROVIDERS: Provider[] = [
  { name: "mimo", type: "openai", baseUrl: "https://token-plan-cn.xiaomimimo.com/v1", apiKey: "" },
  { name: "deepseek", type: "openai", baseUrl: "https://api.deepseek.com/v1", apiKey: "" },
  { name: "spark", type: "openai", baseUrl: "https://spark-api-open.xf-yun.com/v1", apiKey: "" },
  { name: "qwen", type: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: "" },
  { name: "anthropic", type: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: "" },
];

const DEFAULT_MAPPINGS: ModelMapping[] = [
  { cursorModel: "claude-3-7-sonnet", providerName: "mimo", realModel: "mimo-v2.5-pro" },
  { cursorModel: "claude-sonnet-4-20250514", providerName: "mimo", realModel: "mimo-v2.5-pro" },
  { cursorModel: "gpt-4o", providerName: "mimo", realModel: "mimo-v2.5-pro" },
  { cursorModel: "deepseek-r1", providerName: "deepseek", realModel: "deepseek-reasoner" },
];

const MASKED = "********";

function defaultConfig(): AppConfig {
  return {
    port: 8788,
    providers: DEFAULT_PROVIDERS,
    modelMappings: DEFAULT_MAPPINGS,
    defaultProvider: "mimo",
  };
}

export function ensureAppDir() {
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
}

export function loadConfig(): AppConfig {
  ensureAppDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    const cfg = defaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    return cfg;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return { ...defaultConfig(), ...raw };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  ensureAppDir();
  const current = loadConfig();

  // When saving providers, preserve existing real API keys
  // (frontend sends masked "********" for keys it doesn't know)
  let mergedProviders = patch.providers;
  if (mergedProviders) {
    mergedProviders = mergedProviders.map((p) => {
      if (p.apiKey === MASKED || p.apiKey === "") {
        const existing = current.providers.find((e) => e.name === p.name);
        if (existing && existing.apiKey && existing.apiKey !== MASKED) {
          return { ...p, apiKey: existing.apiKey };
        }
      }
      return p;
    });
  }

  const next = { ...current, ...patch, ...(mergedProviders ? { providers: mergedProviders } : {}) };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function publicConfig(cfg?: AppConfig) {
  const c = cfg || loadConfig();
  return {
    ...c,
    providers: c.providers.map((p) => ({ ...p, apiKey: p.apiKey ? MASKED : "" })),
  };
}

export function resolveModel(model: string): { provider: Provider; realModel: string } | null {
  const cfg = loadConfig();
  const mapping = cfg.modelMappings.find((m) => m.cursorModel === model);
  if (mapping) {
    const provider = cfg.providers.find((p) => p.name === mapping.providerName);
    if (provider) return { provider, realModel: mapping.realModel };
  }
  const dp = cfg.providers.find((p) => p.name === cfg.defaultProvider);
  if (dp) return { provider: dp, realModel: model };
  return null;
}
