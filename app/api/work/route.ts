import { streamToController, BEGINNER_SYSTEM } from "@/lib/claude";
import { workChaptersPrompt } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { topic, title, authors, type } = await req.json();
  if (!topic || !title) return new Response("Missing params", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamToController(
          workChaptersPrompt(topic, title, authors ?? "Unknown", type ?? "TEXTBOOK"),
          controller,
          BEGINNER_SYSTEM,
          8000
        );
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
