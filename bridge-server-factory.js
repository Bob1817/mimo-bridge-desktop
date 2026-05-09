import express from "express";
import cors from "cors";
import {
  loadConfig,
  saveConfig,
  publicConfig,
  joinApiUrl,
  cleanClaudeBody,
  claudeHeaders,
  openaiHeaders,
  writeClaudeSettings,
  codexConfigSnippet,
  codexShellEnvSnippet,
  writeCodexConfig,
  writeCodexEnvToShell
} from "./bridge-core.js";

async function pipeResponse(upstreamResp, res, body = {}) {
  const contentType = upstreamResp.headers.get("content-type") || "";
  res.status(upstreamResp.status);

  if (contentType.includes("text/event-stream") || body.stream === true) {
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache");
    res.setHeader("connection", "keep-alive");

    if (!upstreamResp.body) return res.end();

    const reader = upstreamResp.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  }

  const text = await upstreamResp.text();
  res.setHeader("content-type", contentType || "application/json; charset=utf-8");
  return res.send(text);
}

export function createBridgeApp(runtime = {}) {
  const app = express();
  const logger = runtime.logger || (() => {});

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  app.get("/api/config", (req, res) => res.json(publicConfig()));

  app.post("/api/config", (req, res) => {
    const b = req.body || {};
    const patch = {};

    for (const k of [
      "upstreamBaseUrl", "upstreamModel", "claudeModel", "activeClient",
      "codexProviderId", "codexProviderName", "codexBaseUrl", "codexModel",
      "codexEnvKey", "codexWireApi"
    ]) {
      if (b[k] !== undefined) patch[k] = String(b[k]);
    }

    if (b.port !== undefined) patch.port = Number(b.port || 8787);
    if (b.compatClean !== undefined) patch.compatClean = Boolean(b.compatClean);
    if (b.codexUseLocalProxy !== undefined) patch.codexUseLocalProxy = Boolean(b.codexUseLocalProxy);

    if (b.upstreamApiKey !== undefined && b.upstreamApiKey !== "********") patch.upstreamApiKey = String(b.upstreamApiKey);
    if (b.codexApiKey !== undefined && b.codexApiKey !== "********") patch.codexApiKey = String(b.codexApiKey);

    const saved = saveConfig(patch);
    res.json({ ok: true, config: publicConfig(saved) });
  });

  function modelList(req, res) {
    const cfg = loadConfig();
    res.json({
      data: [{
        id: cfg.claudeModel,
        type: "model",
        display_name: "Claude Sonnet compatible alias -> Xiaomi MIMO"
      }],
      has_more: false
    });
  }

  app.get("/anthropic/v1/models", modelList);
  app.get("/v1/models", modelList);

  async function proxyClaude(req, res, apiPath) {
    const cfg = loadConfig();
    if (!cfg.upstreamApiKey) {
      return res.status(400).json({ error: { type: "config_error", message: "请先填写 Claude/MIMO 上游 API Key" } });
    }

    const body = cleanClaudeBody(req.body || {}, cfg);
    const url = joinApiUrl(cfg.upstreamBaseUrl, apiPath);

    try {
      logger(`Claude proxy: ${body.model} -> ${cfg.upstreamModel}`);
      const upstreamResp = await fetch(url, {
        method: "POST",
        headers: claudeHeaders(cfg),
        body: JSON.stringify(body)
      });
      return pipeResponse(upstreamResp, res, body);
    } catch (err) {
      logger(`Claude upstream error: ${err?.message || String(err)}`);
      return res.status(502).json({ error: { type: "upstream_error", message: err?.message || String(err), upstream: url } });
    }
  }

  async function proxyCodex(req, res, apiPath) {
    const cfg = loadConfig();
    if (!cfg.codexApiKey) {
      return res.status(400).json({ error: { type: "config_error", message: "请先填写 Codex 上游 API Key" } });
    }

    const body = { ...(req.body || {}) };
    if (body.model && cfg.codexModel) body.model = cfg.codexModel;

    const url = joinApiUrl(cfg.codexBaseUrl, apiPath);

    try {
      logger(`Codex proxy: ${apiPath} -> ${cfg.codexModel}`);
      const upstreamResp = await fetch(url, {
        method: "POST",
        headers: openaiHeaders(cfg.codexApiKey),
        body: JSON.stringify(body)
      });
      return pipeResponse(upstreamResp, res, body);
    } catch (err) {
      logger(`Codex upstream error: ${err?.message || String(err)}`);
      return res.status(502).json({ error: { type: "codex_upstream_error", message: err?.message || String(err), upstream: url } });
    }
  }

  app.post("/anthropic/v1/messages", (req, res) => proxyClaude(req, res, "/v1/messages"));
  app.post("/v1/messages", (req, res) => proxyClaude(req, res, "/v1/messages"));

  app.post("/codex/v1/responses", (req, res) => proxyCodex(req, res, "/v1/responses"));
  app.post("/codex/v1/chat/completions", (req, res) => proxyCodex(req, res, "/v1/chat/completions"));

  app.post("/api/claude/test", async (req, res) => {
    const cfg = loadConfig();
    if (!cfg.upstreamApiKey) return res.status(400).json({ ok: false, message: "请先填写 Claude/MIMO API Key" });

    const url = joinApiUrl(cfg.upstreamBaseUrl, "/v1/messages");
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: claudeHeaders(cfg),
        body: JSON.stringify({ model: cfg.upstreamModel, max_tokens: 64, messages: [{ role: "user", content: "hello" }] })
      });
      const text = await resp.text();
      res.status(resp.status).json({ ok: resp.ok, status: resp.status, upstream: url, responsePreview: text.slice(0, 1200) });
    } catch (err) {
      res.status(502).json({ ok: false, message: err?.message || String(err) });
    }
  });

  app.post("/api/codex/test", async (req, res) => {
    const cfg = loadConfig();
    if (!cfg.codexApiKey) return res.status(400).json({ ok: false, message: "请先填写 Codex API Key" });

    const url = joinApiUrl(cfg.codexBaseUrl, "/v1/responses");
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: openaiHeaders(cfg.codexApiKey),
        body: JSON.stringify({ model: cfg.codexModel, input: "hello" })
      });
      const text = await resp.text();
      res.status(resp.status).json({ ok: resp.ok, status: resp.status, upstream: url, responsePreview: text.slice(0, 1200) });
    } catch (err) {
      res.status(502).json({ ok: false, message: err?.message || String(err) });
    }
  });

  app.post("/api/claude/write-settings", (req, res) => {
    try { res.json({ ok: true, ...writeClaudeSettings(loadConfig()) }); }
    catch (err) { res.status(500).json({ ok: false, message: err?.message || String(err) }); }
  });

  app.get("/api/codex/snippet", (req, res) => {
    const cfg = loadConfig();
    res.json({ configToml: codexConfigSnippet(cfg), shellEnv: codexShellEnvSnippet(cfg) });
  });

  app.post("/api/codex/write-config", (req, res) => {
    try { res.json({ ok: true, ...writeCodexConfig(loadConfig()) }); }
    catch (err) { res.status(500).json({ ok: false, message: err?.message || String(err) }); }
  });

  app.post("/api/codex/write-env", (req, res) => {
    try { res.json({ ok: true, ...writeCodexEnvToShell(loadConfig()) }); }
    catch (err) { res.status(500).json({ ok: false, message: err?.message || String(err) }); }
  });

  app.get("/health", (req, res) => res.json({ ok: true, config: publicConfig() }));

  return app;
}
