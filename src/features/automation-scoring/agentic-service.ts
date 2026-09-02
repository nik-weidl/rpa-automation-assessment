import { prisma } from "@/lib/prisma";
import { callOpenRouter } from "./openrouter";
import { AssessmentType, AutomationLabel } from "@/types/models";
import { calculateLlmCost } from "./utils";

export function formatDuration(ms: number): string {
  if (ms === 0) return "0ms";
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = secs / 60;
  if (mins < 60) return `${mins.toFixed(1)}m`;
  const hours = mins / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function extractBalancedJsonObject(text: string): string {
  let depth = 0;
  let firstBrace = -1;
  let lastBrace = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (firstBrace === -1) firstBrace = i;
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && firstBrace !== -1) {
        lastBrace = i;
        return text.substring(firstBrace, lastBrace + 1);
      }
    }
  }
  if (firstBrace !== -1) return text.substring(firstBrace);
  return text;
}

export function repairTruncatedJson(jsonStr: string): string {
  let clean = jsonStr.trim();
  if (!clean.startsWith("{")) return clean;
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}") {
      if (stack[stack.length - 1] === "}") stack.pop();
    } else if (char === "]") {
      if (stack[stack.length - 1] === "]") stack.pop();
    }
  }
  let repaired = clean;
  if (inString) repaired += "\"";
  while (stack.length > 0) {
    repaired += stack.pop();
  }
  return repaired;
}

export function cleanAndParseJson(content: string): any {
  let cleanText = content.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  cleanText = extractBalancedJsonObject(cleanText);
  cleanText = repairTruncatedJson(cleanText);

  try {
    return JSON.parse(cleanText);
  } catch (firstError: any) {
    try {
      const repairedText = cleanText.replace(/"([^"\\]|\\.)*"/g, (match) =>
        match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
      );
      return JSON.parse(repairedText);
    } catch (secondError: any) {
      throw new Error(`failed to parse JSON: ${firstError.message}. Content was: ${content}`);
    }
  }
}

export interface AgentThinkingStep {
  title: string;
  type: "hypothesis" | "critique" | "retrieval" | "neighbors" | "archetype" | "effort" | "variants" | "rework" | "roi" | "synthesis";
  content: string;
  details?: Record<string, any>;
}

export const AGENTIC_DECISION_JSON_SCHEMA = {
  name: "rpa_agentic_decision_loop",
  strict: true,
  schema: {
    type: "object",
    properties: {
      confidenceScore: { type: "number" },
      label: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
      reasoning: { type: "string" },
      selfCritique: { type: "string" },
      selectedTool: {
        type: "string",
        enum: [
          "RETRIEVE_METRICS",
          "INSPECT_NEIGHBORS",
          "CLASSIFY_ARCHETYPE",
          "INSPECT_TRACE_VARIANTS",
          "ANALYZE_REWORK_LOOPS",
          "SIMULATE_RPA_ROI",
          "FINAL_SYNTHESIS",
        ],
      },
      requestedMetrics: { type: "array", items: { type: "string" } },
    },
    required: [
      "confidenceScore",
      "label",
      "reasoning",
      "selfCritique",
      "selectedTool",
      "requestedMetrics",
    ],
    additionalProperties: false,
  },
};

export const AGENTIC_TURN1_JSON_SCHEMA = AGENTIC_DECISION_JSON_SCHEMA;

export const AGENTIC_TURN4_JSON_SCHEMA = {
  name: "rpa_agentic_turn4_archetype",
  strict: true,
  schema: {
    type: "object",
    properties: {
      rpaArchetype: { type: "string", enum: ["API_INTEGRATION", "UI_AUTOMATION", "IDP_OCR", "HUMAN_IN_THE_LOOP"] },
      rpaArchetypeLabel: { type: "string" },
      implementationEffort: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
      effortRationale: { type: "string" },
      estimatedMonthlyHoursSaved: { type: "number" },
    },
    required: ["rpaArchetype", "rpaArchetypeLabel", "implementationEffort", "effortRationale", "estimatedMonthlyHoursSaved"],
    additionalProperties: false,
  },
};

