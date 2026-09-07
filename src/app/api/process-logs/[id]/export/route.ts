import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();

    const processLog = await prisma.processLog.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: { name: "asc" },
        },
        assessments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!processLog) {
      return NextResponse.json({ success: false, error: "Process log not found" }, { status: 404 });
    }

    const sanitizedName = processLog.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

    if (format === "json") {
      const jsonData = {
        id: processLog.id,
        name: processLog.name,
        fileName: processLog.fileName,
        fileSize: processLog.fileSize,
        status: processLog.status,
        createdAt: processLog.createdAt.toISOString(),
        activitiesCount: processLog.activities.length,
        assessmentsCount: processLog.assessments.length,
        activities: processLog.activities.map((act) => {
          const actAssessments = processLog.assessments.filter((a) => a.activityId === act.id);
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
            assessments: actAssessments.map((a) => {
              const rawObj = typeof a.rawResponse === "object" ? (a.rawResponse as any) : {};
              const includeRuleBaseline = a.type === "RULE_BASED" ? false : rawObj?.includeRuleBaseline !== false;
              const evaluationContext = a.type === "RULE_BASED" ? "RULE_BASED" : (includeRuleBaseline ? "RULE_CONTEXT" : "INDEPENDENT");
              return {
                id: a.id,
                type: a.type,
                model: a.model || "N/A",
                evaluationContext,
                includeRuleBaseline,
                score: a.score,
                label: a.label,
                reasoning: a.reasoning,
                risks: a.risks,
                missingInfo: a.missingInfo,
                latencyMs: a.latencyMs,
                costUsd: a.costUsd,
                rawResponse: a.rawResponse,
                createdAt: a.createdAt.toISOString(),
              };
            }),
          };
        }),
      };

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="rpa_assessment_${sanitizedName}.json"`,
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
      "EvaluationContext",
      "IncludeRuleBaseline",
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

    for (const act of processLog.activities) {
      const actAssessments = processLog.assessments.filter((a) => a.activityId === act.id);
      
      if (actAssessments.length === 0) {
        const row = [
          escapeCsv(processLog.id),
          escapeCsv(processLog.name),
          escapeCsv(processLog.fileName),
          escapeCsv(act.id),
          escapeCsv(act.name),
          act.frequency,
          act.caseCoverage.toFixed(4),
          act.averageDuration.toFixed(2),
          act.durationVariance ? act.durationVariance.toFixed(4) : "0",
          act.resourceEntropy ? act.resourceEntropy.toFixed(4) : "0",
          act.predecessorEntropy ? act.predecessorEntropy.toFixed(4) : "0",
          act.successorEntropy ? act.successorEntropy.toFixed(4) : "0",
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          '""',
          escapeCsv(act.createdAt.toISOString()),
        ];
        csvRows.push(row.join(","));
      } else {
        for (const a of actAssessments) {
          const rawObj = typeof a.rawResponse === "object" ? (a.rawResponse as any) : {};
          const includeRuleBaseline = a.type === "RULE_BASED" ? false : rawObj?.includeRuleBaseline !== false;
          const evaluationContext = a.type === "RULE_BASED" ? "RULE_BASED" : (includeRuleBaseline ? "RULE_CONTEXT" : "INDEPENDENT");

          const row = [
            escapeCsv(processLog.id),
            escapeCsv(processLog.name),
            escapeCsv(processLog.fileName),
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
            escapeCsv(evaluationContext),
            includeRuleBaseline ? "TRUE" : "FALSE",
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

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rpa_assessment_${sanitizedName}.csv"`,
      },
    });
  } catch (err: any) {
    console.error("Export process log API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
