import type { Request, Response } from "express";
import { loadConfig, resolveModel } from "./config.js";
import { anthropicToOpenAI, openAIToAnthropicResponse } from "./converter.js";
import { logger } from "./logger.js";

export async function proxyOpenAI(req: Request, res: Response) {
  const cfg = loadConfig();
  const body = { ...(req.body || {}) } as Record<string, unknown>;
  const model = body.model as string;
  const resolved = resolveModel(model);

  if (!resolved) {
    logger.warn(`[OpenAI] No provider found for model: ${model}`);
    return res.status(400).json({ error: { message: `No provider found for model: ${model}` } });
  }

  const { provider, realModel } = resolved;
  if (!provider.apiKey) {
    logger.warn(`[OpenAI] API key not configured for provider: ${provider.name}`);
    return res.status(400).json({ error: { message: `API key not configured for provider: ${provider.name}` } });
  }

  body.model = realModel;

  try {
    const url = provider.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    logger.info(`[OpenAI] ${model} -> ${provider.name}/${realModel}`);
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      logger.error(`[OpenAI] Upstream error ${upstream.status}: ${errText.slice(0, 500)}`);
    }

    const ct = upstream.headers.get("content-type") || "";
    if (ct.includes("text/event-stream") || body.stream === true) {
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache");
      res.setHeader("connection", "keep-alive");
      if (!upstream.body) return res.end();
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      return res.end();
    }

    const text = await upstream.text();
    res.setHeader("content-type", ct || "application/json; charset=utf-8");
    return res.send(text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[OpenAI] Request failed: ${msg}`, { model, provider: provider.name, url: provider.baseUrl });
    return res.status(502).json({ error: { message: msg } });
  }
}

export async function proxyAnthropic(req: Request, res: Response) {
  const cfg = loadConfig();
  const body = req.body || {};
  const model = body.model || "";

  // Convert Anthropic request to OpenAI format
  const openaiMessages = anthropicToOpenAI(body.messages || [], body.system);
  const openaiBody: Record<string, unknown> = {
    model,
    messages: openaiMessages,
    max_tokens: body.max_tokens || 4096,
    stream: !!body.stream,
  };
  if (body.temperature !== undefined) openaiBody.temperature = body.temperature;
  if (body.top_p !== undefined) openaiBody.top_p = body.top_p;

  // Resolve model mapping
  const resolved = resolveModel(model);
  if (!resolved) {
    logger.warn(`[Anthropic] No provider for model: ${model}`);
    return res.status(400).json({ type: "error", error: { type: "invalid_request_error", message: `No provider for model: ${model}` } });
  }

  const { provider, realModel } = resolved;
  if (!provider.apiKey) {
    logger.warn(`[Anthropic] API key not configured for: ${provider.name}`);
    return res.status(400).json({ type: "error", error: { type: "authentication_error", message: `API key not configured for: ${provider.name}` } });
  }

  openaiBody.model = realModel;

  try {
    const url = provider.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    logger.info(`[Anthropic] ${model} -> ${provider.name}/${realModel}`);
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(openaiBody),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      logger.error(`[Anthropic] Upstream error ${upstream.status}: ${errText.slice(0, 500)}`);
    }

    const ct = upstream.headers.get("content-type") || "";

    if (body.stream && (ct.includes("text/event-stream") || body.stream)) {
      // Streaming: convert OpenAI SSE -> Anthropic SSE
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache");
      res.setHeader("connection", "keep-alive");

      if (!upstream.body) return res.end();

      const decoder = new TextDecoder();
      let buffer = "";

      // Send message_start
      const startEvent = { type: "message_start", message: { id: `msg_${Date.now()}`, type: "message", role: "assistant", content: [], model: realModel } };
      res.write(`event: message_start\ndata: ${JSON.stringify(startEvent)}\n\n`);

      // Send content_block_start
      res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`);

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: delta.content } })}\n\n`);
            }
          } catch {}
        }
      }

      // Send content_block_stop and message_stop
      res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`);
      res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
      return res.end();
    }

    // Non-streaming: convert OpenAI response -> Anthropic format
    const openaiResp = JSON.parse(await upstream.text());
    const anthropicResp = openAIToAnthropicResponse(openaiResp);
    res.setHeader("content-type", "application/json; charset=utf-8");
    return res.send(JSON.stringify(anthropicResp));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Anthropic] Request failed: ${msg}`, { model, provider: provider.name, url: provider.baseUrl });
    return res.status(502).json({ type: "error", error: { type: "api_error", message: msg } });
  }
}
