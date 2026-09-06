import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();

    // Fetch all process logs with activities and assessments
    const processLogs = await prisma.processLog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        activities: {
          orderBy: { name: "asc" },
        },
        assessments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (format === "json") {
      const jsonData = processLogs.map((log) => ({
        id: log.id,
        name: log.name,
        fileName: log.fileName,
        fileSize: log.fileSize,
        status: log.status,
        createdAt: log.createdAt.toISOString(),
        activitiesCount: log.activities.length,
        assessmentsCount: log.assessments.length,
        activities: log.activities.map((act) => {
          const actAssessments = log.assessments.filter((a) => a.activityId === act.id);
          return {
            id: act.id,
            name: act.name,
            frequency: act.frequency,
            caseCoverage: act.caseCoverage,
            averageDuration: act.averageDuration,
            medianDuration: act.medianDuration,
            minDuration: act.minDuration,
            maxDuration: act.maxDuration,
            resourceCount: act.resourceCount,
            durationVariance: act.durationVariance,
            resourceEntropy: act.resourceEntropy,
            predecessorEntropy: act.predecessorEntropy,
            successorEntropy: act.successorEntropy,
            assessments: actAssessments.map((a) => ({
              id: a.id,
              type: a.type,
              model: a.model || "N/A",
              score: a.score,
              label: a.label,
              reasoning: a.reasoning,
              risks: a.risks,
              missingInfo: a.missingInfo,
              latencyMs: a.latencyMs,
              costUsd: a.costUsd,
              createdAt: a.createdAt.toISOString(),
            })),
          };
        }),
      }));

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="rpa_assessment_all_logs_${Date.now()}.json"`,
        },
      });
    }

    // Default: CSV format
    const csvRows: string[] = [];
    const headers = [
      "ProcessLogId",
      "ProcessLogName",
      "FileName",
      "ActivityId",
      "ActivityName",
      "Frequency",
      "CaseCoverage",
      "AverageDurationMs",
      "DurationVariance",
      "ResourceEntropy",
      "PredecessorEntropy",
      "SuccessorEntropy",
      "AssessmentId",
      "AssessmentType",
      "Model",
      "FeasibilityScore",
      "AutomationLabel",
      "Reasoning",
      "Risks",
      "MissingInfo",
      "LatencyMs",
      "CostUSD",
      "CreatedAt",
    ];

    csvRows.push(headers.join(","));

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    for (const log of processLogs) {
      for (const act of log.activities) {
        const actAssessments = log.assessments.filter((a) => a.activityId === act.id);
        
        if (actAssessments.length === 0) {
          // Row with profile metrics only
          const row = [
            escapeCsv(log.id),
            escapeCsv(log.name),
            escapeCsv(log.fileName),
            escapeCsv(act.id),
            escapeCsv(act.name),
            act.frequency,
            act.caseCoverage.toFixed(4),
            act.averageDuration.toFixed(2),
            act.durationVariance ? act.durationVariance.toFixed(4) : "0",
            act.resourceEntropy ? act.resourceEntropy.toFixed(4) : "0",
            act.predecessorEntropy ? act.predecessorEntropy.toFixed(4) : "0",
            act.successorEntropy ? act.successorEntropy.toFixed(4) : "0",
            '""', // AssessmentId
            '""', // AssessmentType
            '""', // Model
            '""', // Score
            '""', // Label
            '""', // Reasoning
            '""', // Risks
            '""', // MissingInfo
            '""', // LatencyMs
            '""', // CostUSD
            escapeCsv(act.createdAt.toISOString()),
          ];
          csvRows.push(row.join(","));
        } else {
          for (const a of actAssessments) {
            const row = [
              escapeCsv(log.id),
              escapeCsv(log.name),
              escapeCsv(log.fileName),
              escapeCsv(act.id),
              escapeCsv(act.name),
              act.frequency,
              act.caseCoverage.toFixed(4),
              act.averageDuration.toFixed(2),
              act.durationVariance ? act.durationVariance.toFixed(4) : "0",
              act.resourceEntropy ? act.resourceEntropy.toFixed(4) : "0",
              act.predecessorEntropy ? act.predecessorEntropy.toFixed(4) : "0",
              act.successorEntropy ? act.successorEntropy.toFixed(4) : "0",
              escapeCsv(a.id),
              escapeCsv(a.type),
              escapeCsv(a.model || "N/A"),
              a.score,
              escapeCsv(a.label),
              escapeCsv(a.reasoning),
              escapeCsv(a.risks?.join(" | ") || ""),
              escapeCsv(a.missingInfo?.join(" | ") || ""),
              a.latencyMs ?? "",
              a.costUsd ? a.costUsd.toFixed(6) : "0.000000",
              escapeCsv(a.createdAt.toISOString()),
            ];
            csvRows.push(row.join(","));
          }
        }
      }
    }

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rpa_assessment_all_logs_${Date.now()}.csv"`,
      },
    });
  } catch (err: any) {
    console.error("Export API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
