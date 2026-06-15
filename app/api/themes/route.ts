import { streamToController, BEGINNER_SYSTEM } from "@/lib/claude";
import { themesPrompt } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { domain, field } = await req.json();
  if (!domain || !field) return new Response("Missing domain or field", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamToController(themesPrompt(domain, field), controller, BEGINNER_SYSTEM, 4000);
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
