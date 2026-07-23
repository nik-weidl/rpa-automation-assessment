import { NextResponse } from "next/server";
import { evaluateActivityWithLLMSingleShot } from "@/features/automation-scoring/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { activityId, type, model } = body;

    // validate request parameters
    if (!activityId || !type || !model) {
      return NextResponse.json(
        { success: false, error: "missing required fields: activityId, type, and model" },
        { status: 400 }
      );
    }

    if (type !== "LLM_SINGLE_SHOT") {
      return NextResponse.json(
        { success: false, error: `unsupported assessment type: ${type}` },
        { status: 400 }
      );
    }

    // trigger single-shot assessment
    const assessment = await evaluateActivityWithLLMSingleShot(activityId, model);

    return NextResponse.json({ success: true, data: assessment });
  } catch (error: any) {
    console.error("error evaluating activity with LLM:", error);
    return NextResponse.json(
      { success: false, error: error.message || "failed to evaluate activity" },
      { status: 500 }
    );
  }
}