export const AGENTIC_TURN5_JSON_SCHEMA = {
  name: "rpa_agentic_turn5_synthesis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      score: { type: "number" },
      label: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
      reasoning: { type: "string" },
      risks: { type: "array", items: { type: "string" } },
      missingInfo: { type: "array", items: { type: "string" } },
    },
    required: ["score", "label", "reasoning", "risks", "missingInfo"],
    additionalProperties: false,
  },
};

export const AGENTIC_CRITIQUE_JSON_SCHEMA = {
  name: "rpa_agentic_critique_verification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      calibratedScore: { type: "number" },
      calibratedLabel: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
      critiqueNotes: { type: "string" },
      calibrationRationale: { type: "string" },
      risks: { type: "array", items: { type: "string" } },
      missingInfo: { type: "array", items: { type: "string" } },
    },
    required: [
      "calibratedScore",
      "calibratedLabel",
      "critiqueNotes",
      "calibrationRationale",
      "risks",
      "missingInfo",
    ],
    additionalProperties: false,
  },
};

/**
 * evaluates an activity using a true dynamic agentic loop:
 * - executes a dynamic while (confidenceScore < 85 && turnCount < MAX_TURNS) loop
 * - agent autonomously chooses tools (RETRIEVE_METRICS, INSPECT_NEIGHBORS, CLASSIFY_ARCHETYPE, FINAL_SYNTHESIS)
 * - exits early when confidence >= 85%, saving latency & costs
 */
