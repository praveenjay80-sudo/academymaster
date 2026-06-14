import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST(req: Request) {
  const { notebookId, question } = await req.json();
  if (!notebookId || !question) {
    return NextResponse.json({ error: "Missing notebookId or question" }, { status: 400 });
  }

  try {
    const result = execSync(
      `nlm query --notebook "${notebookId}" --question "${question.replace(/"/g, '\\"')}"`,
      { stdio: "pipe", encoding: "utf8" }
    );
    const parsed = JSON.parse(result.trim());
    return NextResponse.json({ answer: parsed.answer || parsed.response || result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
