import { NextResponse } from "next/server";
import { parseProcessLog } from "@/features/process-mining/service";

/**
 * Parses a process log by its ID
 * @param request process log ID in the query parameters
 * @returns parsed process log or error message
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const processId = url.searchParams.get("processId");

  if (!processId) {
    return NextResponse.json({ success: false, error: "Missing processId" }, { status: 400 });
  }

  try {
    const parsed = await parseProcessLog(processId);
    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Parse XES error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Parse failed" }, { status: 500 });
  }
}
