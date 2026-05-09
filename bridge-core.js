import fs from "fs";
import path from "path";
import os from "os";

export const APP_DIR = path.join(os.homedir(), ".mimo-bridge-desktop");
export const CONFIG_PATH = path.join(APP_DIR, "config.json");

export function ensureAppDir() {
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
}

export function defaultConfig() {
  return {
    port: 8787,
    activeClient: "claude",

    upstreamBaseUrl: "https://token-plan-cn.xiaomimimo.com/anthropic",
    upstreamApiKey: "",
    upstreamModel: "mimo-v2.5-pro",
    claudeModel: "claude-sonnet-4-20250514",
    compatClean: true,

    codexUseLocalProxy: true,
    codexProviderId: "mimo_proxy",
    codexProviderName: "MIMO Bridge Proxy",
    codexBaseUrl: "https://api.openai.com/v1",
    codexApiKey: "",
    codexModel: "gpt-5-codex",
    codexEnvKey: "MIMO_BRIDGE_CODEX_API_KEY",
    codexWireApi: "responses"
  };
}

export function loadConfig() {
  ensureAppDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    const cfg = defaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    return cfg;
  }
  try {
    return { ...defaultConfig(), ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(patch = {}) {
  ensureAppDir();
  const next = { ...loadConfig(), ...patch };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function publicConfig(cfg = loadConfig()) {
  return {
    ...cfg,
    upstreamApiKey: cfg.upstreamApiKey ? "********" : "",
    codexApiKey: cfg.codexApiKey ? "********" : ""
  };
}

export function joinApiUrl(base, apiPath) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (b.endsWith("/v1")) return `${b}${p.replace(/^\/v1/, "")}`;
  return `${b}${p}`;
}

export function mapClaudeModel(model, cfg) {
  const m = String(model || "").toLowerCase();
  if (!m) return cfg.upstreamModel;
  if (m.includes("claude") || m.includes("sonnet") || m.includes("opus") || m.includes("haiku")) {
    return cfg.upstreamModel;
  }
  return model;
}

function cleanBlock(block) {
  if (typeof block === "string") return block;
  if (!block || typeof block !== "object") return String(block ?? "");

  if (block.type === "text") return { type: "text", text: String(block.text ?? "") };

  if (block.type === "tool_use") {
    return {
      type: "tool_use",
      id: String(block.id || `toolu_${Date.now()}`),
      name: String(block.name || "unknown_tool"),
      input: block.input && typeof block.input === "object" ? block.input : {}
    };
  }

  if (block.type === "tool_result") {
    let content = block.content;
    if (Array.isArray(content)) {
      content = content.map((item) => {
        if (typeof item === "string") return item;
        if (item?.type === "text") return item.text || "";
        try { return JSON.stringify(item); } catch { return String(item); }
      }).join("\n");
    } else if (typeof content === "object") {
      try { content = JSON.stringify(content); } catch { content = String(content); }
    }
    return {
      type: "tool_result",
      tool_use_id: String(block.tool_use_id || ""),
      content: String(content ?? ""),
      is_error: Boolean(block.is_error)
    };
  }

  try {
    return { type: "text", text: `[Unsupported content block converted]\n${JSON.stringify(block)}` };
  } catch {
    return { type: "text", text: "[Unsupported content block converted]" };
  }
}

export function cleanClaudeBody(body, cfg) {
  const next = { ...(body || {}) };
  next.model = mapClaudeModel(next.model, cfg);

  if (!cfg.compatClean) return next;

  if (Array.isArray(next.messages)) {
    next.messages = next.messages.map((msg) => {
      const m = { ...msg };
      if (Array.isArray(m.content)) m.content = m.content.map(cleanBlock);
      else if (typeof m.content !== "string") {
        try { m.content = JSON.stringify(m.content ?? ""); } catch { m.content = String(m.content ?? ""); }
      }
      return m;
    });
  }

  if (Array.isArray(next.system)) next.system = next.system.map(cleanBlock);

  delete next.thinking;
  delete next.container;
  delete next.mcp_servers;

  return next;
}

export function claudeHeaders(cfg) {
  return {
    "content-type": "application/json",
    "accept": "application/json, text/event-stream",
    "anthropic-version": "2023-06-01",
    "x-api-key": cfg.upstreamApiKey,
    "authorization": `Bearer ${cfg.upstreamApiKey}`
  };
}

export function openaiHeaders(apiKey) {
  return {
    "content-type": "application/json",
    "accept": "application/json, text/event-stream",
    "authorization": `Bearer ${apiKey}`,
    "api-key": apiKey
  };
}

export function claudeSettingsSnippet(cfg = loadConfig()) {
  return JSON.stringify({
    env: {
      ANTHROPIC_AUTH_TOKEN: "sk-local",
      ANTHROPIC_BASE_URL: `http://localhost:${cfg.port}/anthropic`,
      ANTHROPIC_MODEL: cfg.claudeModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: cfg.claudeModel
    }
  }, null, 2);
}

export function writeClaudeSettings(cfg = loadConfig()) {
  const dir = path.join(os.homedir(), ".claude");
  const file = path.join(dir, "settings.json");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let current = {};
  let backupPath = "";
  if (fs.existsSync(file)) {
    try {
      current = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      backupPath = `${file}.backup-${Date.now()}`;
      fs.copyFileSync(file, backupPath);
    }
  }

  const next = {
    ...current,
    env: {
      ...(current.env || {}),
      ANTHROPIC_AUTH_TOKEN: "sk-local",
      ANTHROPIC_BASE_URL: `http://localhost:${cfg.port}/anthropic`,
      ANTHROPIC_MODEL: cfg.claudeModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: cfg.claudeModel
    }
  };

  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return { settingsPath: file, backupPath, env: next.env };
}

export function tomlEscape(v) {
  return String(v ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function codexLocalBaseUrl(cfg = loadConfig()) {
  return `http://localhost:${cfg.port}/codex/v1`;
}

export function codexConfigSnippet(cfg = loadConfig()) {
  const providerId = cfg.codexProviderId || "mimo_proxy";
  const baseUrl = cfg.codexUseLocalProxy ? codexLocalBaseUrl(cfg) : cfg.codexBaseUrl;
  const envKey = cfg.codexEnvKey || "MIMO_BRIDGE_CODEX_API_KEY";

  return [
    `model = "${tomlEscape(cfg.codexModel || "gpt-5-codex")}"`,
    `model_provider = "${tomlEscape(providerId)}"`,
    ``,
    `[model_providers.${providerId}]`,
    `name = "${tomlEscape(cfg.codexProviderName || "MIMO Bridge Proxy")}"`,
    `base_url = "${tomlEscape(baseUrl)}"`,
    `env_key = "${tomlEscape(envKey)}"`,
    `wire_api = "${tomlEscape(cfg.codexWireApi || "responses")}"`,
    `request_max_retries = 4`,
    `stream_max_retries = 10`,
    `stream_idle_timeout_ms = 300000`
  ].join("\n");
}

export function codexShellEnvSnippet(cfg = loadConfig()) {
  const envKey = cfg.codexEnvKey || "MIMO_BRIDGE_CODEX_API_KEY";
  return `export ${envKey}="${tomlEscape(cfg.codexApiKey || "你的_API_KEY")}"`;
}

export function writeCodexConfig(cfg = loadConfig()) {
  const dir = path.join(os.homedir(), ".codex");
  const file = path.join(dir, "config.toml");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let backupPath = "";
  if (fs.existsSync(file)) {
    backupPath = `${file}.backup-${Date.now()}`;
    fs.copyFileSync(file, backupPath);
  }

  const content = codexConfigSnippet(cfg) + "\n\n# API Key 环境变量：\n# " + codexShellEnvSnippet(cfg) + "\n";
  fs.writeFileSync(file, content);
  return { configPath: file, backupPath, content };
}

export function shellProfilePath() {
  const shell = process.env.SHELL || "";
  const home = os.homedir();
  if (shell.includes("bash")) return path.join(home, ".bash_profile");
  return path.join(home, ".zshrc");
}

export function writeCodexEnvToShell(cfg = loadConfig()) {
  const file = shellProfilePath();
  const start = "# >>> MIMO Bridge Codex env >>>";
  const end = "# <<< MIMO Bridge Codex env <<<";
  const block = `${start}\n${codexShellEnvSnippet(cfg)}\n${end}`;

  let current = "";
  if (fs.existsSync(file)) current = fs.readFileSync(file, "utf8");

  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, "m");
  if (pattern.test(current)) current = current.replace(pattern, block);
  else current = current.trimEnd() + "\n\n" + block + "\n";

  fs.writeFileSync(file, current);
  return { profilePath: file, envLine: codexShellEnvSnippet(cfg) };
}
