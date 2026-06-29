import { NextResponse } from "next/server";
import { deleteProcessLog, getProcessLogs, renameProcessLog } from "@/features/upload/service";
import { ApiResponse } from "@/types/api";

/**
 * Fetches all process logs from the database
 * @returns all process logs
 */
export async function GET() {
  try {
    const logs = await getProcessLogs();
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("Fetch process logs error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch process logs" }, { status: 500 });
  }
}

/**
 * Deletes a process log by its ID
 * @param request ID of the process log to delete in the request body
 * @returns successful response or error message
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = body?.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Invalid process log id" }, { status: 400 });
    }

    await deleteProcessLog(id);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Delete process log error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete process log";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Renames a process log by its ID and new file name
 * @param request 
 * @returns 
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = body?.id;
    const fileName = body?.fileName;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Invalid process log id" }, { status: 400 });
    }

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json({ success: false, error: "Invalid file name" }, { status: 400 });
    }

    const updatedLog = await renameProcessLog(id, fileName);
    return NextResponse.json({ success: true, data: updatedLog });
  } catch (error) {
    console.error("Rename process log error:", error);
    const message = error instanceof Error ? error.message : "Failed to rename process log";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
