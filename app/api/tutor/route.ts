import { streamChatToController } from "@/lib/claude";
import { tutorSystemPrompt } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { topic, conceptNames, history } = await req.json();
  if (!topic || !Array.isArray(history)) {
    return new Response("Missing topic or history", { status: 400 });
  }

  const system = tutorSystemPrompt(topic, conceptNames ?? []);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamChatToController(history, controller, system, 600);
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
