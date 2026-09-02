import { NextRequest } from "next/server";
import { uploadXESFile } from "@/features/upload/service";

export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 minutes limit for 200MB+ logs

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: Record<string, any>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        sendEvent({ type: "progress", stage: "START", percent: 5, message: "Upload received. Initiating processing..." });

        const { processLog } = await uploadXESFile(formData, (stage, percent, message) => {
          sendEvent({ type: "progress", stage, percent, message });
        });

        sendEvent({ type: "complete", data: processLog });
        controller.close();
      } catch (error: any) {
        sendEvent({ type: "error", error: error.message || "Upload processing failed" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
