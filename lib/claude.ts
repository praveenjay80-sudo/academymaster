const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

// Detect key type by prefix
const isOpenRouter = API_KEY.startsWith("sk-or-");

// Default model based on key type
const DEFAULT_MODEL = isOpenRouter ? "deepseek/deepseek-chat" : "claude-haiku-4-5-20251001";
const MODEL = process.env.MODEL_ID ?? DEFAULT_MODEL;

export const BEGINNER_SYSTEM = `You are an expert academic tutor who specialises in explaining complex topics to complete beginners who have zero prior knowledge.

CRITICAL RULES FOR ALL YOUR EXPLANATIONS:
1. Write as if talking to a smart 16-year-old who has never heard of this subject before
2. NEVER assume any prior knowledge — define every technical term the first time you use it
3. Use everyday analogies and comparisons to familiar things (cooking, sports, money, everyday objects)
4. Keep sentences short and clear — no academic jargon without an immediate plain-English explanation
5. When you introduce a concept, always explain WHY it matters and WHAT problem it solves
6. Use concrete examples, not abstract definitions alone
7. Be warm and encouraging — learning is hard, make it feel accessible
8. Structure your output with clear headings using ## and ###
9. Use bullet points (starting with -) for lists
10. Bold (**text**) the most important terms
11. Always return valid, well-structured content — never truncate mid-sentence`;

export async function streamToController(
  prompt: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  system = BEGINNER_SYSTEM,
  maxTokens = 8000
) {
  const encoder = new TextEncoder();

  let res: Response;

  if (isOpenRouter) {
    // OpenRouter uses OpenAI-compatible format
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3002",
        "X-Title": "Academy Master",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
  } else {
    // Direct Anthropic API format
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        stream: true,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;

      try {
        const json = JSON.parse(data);

        // Anthropic SSE format
        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
          controller.enqueue(encoder.encode(json.delta.text));
          continue;
        }

        // OpenAI/OpenRouter SSE format
        const text = json.choices?.[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      } catch { /* skip malformed lines */ }
    }
  }

  controller.close();
}

export async function streamChatToController(
  messages: { role: string; content: string }[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  system = BEGINNER_SYSTEM,
  maxTokens = 800
) {
  const encoder = new TextEncoder();
  let res: Response;

  if (isOpenRouter) {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3002",
        "X-Title": "Academy Master",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
  } else {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        stream: true,
        system,
        messages,
      }),
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;

      try {
        const json = JSON.parse(data);
        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
          controller.enqueue(encoder.encode(json.delta.text));
          continue;
        }
        const text = json.choices?.[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      } catch { /* skip malformed lines */ }
    }
  }

  controller.close();
}
