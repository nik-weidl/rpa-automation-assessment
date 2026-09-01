import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callOpenRouter } from "@/features/automation-scoring/openrouter";
import {
  AGENTIC_TURN1_JSON_SCHEMA,
  AGENTIC_TURN4_JSON_SCHEMA,
  AGENTIC_TURN5_JSON_SCHEMA,
  formatDuration,
  cleanAndParseJson,
} from "@/features/automation-scoring/agentic-service";
import { AssessmentType, AutomationLabel } from "@/types/models";
import { calculateLlmCost } from "@/features/automation-scoring/utils";

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

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      return NextResponse.json(
        { success: false, error: `activity ${activityId} not found` },
        { status: 404 }
      );
    }

    const allProcessActivities = await prisma.activity.findMany({
      where: { processLogId: activity.processLogId },
    });

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (eventData: any) => {
          const formatted = `data: ${JSON.stringify(eventData)}\n\n`;
          controller.enqueue(new TextEncoder().encode(formatted));
        };

        let totalLatencyMs = 0;
        let totalCostUsd = 0;

        const trackUsage = (result: any) => {
          totalLatencyMs += result.latencyMs;
          const cost = result.costUsd ?? calculateLlmCost(model, result.tokens.prompt, result.tokens.completion);
          totalCostUsd += cost;
        };

        try {
          const stdDev = Math.sqrt(activity.durationVariance);
          const cv = activity.averageDuration > 0 ? stdDev / activity.averageDuration : 0;

          const availableMetrics: Record<string, { value: string | number; description: string }> = {
            frequency: { value: activity.frequency, description: `${activity.frequency} total executions` },
            caseCoverage: { value: `${(activity.caseCoverage * 100).toFixed(1)}%`, description: `${(activity.caseCoverage * 100).toFixed(1)}% of process instances` },
            averageDuration: { value: formatDuration(activity.averageDuration), description: `Average execution duration: ${formatDuration(activity.averageDuration)} (Median: ${formatDuration(activity.medianDuration)})` },
            durationVariance: { value: cv.toFixed(2), description: `Duration Coefficient of Variation (CV): ${cv.toFixed(2)} (Standard Deviation: ${formatDuration(stdDev)})` },
            resourceCount: { value: activity.resourceCount, description: `${activity.resourceCount} actors assigned (Allocation Entropy: ${activity.resourceEntropy.toFixed(2)})` },
            resourceEntropy: { value: activity.resourceEntropy.toFixed(2), description: `Resource Allocation Entropy: ${activity.resourceEntropy.toFixed(2)}` },
            predecessorEntropy: { value: activity.predecessorEntropy.toFixed(2), description: `Incoming Routing Entropy: ${activity.predecessorEntropy.toFixed(2)}` },
            successorEntropy: { value: activity.successorEntropy.toFixed(2), description: `Outgoing Routing Entropy: ${activity.successorEntropy.toFixed(2)}` },
            predecessors: { value: activity.predecessors.join(", ") || "None", description: `Incoming Predecessor Tasks: ${activity.predecessors.join(", ") || "None"}` },
            successors: { value: activity.successors.join(", ") || "None", description: `Outgoing Successor Tasks: ${activity.successors.join(", ") || "None"}` },
          };

          // step 1: initial semantic hypothesis & self-critique
          const turn1SystemPrompt = `You are a senior RPA solution architect in a 6-Step Agentic Evaluation Loop.
Formulate an initial assessment for the target activity name and identify potential blindspots or missing quantitative proof.
Output a JSON object matching the required schema.`;

          const turn1UserPrompt = `Activity Name: "${activity.name}"\nExecute Turn 1: Formulate initial hypothesis and critique.`;
          const turn1Result = await callOpenRouter(model, turn1SystemPrompt, turn1UserPrompt, {
            type: "json_schema",
            json_schema: AGENTIC_TURN1_JSON_SCHEMA,
          });
          trackUsage(turn1Result);

          const parsedTurn1 = cleanAndParseJson(turn1Result.content);
          const initialScore = typeof parsedTurn1.initialScore === "number" ? parsedTurn1.initialScore : 50;
          const initialLabel = (typeof parsedTurn1.initialLabel === "string" ? parsedTurn1.initialLabel.toUpperCase() : "MEDIUM") as AutomationLabel;
          const initialReasoning = typeof parsedTurn1.initialReasoning === "string" ? parsedTurn1.initialReasoning : "Initial hypothesis formed.";
          const selfCritique = typeof parsedTurn1.selfCritique === "string" ? parsedTurn1.selfCritique : "Analyzing quantitative metrics.";

          const rawRequestedKeys: string[] = Array.isArray(parsedTurn1.requestedMetrics) ? parsedTurn1.requestedMetrics : [];
          const requestedMetrics = rawRequestedKeys.filter((k) => k in availableMetrics);
          if (requestedMetrics.length === 0) requestedMetrics.push("durationVariance", "predecessorEntropy", "caseCoverage");

          sendEvent({
            type: "step",
            step: {
              title: "Initial Semantic Hypothesis",
              type: "hypothesis",
              content: initialReasoning,
              details: { initialScore, initialLabel },
            },
          });

          sendEvent({
            type: "step",
            step: {
              title: "Self-Critique & Blindspot Identification",
              type: "critique",
              content: selfCritique,
            },
          });

          // step 2: quantitative metric retrieval (tool call 1)
          const retrievedMetrics: Record<string, { value: string | number; description: string }> = {};
          requestedMetrics.forEach((key) => {
            retrievedMetrics[key] = availableMetrics[key];
          });

          sendEvent({
            type: "step",
            step: {
              title: "Quantitative Metric Retrieval (Tool Call 1)",
              type: "retrieval",
              content: `Retrieved ${requestedMetrics.length} metrics from database: ${requestedMetrics.join(", ")}`,
              details: retrievedMetrics,
            },
          });

          // step 3: neighbor graph inspection (tool call 2)
          const neighborPredecessors = allProcessActivities.filter((a) => activity.predecessors.includes(a.name));
          const neighborSuccessors = allProcessActivities.filter((a) => activity.successors.includes(a.name));

          const neighborDetails = {
            predecessors: neighborPredecessors.map((p) => ({
              name: p.name,
              avgDuration: formatDuration(p.averageDuration),
              resourceCount: p.resourceCount,
            })),
            successors: neighborSuccessors.map((s) => ({
              name: s.name,
              avgDuration: formatDuration(s.averageDuration),
              resourceCount: s.resourceCount,
            })),
          };

          const neighborSummary = `Predecessors: ${neighborDetails.predecessors.map((p) => `"${p.name}" (avg ${p.avgDuration}, ${p.resourceCount} actors)`).join("; ") || "None"}\nSuccessors: ${neighborDetails.successors.map((s) => `"${s.name}" (avg ${s.avgDuration}, ${s.resourceCount} actors)`).join("; ") || "None"}`;

          sendEvent({
            type: "step",
            step: {
              title: "Neighbor Process Graph Context (Tool Call 2)",
              type: "neighbors",
              content: `Inspected ${neighborDetails.predecessors.length} predecessor(s) and ${neighborDetails.successors.length} successor(s) in process map.`,
              details: neighborDetails,
            },
          });

          // step 4: rpa technology archetype & effort classification
          const turn4SystemPrompt = `You are an RPA solution architect in Turn 4 of a 6-Step Agentic Loop.
Determine:
1. RPA Technology Archetype ("API_INTEGRATION" | "UI_AUTOMATION" | "IDP_OCR" | "HUMAN_IN_THE_LOOP")
2. Implementation Effort Tier ("LOW" | "MEDIUM" | "HIGH")
3. Archetype Rationale & Estimated Hours Saved per month.
Output a JSON object matching the required schema.`;

          const turn4UserPrompt = `Activity Name: "${activity.name}"
[Retrieved Metrics]:
${Object.entries(retrievedMetrics).map(([k, v]) => `- ${k}: ${v.description}`).join("\n")}

[Neighbor Process Flow Context]:
${neighborSummary}

Classify RPA Technology Archetype and Implementation Effort.`;

          const turn4Result = await callOpenRouter(model, turn4SystemPrompt, turn4UserPrompt, {
            type: "json_schema",
            json_schema: AGENTIC_TURN4_JSON_SCHEMA,
          });
          trackUsage(turn4Result);

          const parsedTurn4 = cleanAndParseJson(turn4Result.content);
          const rpaArchetype = typeof parsedTurn4.rpaArchetype === "string" ? parsedTurn4.rpaArchetype : "UI_AUTOMATION";
          const rpaArchetypeLabel = typeof parsedTurn4.rpaArchetypeLabel === "string" ? parsedTurn4.rpaArchetypeLabel : "UI Automation";
          const implementationEffort = typeof parsedTurn4.implementationEffort === "string" ? parsedTurn4.implementationEffort : "MEDIUM";
          const effortRationale = typeof parsedTurn4.effortRationale === "string" ? parsedTurn4.effortRationale : "Moderate effort required.";
          const estimatedMonthlyHoursSaved = typeof parsedTurn4.estimatedMonthlyHoursSaved === "number" ? parsedTurn4.estimatedMonthlyHoursSaved : 20;

          sendEvent({
            type: "step",
            step: {
              title: "RPA Technology Archetype & Effort Tiering",
              type: "archetype",
              content: `Classified as ${rpaArchetypeLabel} (${rpaArchetype}). Implementation effort: ${implementationEffort}.`,
              details: {
                rpaArchetype,
                rpaArchetypeLabel,
                implementationEffort,
                effortRationale,
                estimatedMonthlyHoursSaved,
              },
            },
          });

          // step 5: final synthesis & score refinement
          const turn5SystemPrompt = `You are an expert RPA analyst completing Turn 5 of a 6-Step Agentic Loop.
Synthesize initial hypothesis, self-critique, quantitative metrics, neighbor graph context, RPA archetype (${rpaArchetypeLabel}), and effort tier (${implementationEffort}).
Produce final JSON matching the required schema.`;

          const turn5UserPrompt = `Activity: "${activity.name}"
Hypothesis: ${initialScore}% (${initialLabel})
Critique: ${selfCritique}
Archetype: ${rpaArchetypeLabel} (Effort: ${implementationEffort})
Neighbor Context: ${neighborSummary}

Synthesize and produce final authoritative evaluation.`;

          const turn5Result = await callOpenRouter(model, turn5SystemPrompt, turn5UserPrompt, {
            type: "json_schema",
            json_schema: AGENTIC_TURN5_JSON_SCHEMA,
          });
          trackUsage(turn5Result);

          const parsedTurn5 = cleanAndParseJson(turn5Result.content);
          const score = typeof parsedTurn5.score === "number" ? parsedTurn5.score : initialScore;
          const labelText = typeof parsedTurn5.label === "string" ? parsedTurn5.label.toUpperCase() : "MEDIUM";
          const label = (labelText === "HIGH" || labelText === "LOW" ? labelText : "MEDIUM") as AutomationLabel;
          const reasoning = typeof parsedTurn5.reasoning === "string" ? parsedTurn5.reasoning : initialReasoning;
          const risks = Array.isArray(parsedTurn5.risks) ? parsedTurn5.risks.map((r: any) => String(r)) : [];
          const missingInfo = Array.isArray(parsedTurn5.missingInfo) ? parsedTurn5.missingInfo.map((m: any) => String(m)) : [];

          sendEvent({
            type: "step",
            step: {
              title: "Final Synthesis & Refinement",
              type: "synthesis",
              content: reasoning,
              details: { finalScore: score, finalLabel: label },
            },
          });

          const thinkingTrace = [
            { title: "Initial Semantic Hypothesis", type: "hypothesis", content: initialReasoning, details: { initialScore, initialLabel } },
            { title: "Self-Critique & Blindspot Identification", type: "critique", content: selfCritique },
            { title: "Quantitative Metric Retrieval (Tool Call 1)", type: "retrieval", content: `Retrieved ${requestedMetrics.length} metrics from database: ${requestedMetrics.join(", ")}`, details: retrievedMetrics },
            { title: "Neighbor Process Graph Context (Tool Call 2)", type: "neighbors", content: `Inspected ${neighborDetails.predecessors.length} predecessor(s) and ${neighborDetails.successors.length} successor(s) in process map.`, details: neighborDetails },
            { title: "RPA Technology Archetype & Effort Tiering", type: "archetype", content: `Classified as ${rpaArchetypeLabel} (${rpaArchetype}). Implementation effort: ${implementationEffort}.`, details: { rpaArchetype, rpaArchetypeLabel, implementationEffort, effortRationale, estimatedMonthlyHoursSaved } },
            { title: "Final Synthesis & Refinement", type: "synthesis", content: reasoning, details: { finalScore: score, finalLabel: label } },
          ];

          await prisma.assessment.deleteMany({
            where: { activityId, type: "LLM_AGENTIC" as AssessmentType, model },
          });

          const rawResponse = {
            initialScore, initialLabel, initialReasoning, selfCritique, requestedMetrics, retrievedMetrics, neighborDetails, rpaArchetype, rpaArchetypeLabel, implementationEffort, effortRationale, estimatedMonthlyHoursSaved, thinkingTrace, finalScore: score, finalLabel: label, finalReasoning: reasoning,
          };

          const assessment = await prisma.assessment.create({
            data: {
              processLogId: activity.processLogId,
              activityId,
              type: "LLM_AGENTIC" as AssessmentType,
              model,
              score,
              label,
              reasoning,
              risks,
              missingInfo,
              latencyMs: totalLatencyMs,
              costUsd: totalCostUsd,
              rawResponse: rawResponse as any,
            },
          });

          await prisma.processLog.update({
            where: { id: activity.processLogId },
            data: { updatedAt: new Date() },
          });

          sendEvent({ type: "complete", data: assessment });
        } catch (err: any) {
          sendEvent({ type: "error", error: err.message || "Failed to execute agentic evaluation" });
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
      { success: false, error: error.message || "Failed to initiate streaming" },
      { status: 500 }
    );
  }
}
