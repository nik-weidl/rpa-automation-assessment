import { NextRequest, NextResponse } from "next/server";
import { uploadXESFile } from "@/features/upload/service";
import { ApiResponse } from "@/types/api";
import { ProcessLog } from "@/types/models";

export const dynamic = 'force-dynamic';

/**
 * Handles POST requests for uploading XES files
 * @param request xes file and process name in form data
 * @returns sucessful response with ProcessLog or error message
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ProcessLog>>> {
  try {
    const formData = await request.formData();

    const { processLog } = await uploadXESFile(formData);

    return NextResponse.json(
      {
        success: true,
        data: processLog,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}

/**
 * Handles GET requests for fetching process logs
 * @returns log data or error message
 */
export async function GET(): Promise<NextResponse<ApiResponse<ProcessLog[]>>> {
  try {
    const { getProcessLogs } = await import("@/features/upload/service");
    const logs = await getProcessLogs();

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch process logs",
      },
      { status: 500 }
    );
  }
}
