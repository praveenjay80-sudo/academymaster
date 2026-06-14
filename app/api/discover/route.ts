import { streamToController, BEGINNER_SYSTEM } from "@/lib/claude";
import { discoverPrompt } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { topic } = await req.json();
  if (!topic) return new Response("Missing topic", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamToController(discoverPrompt(topic), controller, BEGINNER_SYSTEM, 6000);
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
