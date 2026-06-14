import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST(req: Request) {
  const { topic, sources } = await req.json();
  if (!topic) return NextResponse.json({ error: "Missing topic" }, { status: 400 });

  try {
    // Check if nlm CLI is available
    try {
      execSync("nlm --version", { stdio: "pipe" });
    } catch {
      return NextResponse.json({
        error: "NotebookLM CLI not found. Please run: npm install -g notebooklm-mcp-cli && nlm login",
        setup_required: true,
      }, { status: 503 });
    }

    // Create the notebook
    const notebookName = `Academy Master: ${topic}`;
    const result = execSync(
      `nlm create-notebook --name "${notebookName}"`,
      { stdio: "pipe", encoding: "utf8" }
    );

    const parsed = JSON.parse(result.trim());
    const notebookId = parsed.id || parsed.notebook_id;

    // Add sources if provided
    if (sources && sources.length > 0) {
      for (const url of sources.slice(0, 10)) { // cap at 10
        try {
          execSync(`nlm add-source --notebook "${notebookId}" --url "${url}"`, {
            stdio: "pipe", encoding: "utf8",
          });
        } catch {
          // skip failed sources silently
        }
      }
    }

    return NextResponse.json({ success: true, notebookId, notebookName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