export async function evaluateActivityWithLLMAgentic(
  activityId: string,
  model: string,
  onStep?: (step: AgentThinkingStep) => void
) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });

  if (!activity) {
    throw new Error(`activity with ID ${activityId} not found`);
  }

  // fetch process log activities for neighbor graph lookup
  const allProcessActivities = await prisma.activity.findMany({
    where: { processLogId: activity.processLogId },
  });

  const stdDev = Math.sqrt(activity.durationVariance);
  const cv = activity.averageDuration > 0 ? stdDev / activity.averageDuration : 0;

  const availableMetrics: Record<string, { value: string | number; description: string }> = {
    frequency: { value: activity.frequency, description: `${activity.frequency} total executions` },
    caseCoverage: { value: `${(activity.caseCoverage * 100).toFixed(1)}%`, description: `${(activity.caseCoverage * 100).toFixed(1)}% of process instances` },
    averageDuration: { value: formatDuration(activity.averageDuration), description: `Average execution duration: ${formatDuration(activity.averageDuration)} (Median: ${formatDuration(activity.medianDuration)})` },
    durationVariance: { value: cv.toFixed(2), description: `Duration Coefficient of Variation (CV): ${cv.toFixed(2)} (Standard Deviation: ${formatDuration(stdDev)}). Low CV (<0.5) indicates standardized timing.` },
    resourceCount: { value: activity.resourceCount, description: `${activity.resourceCount} actors assigned (Allocation Entropy: ${activity.resourceEntropy.toFixed(2)})` },
    resourceEntropy: { value: activity.resourceEntropy.toFixed(2), description: `Resource Allocation Entropy: ${activity.resourceEntropy.toFixed(2)}. Low (<0.5) means dedicated team.` },
    predecessorEntropy: { value: activity.predecessorEntropy.toFixed(2), description: `Incoming Routing Entropy: ${activity.predecessorEntropy.toFixed(2)}. Low (<0.5) means predictable straight-through entry.` },
    successorEntropy: { value: activity.successorEntropy.toFixed(2), description: `Outgoing Routing Entropy: ${activity.successorEntropy.toFixed(2)}. Low (<0.5) means predictable next step.` },
    predecessors: { value: activity.predecessors.join(", ") || "None", description: `Incoming Predecessor Tasks: ${activity.predecessors.join(", ") || "None"}` },
    successors: { value: activity.successors.join(", ") || "None", description: `Outgoing Successor Tasks: ${activity.successors.join(", ") || "None"}` },
  };

  let totalLatencyMs = 0;
  let totalCostUsd = 0;

  const trackUsage = (result: any) => {
    totalLatencyMs += result.latencyMs;
    const cost = result.costUsd ?? calculateLlmCost(model, result.tokens.prompt, result.tokens.completion);
    totalCostUsd += cost;
  };

  const thinkingTrace: AgentThinkingStep[] = [];
  const executedTools = new Set<string>();

  const recordStep = (step: AgentThinkingStep) => {
    thinkingTrace.push(step);
    if (onStep) {
      try {
        onStep(step);
      } catch (err) {
        console.error("error in onStep callback", err);
      }
    }
  };

  let confidenceScore = 0;
  let turnCount = 0;
  const MAX_TURNS = 4;
  let isFinalized = false;

  let currentReasoning = "initial hypothesis forming.";
  let selfCritique = "evaluating initial process data.";
  let currentLabel: AutomationLabel = "MEDIUM";

  let retrievedMetrics: Record<string, { value: string | number; description: string }> = {};
  let neighborDetails: any = null;
  let neighborSummary = "not inspected yet.";

  let rpaArchetype = "UI_AUTOMATION";
  let rpaArchetypeLabel = "UI Automation";
  let implementationEffort = "MEDIUM";
  let effortRationale = "Standard UI automation effort.";
  let estimatedMonthlyHoursSaved = 20;

  // dynamic agentic loop
  while (confidenceScore < 85 && turnCount < MAX_TURNS && !isFinalized) {
    turnCount++;

    const systemPrompt = `You are a senior RPA solution architect in Turn ${turnCount} of a dynamic hypothesis-driven agentic evaluation loop.
Evaluate activity name "${activity.name}".

CRITICAL AGENT INSTRUCTIONS FOR TOOL SELECTION:
1. Do NOT execute tools sequentially or call tools just to check boxes.
2. Formulate a specific hypothesis about why this activity is or is not automatable (e.g. "High variance might be caused by rework self-loops" or "Standardized activity with high initial certainty").
3. ONLY select a tool if its output will explicitly prove or disprove your current hypothesis.
4. If your confidenceScore is already high (>=85%) or if additional tool data will NOT alter your recommendation, select "FINAL_SYNTHESIS" IMMEDIATELY.
5. "confidenceScore" MUST be an INTEGER percentage between 0 and 100 (e.g., 85 for 85%, NOT 0.85).

Guidance on metrics:
- Low Routing Entropy (0.0-0.5) = Straight-through predictable process flow (Ideal for RPA).
- Low Duration CV (0.0-0.5) = Standardized execution times.

Available Tools:
- "RETRIEVE_METRICS": Request quantitative process mining metrics (duration CV, entropy, case coverage).
- "INSPECT_NEIGHBORS": Inspect incoming/outgoing process graph task flow.
- "CLASSIFY_ARCHETYPE": Classify RPA technology strategy & implementation effort tier.
- "INSPECT_TRACE_VARIANTS": Analyze process variants and Happy Path position.
- "ANALYZE_REWORK_LOOPS": Check self-loops and rework severity per case.
- "SIMULATE_RPA_ROI": Calculate annual labor costs, implementation build costs, and payback period in months.
- "FINAL_SYNTHESIS": Synthesize final score and exit loop immediately.

Tools already executed: ${Array.from(executedTools).join(", ") || "None"}
Output JSON matching required schema.`;

    const userPrompt = `Activity Name: "${activity.name}"
Turn ${turnCount} Execution State:
- Current Confidence Score: ${confidenceScore}% (${currentLabel})
- Current Reasoning & Hypothesis: ${currentReasoning}
- Self Critique & Missing Proof: ${selfCritique}
- Retrieved Metrics: ${Object.keys(retrievedMetrics).join(", ") || "None"}
- Neighbor Context: ${neighborSummary}

Formulate your current hypothesis and select the single tool required to prove/disprove it, OR select FINAL_SYNTHESIS if confidence is sufficient.`;

    const decisionResult = await callOpenRouter(model, systemPrompt, userPrompt, {
      type: "json_schema",
      json_schema: AGENTIC_DECISION_JSON_SCHEMA,
    });
    trackUsage(decisionResult);

    const decision = cleanAndParseJson(decisionResult.content);
    let parsedConfidence = typeof decision.confidenceScore === "number" ? decision.confidenceScore : 50;
    if (parsedConfidence > 0 && parsedConfidence <= 1.0) {
      parsedConfidence = Math.round(parsedConfidence * 100);
    }
    confidenceScore = parsedConfidence;

    currentReasoning = typeof decision.reasoning === "string" ? decision.reasoning : currentReasoning;
    selfCritique = typeof decision.selfCritique === "string" ? decision.selfCritique : selfCritique;
    const labelVal = typeof decision.label === "string" ? decision.label.toUpperCase() : "MEDIUM";
    currentLabel = (labelVal === "HIGH" || labelVal === "LOW" ? labelVal : "MEDIUM") as AutomationLabel;

    const selectedTool = typeof decision.selectedTool === "string" ? decision.selectedTool : "FINAL_SYNTHESIS";

    recordStep({
      title: "Hypothesis & Tool Selection",
      type: "hypothesis",
      content: currentReasoning,
      details: { confidenceScore, selectedTool, selfCritique },
    });

    if (selectedTool === "FINAL_SYNTHESIS" || confidenceScore >= 85 || executedTools.has(selectedTool)) {
      isFinalized = true;
      break;
    }

    executedTools.add(selectedTool);

    if (selectedTool === "RETRIEVE_METRICS") {
      const rawRequestedKeys: string[] = Array.isArray(decision.requestedMetrics) ? decision.requestedMetrics : [];
      const requestedMetrics = rawRequestedKeys.filter((k) => k in availableMetrics);
      if (requestedMetrics.length === 0) requestedMetrics.push("durationVariance", "predecessorEntropy", "caseCoverage");

      requestedMetrics.forEach((key) => {
        retrievedMetrics[key] = availableMetrics[key];
      });

      recordStep({
        title: `Tool Execution: Retrieved ${requestedMetrics.length} Process Metrics`,
        type: "retrieval",
        content: `Retrieved metrics from database: ${requestedMetrics.join(", ")}`,
        details: retrievedMetrics,
      });
    } else if (selectedTool === "INSPECT_NEIGHBORS") {
      const neighborPredecessors = allProcessActivities.filter((a) => activity.predecessors.includes(a.name));
      const neighborSuccessors = allProcessActivities.filter((a) => activity.successors.includes(a.name));

      neighborDetails = {
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

      neighborSummary = `Predecessors: ${neighborDetails.predecessors.map((p: any) => `"${p.name}" (avg ${p.avgDuration}, ${p.resourceCount} actors)`).join("; ") || "None"}\nSuccessors: ${neighborDetails.successors.map((s: any) => `"${s.name}" (avg ${s.avgDuration}, ${s.resourceCount} actors)`).join("; ") || "None"}`;

      recordStep({
        title: "Tool Execution: Inspected Process Graph Neighbors",
        type: "neighbors",
        content: `Inspected ${neighborDetails.predecessors.length} predecessor(s) and ${neighborDetails.successors.length} successor(s).`,
        details: neighborDetails,
      });
    } else if (selectedTool === "CLASSIFY_ARCHETYPE") {
      const turn4SystemPrompt = `You are an RPA solution architect in Turn 4 of a dynamic agentic loop.
Classify RPA Technology Archetype and Implementation Effort.`;

      const turn4UserPrompt = `Activity Name: "${activity.name}"
[Retrieved Metrics]: ${Object.entries(retrievedMetrics).map(([k, v]) => `- ${k}: ${v.description}`).join("\n") || "None"}
[Neighbor Flow Context]: ${neighborSummary}`;

      const turn4Result = await callOpenRouter(model, turn4SystemPrompt, turn4UserPrompt, {
        type: "json_schema",
        json_schema: AGENTIC_TURN4_JSON_SCHEMA,
      });
      trackUsage(turn4Result);

      const parsedTurn4 = cleanAndParseJson(turn4Result.content);
      rpaArchetype = typeof parsedTurn4.rpaArchetype === "string" ? parsedTurn4.rpaArchetype : "UI_AUTOMATION";
      rpaArchetypeLabel = typeof parsedTurn4.rpaArchetypeLabel === "string" ? parsedTurn4.rpaArchetypeLabel : "UI Automation";
      implementationEffort = typeof parsedTurn4.implementationEffort === "string" ? parsedTurn4.implementationEffort : "MEDIUM";
      effortRationale = typeof parsedTurn4.effortRationale === "string" ? parsedTurn4.effortRationale : "Moderate effort required.";
      estimatedMonthlyHoursSaved = typeof parsedTurn4.estimatedMonthlyHoursSaved === "number" ? parsedTurn4.estimatedMonthlyHoursSaved : 20;

      recordStep({
        title: "Tool Execution: Classified RPA Archetype & Effort",
        type: "archetype",
        content: `Classified as ${rpaArchetypeLabel} (${rpaArchetype}). Effort: ${implementationEffort}.`,
        details: { rpaArchetype, rpaArchetypeLabel, implementationEffort, effortRationale, estimatedMonthlyHoursSaved },
      });
    } else if (selectedTool === "INSPECT_TRACE_VARIANTS") {
      const traces = await prisma.trace.findMany({
        where: { processLogId: activity.processLogId },
        include: { events: { orderBy: { timestamp: "asc" } } },
      });

      const variantMap = new Map<string, number>();

      traces.forEach((t) => {
        const variantKey = t.events.map((e) => e.activity).join(" -> ");
        variantMap.set(variantKey, (variantMap.get(variantKey) || 0) + 1);
      });

      const sortedVariants = Array.from(variantMap.entries()).sort((a, b) => b[1] - a[1]);
      const totalVariants = sortedVariants.length;
      const topVariantKey = sortedVariants.length > 0 ? sortedVariants[0][0] : "";
      const isOnHappyPath = topVariantKey.includes(activity.name);

      const activityVariantCount = sortedVariants.filter(([vKey]) => vKey.includes(activity.name)).length;
      const happyPathCoverage = traces.length > 0 ? ((sortedVariants[0]?.[1] || 0) / traces.length) * 100 : 0;

      const variantDetails = {
        totalProcessVariants: totalVariants,
        activityVariantCount,
        isOnHappyPath,
        happyPathCoverage: `${happyPathCoverage.toFixed(1)}%`,
        totalCases: traces.length,
      };

      recordStep({
        title: "Tool Execution: Inspected Process Trace Variants",
        type: "variants",
        content: `Activity present in ${activityVariantCount} of ${totalVariants} variants. Happy Path position: ${isOnHappyPath ? "YES (Primary Path)" : "NO (Branch Variant)"}.`,
        details: variantDetails,
      });
    } else if (selectedTool === "ANALYZE_REWORK_LOOPS") {
      const events = await prisma.event.findMany({
        where: {
          trace: { processLogId: activity.processLogId },
          activity: activity.name,
        },
        select: { traceId: true },
      });

      const countsPerTrace: Record<string, number> = {};
      events.forEach((e) => {
        countsPerTrace[e.traceId] = (countsPerTrace[e.traceId] || 0) + 1;
      });

      const totalTraceCountWithAct = Object.keys(countsPerTrace).length;
      const reworkTraces = Object.values(countsPerTrace).filter((cnt) => cnt > 1).length;
      const maxExecutionsInSingleCase = Object.values(countsPerTrace).length > 0 ? Math.max(...Object.values(countsPerTrace)) : 1;
      const reworkPercentage = totalTraceCountWithAct > 0 ? (reworkTraces / totalTraceCountWithAct) * 100 : 0;

      const reworkSeverity = reworkPercentage > 15 ? "HIGH" : reworkPercentage > 5 ? "MEDIUM" : "LOW";

      const reworkDetails = {
        totalActivityCases: totalTraceCountWithAct,
        reworkCaseCount: reworkTraces,
        reworkPercentage: `${reworkPercentage.toFixed(1)}%`,
        maxExecutionsInSingleCase,
        reworkSeverity,
      };

      recordStep({
        title: "Tool Execution: Analyzed Process Rework Loops",
        type: "rework",
        content: `Rework severity: ${reworkSeverity}. ${reworkTraces} case(s) (${reworkPercentage.toFixed(1)}%) required repeat executions (max ${maxExecutionsInSingleCase}x in a single case).`,
        details: reworkDetails,
      });
    } else if (selectedTool === "SIMULATE_RPA_ROI") {
      const totalAnnualHoursSpent = (activity.frequency * (activity.averageDuration / 1000)) / 3600;
      const fteHourlyRate = 45;
      const annualLaborCostUsd = totalAnnualHoursSpent * fteHourlyRate;

      const implementationHours = implementationEffort === "LOW" ? 40 : implementationEffort === "HIGH" ? 300 : 120;
      const devHourlyRate = 75;
      const implementationCostEstUsd = implementationHours * devHourlyRate;

      const netAnnualSavingsUsd = annualLaborCostUsd * 0.8;
      const estimatedPaybackMonths = netAnnualSavingsUsd > 0 ? (implementationCostEstUsd / netAnnualSavingsUsd) * 12 : 99;

      const roiTier = estimatedPaybackMonths <= 6 ? "HIGH_ROI" : estimatedPaybackMonths <= 18 ? "MODERATE_ROI" : "LOW_ROI";

      const roiDetails = {
        totalAnnualHoursSpent: Math.round(totalAnnualHoursSpent),
        annualLaborCostUsd: Math.round(annualLaborCostUsd),
        implementationCostEstUsd: Math.round(implementationCostEstUsd),
        estimatedPaybackMonths: Number(estimatedPaybackMonths.toFixed(1)),
        roiTier,
      };

      recordStep({
        title: "Tool Execution: Simulated RPA Financial ROI & Payback",
        type: "roi",
        content: `Estimated payback period: ${estimatedPaybackMonths.toFixed(1)} month(s) (Tier: ${roiTier}). Annual labor cost: $${Math.round(annualLaborCostUsd).toLocaleString()} for ${Math.round(totalAnnualHoursSpent)} hrs/yr.`,
        details: roiDetails,
      });
    }
  }

  // final synthesis turn
  const turn5SystemPrompt = `You are an expert RPA analyst completing final synthesis of a dynamic agentic loop.
IMPORTANT: "score" MUST be an INTEGER percentage between 0 and 100 (e.g. 88 for 88%, NOT 0.88).
Conclude your reasoning text by explicitly stating the final feasibility score (e.g. 88%) and implementation effort tier (e.g., LOW, MEDIUM, or HIGH).
Synthesize all collected evidence into a final authoritative JSON.`;

  const turn5UserPrompt = `Activity: "${activity.name}"
Final Loop State:
- Confidence: ${confidenceScore}% (${currentLabel})
- Reasoning: ${currentReasoning}
- Critique: ${selfCritique}
- Archetype: ${rpaArchetypeLabel} (Effort: ${implementationEffort})
- Neighbor Context: ${neighborSummary}

Synthesize final score, label, reasoning, risks, and missing info.`;

  const turn5Result = await callOpenRouter(model, turn5SystemPrompt, turn5UserPrompt, {
    type: "json_schema",
    json_schema: AGENTIC_TURN5_JSON_SCHEMA,
  });
  trackUsage(turn5Result);

  const parsedTurn5 = cleanAndParseJson(turn5Result.content);
  let parsedScore = typeof parsedTurn5.score === "number" ? parsedTurn5.score : confidenceScore;
  if (parsedScore > 0 && parsedScore <= 1.0) {
    parsedScore = Math.round(parsedScore * 100);
  }
  const finalScore = parsedScore;
  const finalLabelText = typeof parsedTurn5.label === "string" ? parsedTurn5.label.toUpperCase() : "MEDIUM";
  const finalLabel = (finalLabelText === "HIGH" || finalLabelText === "LOW" ? finalLabelText : "MEDIUM") as AutomationLabel;
  const finalReasoning = typeof parsedTurn5.reasoning === "string" ? parsedTurn5.reasoning : currentReasoning;
  const risks = Array.isArray(parsedTurn5.risks) ? parsedTurn5.risks.map((r: any) => String(r)) : [];
  const missingInfo = Array.isArray(parsedTurn5.missingInfo) ? parsedTurn5.missingInfo.map((m: any) => String(m)) : [];

  recordStep({
    title: "Final Synthesis & Refinement",
    type: "synthesis",
    content: finalReasoning,
    details: {
      finalScore,
      finalLabel,
      implementationEffort,
      rpaArchetype,
      rpaArchetypeLabel,
    },
  });

  // adversarial self-critique turn
  const critiqueSystemPrompt = `You are a Red Team RPA Quality Auditor conducting an adversarial verification audit on a proposed RPA assessment.
Your job is to challenge the proposed feasibility score (Score: ${finalScore}%, Label: ${finalLabel}, Effort: ${implementationEffort}).
Check for:
1. Overconfidence Bias: Is the score unrealistically high despite identified risks or missing documentation?
2. Risk-Score Contradictions: Are there manual exceptions or human judgment steps that contradict a HIGH score?
3. Effort Alignment: Does implementation effort match the technical archetype?

IMPORTANT: "calibratedScore" MUST be an INTEGER percentage between 0 and 100 (e.g. 75 for 75%, NOT 0.75).
If the evaluation holds up, confirm the score. If overconfident, calibrate the score downward.`;

  const critiqueUserPrompt = `Activity: "${activity.name}"
Proposed Assessment:
- Initial Proposed Score: ${finalScore}% (${finalLabel})
- Initial Reasoning: ${finalReasoning}
- Tech Archetype: ${rpaArchetypeLabel} (Effort: ${implementationEffort})
- Identified Risks: ${risks.join("; ") || "None"}
- Missing Information: ${missingInfo.join("; ") || "None"}

Audit this assessment. Return calibratedScore, calibratedLabel, critiqueNotes, calibrationRationale, risks, and missingInfo.`;

  const critiqueResult = await callOpenRouter(model, critiqueSystemPrompt, critiqueUserPrompt, {
    type: "json_schema",
    json_schema: AGENTIC_CRITIQUE_JSON_SCHEMA,
  });
  trackUsage(critiqueResult);

  const parsedCritique = cleanAndParseJson(critiqueResult.content);
  let parsedCalibratedScore = typeof parsedCritique.calibratedScore === "number" ? parsedCritique.calibratedScore : finalScore;
  if (parsedCalibratedScore > 0 && parsedCalibratedScore <= 1.0) {
    parsedCalibratedScore = Math.round(parsedCalibratedScore * 100);
  }
  const calibratedScore = parsedCalibratedScore;
  const calibratedLabelText = typeof parsedCritique.calibratedLabel === "string" ? parsedCritique.calibratedLabel.toUpperCase() : finalLabel;
  const calibratedLabel = (calibratedLabelText === "HIGH" || calibratedLabelText === "LOW" ? calibratedLabelText : "MEDIUM") as AutomationLabel;
  const critiqueNotes = typeof parsedCritique.critiqueNotes === "string" ? parsedCritique.critiqueNotes : "Score verified with high confidence.";
  const finalRisks = Array.isArray(parsedCritique.risks) ? parsedCritique.risks.map((r: any) => String(r)) : risks;
  const finalMissingInfo = Array.isArray(parsedCritique.missingInfo) ? parsedCritique.missingInfo.map((m: any) => String(m)) : missingInfo;

  const combinedReasoning = calibratedScore !== finalScore
    ? `${finalReasoning}\n\n[Adversarial Verification Audit]: Score calibrated from ${finalScore}% to ${calibratedScore}% (${calibratedLabel}). ${critiqueNotes}`
    : `${finalReasoning}\n\n[Adversarial Verification Audit]: Assessment verified at ${calibratedScore}% (${calibratedLabel}). ${critiqueNotes}`;

  recordStep({
    title: "Adversarial Self-Critique & Score Calibration",
    type: "critique",
    content: critiqueNotes,
    details: {
      proposedScore: finalScore,
      calibratedScore,
      calibratedLabel,
      calibrationRationale: critiqueNotes,
      implementationEffort,
      rpaArchetypeLabel,
    },
  });

  await prisma.assessment.deleteMany({
    where: { activityId, type: "LLM_AGENTIC" as AssessmentType, model },
  });

  const rawResponse = {
    turnsExecuted: turnCount,
    confidenceScore,
    currentLabel,
    currentReasoning,
    selfCritique,
    retrievedMetrics,
    neighborDetails,
    rpaArchetype,
    rpaArchetypeLabel,
    implementationEffort,
    effortRationale,
    estimatedMonthlyHoursSaved,
    thinkingTrace,
    synthesisReasoning: finalReasoning,
    critiqueNotes,
    finalScore: calibratedScore,
    finalLabel: calibratedLabel,
    finalReasoning: combinedReasoning,
  };

  const assessment = await prisma.assessment.create({
    data: {
      processLogId: activity.processLogId,
      activityId,
      type: "LLM_AGENTIC" as AssessmentType,
      model,
      score: calibratedScore,
      label: calibratedLabel,
      reasoning: combinedReasoning,
      risks: finalRisks,
      missingInfo: finalMissingInfo,
      latencyMs: totalLatencyMs,
      costUsd: totalCostUsd,
      rawResponse: rawResponse as any,
    },
  });

  await prisma.processLog.update({
    where: { id: activity.processLogId },
    data: { updatedAt: new Date() },
  });

  return assessment;
}
