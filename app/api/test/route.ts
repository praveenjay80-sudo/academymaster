import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const modelId = process.env.MODEL_ID ?? "claude-sonnet-4-6";
  const isOpenRouter = apiKey.startsWith("sk-or-");

  const config = {
    keyPrefix: apiKey.slice(0, 14) + "...",
    isOpenRouter,
    model: modelId,
    endpoint: isOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.anthropic.com/v1/messages",
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 30,
        stream: false,
        messages: [{ role: "user", content: "Say hello in 5 words." }],
      }),
    });

    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    return NextResponse.json({ config, status: res.status, response: parsed });
  } catch (err: unknown) {
    return NextResponse.json({ config, error: String(err) }, { status: 500 });
  }
}
