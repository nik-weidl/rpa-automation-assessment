import { NextResponse } from "next/server";
import { evaluateActivityWithLLMAgentic } from "@/features/automation-scoring/agentic-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { activityId, model } = body;

    if (!activityId || !model) {
      return NextResponse.json(
        { success: false, error: "missing activityId or model" },
        { status: 400 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (eventData: any) => {
          const formatted = `data: ${JSON.stringify(eventData)}\n\n`;
          controller.enqueue(new TextEncoder().encode(formatted));
        };

        try {
          const assessment = await evaluateActivityWithLLMAgentic(
            activityId,
            model,
            (step) => {
              sendEvent({ type: "step", step });
            },
            request.signal
          );

          sendEvent({ type: "complete", data: assessment });
        } catch (err: any) {
          sendEvent({ type: "error", error: err.message || "failed to execute dynamic agentic evaluation" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "failed to initiate streaming" },
      { status: 500 }
    );
  }
}
