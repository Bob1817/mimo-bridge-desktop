import express from "express";
import cors from "cors";
import { loadConfig, saveConfig, publicConfig } from "./config.js";
import { proxyOpenAI, proxyAnthropic } from "./proxy.js";
import { findAvailablePort } from "./port.js";
import { logger } from "./logger.js";

export function createGatewayApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Request logging middleware
  app.use((req, _res, next) => {
    if (req.path.startsWith("/v1/")) {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        model: (req.body as Record<string, unknown>)?.model,
      });
    }
    next();
  });

  // Health
  app.get("/health", (_req, res) => res.json({ ok: true, config: publicConfig() }));

  // Config API
  app.get("/api/config", (_req, res) => res.json(publicConfig()));
  app.post("/api/config", (req, res) => {
    const saved = saveConfig(req.body || {});
    res.json({ ok: true, config: publicConfig(saved) });
  });

  // OpenAI compatible: model list
  app.get("/v1/models", (_req, res) => {
    const cfg = loadConfig();
    const models = cfg.modelMappings.map((m) => ({
      id: m.cursorModel,
      object: "model",
      created: Date.now(),
      owned_by: "mimo-bridge",
    }));
    res.json({ object: "list", data: models });
  });

  // OpenAI compatible: chat completions
  app.post("/v1/chat/completions", (req, res) => proxyOpenAI(req, res));

  // Anthropic compatible: messages
  app.post("/v1/messages", (req, res) => proxyAnthropic(req, res));

  // Model mappings API
  app.get("/api/mappings", (_req, res) => res.json(loadConfig().modelMappings));
  app.post("/api/mappings", (req, res) => {
    const cfg = saveConfig({ modelMappings: req.body });
    res.json({ ok: true, mappings: cfg.modelMappings });
  });

  // Providers API
  app.get("/api/providers", (_req, res) => res.json(loadConfig().providers));
  app.post("/api/providers", (req, res) => {
    const cfg = saveConfig({ providers: req.body });
    res.json({ ok: true, providers: cfg.providers });
  });

  // Test provider
  app.post("/api/test-provider", async (req, res) => {
    const { name } = req.body || {};
    const cfg = loadConfig();
    const provider = cfg.providers.find((p) => p.name === name);
    if (!provider) return res.status(404).json({ ok: false, message: "Provider not found" });
    if (!provider.apiKey) return res.status(400).json({ ok: false, message: "API key not set" });

    try {
      const url = provider.baseUrl.replace(/\/+$/, "") + "/chat/completions";
      logger.info(`Testing provider: ${provider.name} -> ${url}`);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${provider.apiKey}` },
        body: JSON.stringify({ model: "test", max_tokens: 5, messages: [{ role: "user", content: "hi" }] }),
      });
      const text = await resp.text();
      logger.info(`Test result: ${provider.name} status=${resp.status}`);
      return res.json({ ok: resp.ok, status: resp.status, preview: text.slice(0, 500) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Test failed: ${provider.name} - ${msg}`);
      return res.status(502).json({ ok: false, message: msg });
    }
  });

  // Logs API
  app.get("/api/logs", (_req, res) => {
    res.json({ logs: logger.getRecentLogs(), logDir: logger.getLogDir(), files: logger.getLogFiles() });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(`Unhandled Express error: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: { message: "Internal server error" } });
  });

  return app;
}

// Standalone server mode
if (process.argv[1] && process.argv[1].includes("server")) {
  const cfg = loadConfig();
  findAvailablePort(cfg.port).then((port) => {
    const app = createGatewayApp();
    app.listen(port, () => {
      logger.info(`Gateway running: http://localhost:${port}`);
    });
  });
}
