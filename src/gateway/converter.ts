// Anthropic <-> OpenAI message format conversion

interface AnthropicContent {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
  source?: unknown;
}

interface AnthropicMessage {
  role: string;
  content: string | AnthropicContent[];
}

interface OpenAIMessage {
  role: string;
  content?: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
}

// Convert Anthropic messages to OpenAI format
export function anthropicToOpenAI(messages: AnthropicMessage[], system?: string | AnthropicContent[]): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  if (system) {
    const text = typeof system === "string" ? system : system.map((b) => b.text || "").join("\n");
    result.push({ role: "system", content: text });
  }

  for (const msg of messages) {
    if (msg.role === "assistant") {
      if (typeof msg.content === "string") {
        result.push({ role: "assistant", content: msg.content });
        continue;
      }
      const toolCalls: unknown[] = [];
      let textParts: string[] = [];
      for (const block of msg.content) {
        if (block.type === "text") textParts.push(block.text || "");
        if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: { name: block.name, arguments: JSON.stringify(block.input || {}) },
          });
        }
      }
      const assistant: OpenAIMessage = { role: "assistant" };
      if (textParts.length) assistant.content = textParts.join("\n");
      if (toolCalls.length) assistant.tool_calls = toolCalls;
      result.push(assistant);
    } else if (msg.role === "user") {
      if (typeof msg.content === "string") {
        result.push({ role: "user", content: msg.content });
        continue;
      }
      for (const block of msg.content) {
        if (block.type === "text") {
          result.push({ role: "user", content: block.text || "" });
        } else if (block.type === "tool_result") {
          let content = "";
          if (typeof block.content === "string") content = block.content;
          else if (Array.isArray(block.content)) {
            content = block.content.map((c: unknown) => {
              if (typeof c === "string") return c;
              if (c && typeof c === "object" && "text" in c) return (c as { text: string }).text || "";
              return JSON.stringify(c);
            }).join("\n");
          }
          result.push({
            role: "tool",
            tool_call_id: block.tool_use_id || "",
            content,
          });
        }
      }
    }
  }
  return result;
}

// Convert OpenAI response to Anthropic format
export function openAIToAnthropicResponse(openaiResp: unknown): unknown {
  const resp = openaiResp as { choices?: { message?: OpenAIMessage; delta?: OpenAIMessage }[]; id?: string };
  if (!resp.choices?.length) return { type: "error", error: { type: "api_error", message: "No choices" } };

  const choice = resp.choices[0];
  const msg = choice.message || choice.delta;
  if (!msg) return { type: "error", error: { type: "api_error", message: "No message" } };

  const content: AnthropicContent[] = [];
  if (msg.content) content.push({ type: "text", text: msg.content });
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      const fn = (tc as { id: string; function: { name: string; arguments: string } }).function;
      content.push({
        type: "tool_use",
        id: (tc as { id: string }).id,
        name: fn.name,
        input: JSON.parse(fn.arguments || "{}"),
      });
    }
  }

  return {
    id: resp.id || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content,
    stop_reason: content.some((c) => c.type === "tool_use") ? "tool_use" : "end_turn",
    model: "mimo-bridge",
  };
}
