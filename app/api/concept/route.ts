import { streamToController, BEGINNER_SYSTEM } from "@/lib/claude";
import { conceptDeepDivePrompt } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { topic, concept, prerequisites } = await req.json();
  if (!topic || !concept) return new Response("Missing params", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamToController(
          conceptDeepDivePrompt(topic, concept, prerequisites ?? []),
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
