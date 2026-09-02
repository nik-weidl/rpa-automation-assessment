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
      rpaArchetype: { type: "string", enum: ["API_INTEGRATION", "UI_AUTOMATION", "IDP_OCR", "HUMAN_IN_THE_LOOP"] },
      rpaArchetypeLabel: { type: "string" },
      implementationEffort: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
      reasoning: { type: "string" },
      risks: { type: "array", items: { type: "string" } },
      missingInfo: { type: "array", items: { type: "string" } },
    },
    required: ["score", "label", "rpaArchetype", "rpaArchetypeLabel", "implementationEffort", "reasoning", "risks", "missingInfo"],
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
      rpaArchetype: { type: "string", enum: ["API_INTEGRATION", "UI_AUTOMATION", "IDP_OCR", "HUMAN_IN_THE_LOOP"] },
      rpaArchetypeLabel: { type: "string" },
      implementationEffort: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
      critiqueNotes: { type: "string" },
      calibrationRationale: { type: "string" },
      requiresReevaluation: { type: "boolean" },
      suggestedToolToReinspect: {
        type: "string",
        enum: [
          "RETRIEVE_METRICS",
          "INSPECT_NEIGHBORS",
          "CLASSIFY_ARCHETYPE",
          "INSPECT_TRACE_VARIANTS",
          "ANALYZE_REWORK_LOOPS",
          "SIMULATE_RPA_ROI",
          "NONE",
        ],
      },
      risks: { type: "array", items: { type: "string" } },
      missingInfo: { type: "array", items: { type: "string" } },
    },
    required: [
      "calibratedScore",
      "calibratedLabel",
      "rpaArchetype",
      "rpaArchetypeLabel",
      "implementationEffort",
      "critiqueNotes",
      "calibrationRationale",
      "requiresReevaluation",
      "suggestedToolToReinspect",
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

  // fetch Rule-Based assessment for statistical baseline anchoring
  const ruleBasedAssessment = await prisma.assessment.findFirst({
    where: {
      activityId,
      type: "RULE_BASED",
    },
  });
  const ruleBasedScore = ruleBasedAssessment ? Math.round(ruleBasedAssessment.score) : 65;
  const ruleBasedLabel = ruleBasedAssessment ? ruleBasedAssessment.label : "MEDIUM";

  const stdDev = Math.sqrt(activity.durationVariance);
  const cv = activity.averageDuration > 0 ? stdDev / activity.averageDuration : 0;

  const availableMetrics: Record<string, { value: string | number; description: string }> = {
    ruleBasedBaseline: { value: `${ruleBasedScore}% (${ruleBasedLabel})`, description: `Statistical Rule-Based Feasibility Score: ${ruleBasedScore}% (${ruleBasedLabel}) calculated from Delphi consensus process mining weights.` },
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
  const MAX_TURNS = 6;
  let reevaluationCount = 0;
  const MAX_REEVALUATIONS = 2;

  let currentReasoning = "initial hypothesis forming.";
  let selfCritique = "evaluating initial process data.";
  let calibratedScore = ruleBasedScore;
  let calibratedLabel: AutomationLabel = ruleBasedLabel as AutomationLabel;
  let finalReasoning = "";
  let combinedReasoning = "";
  let finalRisks: string[] = [];
  let finalMissingInfo: string[] = [];
  let critiqueNotes = "";
  let currentLabel: AutomationLabel = ruleBasedLabel as AutomationLabel;

  let retrievedMetrics: Record<string, { value: string | number; description: string }> = {};
  let neighborDetails: any = null;
  let neighborSummary = "not inspected yet.";

  let rpaArchetype = "UI_AUTOMATION";
  let rpaArchetypeLabel = "UI Automation";
  let implementationEffort = "MEDIUM";
  let effortRationale = "Standard UI automation effort.";
  let estimatedMonthlyHoursSaved = 20;

  let evaluationComplete = false;

  // master evaluation loop supporting critique-driven re-entry
  while (!evaluationComplete && reevaluationCount <= MAX_REEVALUATIONS) {
    // inner dynamic tool selection loop
    while (confidenceScore < 90 && turnCount < MAX_TURNS) {
    turnCount++;

    const historySummary = thinkingTrace.length > 0
      ? thinkingTrace.map((s, i) => `Step ${i + 1} [${s.title}] (${s.type}): ${s.content}`).join("\n")
      : "No prior steps executed yet.";

    const systemPrompt = `You are a senior RPA solution architect in Turn ${turnCount} of a dynamic hypothesis-driven agentic evaluation loop.
Evaluate activity name "${activity.name}".

STATISTICAL BENCHMARK CONTEXT:
- For reference, the statistical rule-based calculation for this activity is ${ruleBasedScore}% (${ruleBasedLabel}).
- Formulate your OWN independent agentic hypothesis and feasibility score based on multi-tool process evidence, semantic task context, trace variants, rework loops, and domain safety.
- You may agree with, refine, or diverge from the rule-based benchmark whenever your process mining evidence and semantic reasoning justify it.

CRITICAL AGENT INSTRUCTIONS FOR TOOL SELECTION:
1. Do NOT execute tools sequentially or call tools just to check boxes.
2. Formulate a specific hypothesis about why this activity is or is not automatable (e.g. "High variance might be caused by rework self-loops" or "Standardized activity with high initial certainty").
3. ONLY select a tool if its output will explicitly prove or disprove your current hypothesis.
4. If your confidenceScore is already high (>=90%) or if additional tool data will NOT alter your recommendation, select "FINAL_SYNTHESIS" IMMEDIATELY.
5. "confidenceScore" MUST be an INTEGER percentage between 0 and 100 (e.g., 90 for 90%, NOT 0.90).

FLEXIBLE REFERENCE GUIDELINES (Reference Aid Only - Do NOT force into rigid buckets):
- Evaluate on a continuous 0-100% feasibility spectrum based on organic process evidence. Use metrics as reference aids:
  * High Feasibility (~70-100%): Predictable straight-through flow, low routing entropy (<0.5), low duration CV (<0.5), minimal rework (<5%).
  * Medium Feasibility (~50-69%): Standard administrative tasks, moderate entropy (0.5-1.0), moderate duration CV (0.5-1.0), minor rework (5-15%).
  * Low Feasibility (~0-49%): Unstructured inputs, high routing entropy (>1.0), high duration CV (>1.0), severe rework (>15%).

CRITICAL SAFETY & DOMAIN HAZARD EVALUATION:
- Evaluate domain risks: Health & Patient Safety, High Financial Capital Risk, Mission-Critical Operations.
- If high-hazard domain risks exist without mandatory human approval checkpoints, enforce the "HUMAN_IN_THE_LOOP" technology archetype.
- DO NOT artificially crash technical feasibility scores simply because human oversight is required. Technical feasibility reflects task structure and standardization, while safety is enforced by assigning the "HUMAN_IN_THE_LOOP" archetype and documenting required human approval checkpoints.

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

Prior Execution Trace & Verification Memory:
${historySummary}

Formulate your current hypothesis and select the single tool required to prove/disprove it, OR select FINAL_SYNTHESIS if confidence is sufficient.`;

    const decisionResult = await callOpenRouter(model, systemPrompt, userPrompt, {
      type: "json_schema",
      json_schema: AGENTIC_DECISION_JSON_SCHEMA,
    });
    trackUsage(decisionResult);

    const parsedDecision = cleanAndParseJson(decisionResult.content);
    let parsedConfidence = typeof parsedDecision.confidenceScore === "number" ? parsedDecision.confidenceScore : 50;
    if (parsedConfidence > 0 && parsedConfidence <= 1.0) {
      parsedConfidence = Math.round(parsedConfidence * 100);
    }
    confidenceScore = parsedConfidence;

    const labelText = typeof parsedDecision.label === "string" ? parsedDecision.label.toUpperCase() : "MEDIUM";
    currentLabel = (labelText === "HIGH" || labelText === "LOW" ? labelText : "MEDIUM") as AutomationLabel;
    currentReasoning = typeof parsedDecision.reasoning === "string" ? parsedDecision.reasoning : currentReasoning;
    selfCritique = typeof parsedDecision.selfCritique === "string" ? parsedDecision.selfCritique : selfCritique;

    const selectedTool = typeof parsedDecision.selectedTool === "string" ? parsedDecision.selectedTool : "FINAL_SYNTHESIS";

    recordStep({
      title: `Hypothesis Formulation & Tool Selection`,
      type: "hypothesis",
      content: `Hypothesis: ${currentReasoning}\nSelf Critique: ${selfCritique}`,
      details: {
        confidenceScore,
        currentLabel,
        selectedTool,
      },
    });

    if (selectedTool === "FINAL_SYNTHESIS") {
      break;
    }

    executedTools.add(selectedTool);

    if (selectedTool === "RETRIEVE_METRICS") {
      const rawRequestedKeys: string[] = Array.isArray(parsedDecision.requestedMetrics) ? parsedDecision.requestedMetrics : [];
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
      const turn4SystemPrompt = `You are an RPA solution architect in Turn ${turnCount} of a dynamic agentic loop.
Evaluate activity name "${activity.name}".
Classify technology archetype, implementation effort tier (LOW, MEDIUM, HIGH), rationale, and estimated monthly hours saved.`;

      const turn4UserPrompt = `Activity: "${activity.name}"
Retrieved Context: ${JSON.stringify(retrievedMetrics)}
Process Graph: ${neighborSummary}

Return JSON with rpaArchetype, rpaArchetypeLabel, implementationEffort, effortRationale, estimatedMonthlyHoursSaved.`;

      const turn4Result = await callOpenRouter(model, turn4SystemPrompt, turn4UserPrompt, {
        type: "json_schema",
        json_schema: AGENTIC_TURN4_JSON_SCHEMA,
      });
      trackUsage(turn4Result);

      const parsedTurn4 = cleanAndParseJson(turn4Result.content);
      rpaArchetype = typeof parsedTurn4.rpaArchetype === "string" ? parsedTurn4.rpaArchetype : "UI_AUTOMATION";
      rpaArchetypeLabel = typeof parsedTurn4.rpaArchetypeLabel === "string" ? parsedTurn4.rpaArchetypeLabel : "UI Automation";
      implementationEffort = typeof parsedTurn4.implementationEffort === "string" ? parsedTurn4.implementationEffort : "MEDIUM";
      effortRationale = typeof parsedTurn4.effortRationale === "string" ? parsedTurn4.effortRationale : "Standard effort.";
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
        select: { id: true },
      });
      const traceIds = traces.map((t) => t.id);
      const events = await prisma.event.findMany({
        where: { traceId: { in: traceIds } },
        orderBy: { timestamp: "asc" },
      });

      const traceSequenceMap: Record<string, string[]> = {};
      events.forEach((e) => {
        if (!traceSequenceMap[e.traceId]) traceSequenceMap[e.traceId] = [];
        traceSequenceMap[e.traceId].push(e.activity);
      });

      const variantCounts: Record<string, number> = {};
      Object.values(traceSequenceMap).forEach((seq) => {
        const key = seq.join(" -> ");
        variantCounts[key] = (variantCounts[key] || 0) + 1;
      });

      const sortedVariants = Object.entries(variantCounts).sort((a, b) => b[1] - a[1]);
      const activityVariantCount = sortedVariants.filter(([vKey]) => vKey.includes(activity.name)).length;

      recordStep({
        title: "Tool Execution: Inspected Process Trace Variants",
        type: "variants",
        content: `Activity present in ${activityVariantCount} of ${sortedVariants.length} total process variants.`,
        details: { totalVariants: sortedVariants.length, activityVariantCount },
      });
    } else if (selectedTool === "ANALYZE_REWORK_LOOPS") {
      const events = await prisma.event.findMany({
        where: { trace: { processLogId: activity.processLogId }, activity: activity.name },
        select: { traceId: true },
      });

      const countsPerTrace: Record<string, number> = {};
      events.forEach((e) => {
        countsPerTrace[e.traceId] = (countsPerTrace[e.traceId] || 0) + 1;
      });

      const reworkTraces = Object.values(countsPerTrace).filter((cnt) => cnt > 1).length;
      recordStep({
        title: "Tool Execution: Analyzed Process Rework Loops",
        type: "rework",
        content: `Identified ${reworkTraces} case(s) requiring repeat executions.`,
        details: { reworkTraces },
      });
    } else if (selectedTool === "SIMULATE_RPA_ROI") {
      const totalAnnualHoursSpent = (activity.frequency * (activity.averageDuration / 1000)) / 3600;
      const annualLaborCostUsd = totalAnnualHoursSpent * 45;
      recordStep({
        title: "Tool Execution: Simulated Financial RPA ROI",
        type: "roi",
        content: `Simulated annual labor cost savings of $${Math.round(annualLaborCostUsd).toLocaleString()}.`,
        details: { annualLaborCostUsd },
      });
    }
  }

    // Synthesis turn
    const turn5SystemPrompt = `You are a senior RPA solution architect conducting final synthesis in an agentic evaluation loop.
Evaluate activity "${activity.name}".

STATISTICAL BENCHMARK CONTEXT:
- Statistical Rule-Based Benchmark: ${ruleBasedScore}% (${ruleBasedLabel}).
- Use this benchmark as reference context, but synthesize your OWN independent feasibility score based on your collected multi-tool evidence (metrics, graph context, rework loops, trace variants, and domain safety rules).

FEASIBILITY EVALUATION GUIDELINES (Reference Aids Only - Continuous 0-100% Scale):
1. Evaluate feasibility organically on a continuous 0-100% scale based on specific process evidence. Use metrics as flexible aids, NOT rigid buckets:
   - High Feasibility (~70-100%): Predictable flow, low entropy (<0.5), low duration CV (<0.5).
   - Medium Feasibility (~50-69%): Moderate flow, standard form/data intake, minor exception loops.
   - Low Feasibility (~0-49%): Unstructured inputs, high routing entropy (>1.0), severe rework loops.
2. Domain Safety & Archetypes:
   - If human oversight is required for domain safety (e.g. clinical data or financial approvals), assign "HUMAN_IN_THE_LOOP" archetype.
   - DO NOT artificially penalize technical feasibility scores simply because human oversight is required. Feasibility measures technical task structure and standardization; safety risk is addressed by assigning the "HUMAN_IN_THE_LOOP" archetype.
3. "score" MUST be an INTEGER percentage between 0 and 100 (e.g., 68 for 68%).`;

    const turn5UserPrompt = `Activity: "${activity.name}"
Collected Execution Evidence:
- Statistical Rule-Based Benchmark: ${ruleBasedScore}% (${ruleBasedLabel})
- Initial Confidence & Reasoning: ${currentReasoning}
- Self Critique: ${selfCritique}
- Retrieved Metrics: ${JSON.stringify(retrievedMetrics)}
- Process Graph: ${neighborSummary}
- Tech Archetype: ${rpaArchetypeLabel} (Effort: ${implementationEffort})

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
    finalReasoning = typeof parsedTurn5.reasoning === "string" ? parsedTurn5.reasoning : currentReasoning;
    if (typeof parsedTurn5.rpaArchetype === "string") rpaArchetype = parsedTurn5.rpaArchetype;
    if (typeof parsedTurn5.rpaArchetypeLabel === "string") rpaArchetypeLabel = parsedTurn5.rpaArchetypeLabel;
    if (typeof parsedTurn5.implementationEffort === "string") implementationEffort = parsedTurn5.implementationEffort;

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
    const critiqueSystemPrompt = `You are a Senior RPA Verification & Quality Auditor conducting an objective quality audit on a proposed RPA assessment.
Your goal is to verify score accuracy, enforce domain safety, and eliminate bias.

CRITICAL VERIFICATION RULES:
1. Evaluate score accuracy independently based on evidence quality and reasoning soundness.
2. The statistical rule-based score (${ruleBasedScore}%) serves as benchmark reference context. If the agent's proposed score diverges from the benchmark, confirm that the divergence is supported by clear empirical evidence (e.g. severe rework loops, trace variant fragmentation, or clinical safety hazards).
3. DO NOT force scores into rigid artificial boundaries. Evaluate score accuracy organically on a continuous 0-100% scale using process evidence as a reference aid.
4. SAFETY AUDIT (HEALTH, FINANCIAL & MISSION-CRITICAL SAFETY):
   - Inspect whether this activity involves Health/Life Safety (e.g. clinical data mutation), High Financial Capital Risk (e.g. un-audited fund transfers, high-value invoice approvals), or Mission-Critical irreversible system operations.
   - If high-hazard domain risks exist, enforce the "HUMAN_IN_THE_LOOP" archetype.
   - DO NOT artificially penalize the technical feasibility score simply because human-in-the-loop oversight is mandated. Feasibility measures technical task structure and standardization; safety risk is addressed by assigning the "HUMAN_IN_THE_LOOP" archetype and specifying human validation steps.
5. RE-EVALUATION RE-ENTRY:
   - If you identify an un-inspected contradiction or un-verified tool gap (e.g., proposed high score without checking rework loops or trace variants), set "requiresReevaluation": true and "suggestedToolToReinspect" to the required tool.
   - Otherwise, set "requiresReevaluation": false and "suggestedToolToReinspect": "NONE".
6. "calibratedScore" MUST be an INTEGER percentage between 0 and 100 (e.g. 68 for 68%, NOT 0.68).`;

    const critiqueUserPrompt = `Activity: "${activity.name}"
Proposed Assessment:
- Initial Proposed Score: ${finalScore}% (${finalLabel})
- Initial Reasoning: ${finalReasoning}
- Tech Archetype: ${rpaArchetypeLabel} (Effort: ${implementationEffort})
- Identified Risks: ${risks.join("; ") || "None"}
- Missing Information: ${missingInfo.join("; ") || "None"}

Audit this assessment. Return calibratedScore, calibratedLabel, rpaArchetype, rpaArchetypeLabel, implementationEffort, critiqueNotes, calibrationRationale, requiresReevaluation, suggestedToolToReinspect, risks, and missingInfo.`;

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
    calibratedScore = parsedCalibratedScore;
    const calibratedLabelText = typeof parsedCritique.calibratedLabel === "string" ? parsedCritique.calibratedLabel.toUpperCase() : finalLabel;
    calibratedLabel = (calibratedLabelText === "HIGH" || calibratedLabelText === "LOW" ? calibratedLabelText : "MEDIUM") as AutomationLabel;
    if (typeof parsedCritique.rpaArchetype === "string") rpaArchetype = parsedCritique.rpaArchetype;
    if (typeof parsedCritique.rpaArchetypeLabel === "string") rpaArchetypeLabel = parsedCritique.rpaArchetypeLabel;
    if (typeof parsedCritique.implementationEffort === "string") implementationEffort = parsedCritique.implementationEffort;

    critiqueNotes = typeof parsedCritique.critiqueNotes === "string" ? parsedCritique.critiqueNotes : "Score verified with high confidence.";
    finalRisks = Array.isArray(parsedCritique.risks) ? parsedCritique.risks.map((r: any) => String(r)) : risks;
    finalMissingInfo = Array.isArray(parsedCritique.missingInfo) ? parsedCritique.missingInfo.map((m: any) => String(m)) : missingInfo;

    combinedReasoning = calibratedScore !== finalScore
      ? `${finalReasoning}\n\n[Adversarial Verification Audit]: Score calibrated from ${finalScore}% to ${calibratedScore}% (${calibratedLabel}). ${critiqueNotes}`
      : `${finalReasoning}\n\n[Adversarial Verification Audit]: Assessment verified at ${calibratedScore}% (${calibratedLabel}). ${critiqueNotes}`;

    const requiresReevaluation = Boolean(parsedCritique.requiresReevaluation);
    const suggestedTool = typeof parsedCritique.suggestedToolToReinspect === "string" ? parsedCritique.suggestedToolToReinspect : "NONE";

    if (requiresReevaluation && reevaluationCount < MAX_REEVALUATIONS && turnCount < MAX_TURNS && suggestedTool !== "NONE") {
      reevaluationCount++;
      confidenceScore = 50; // Force loop re-entry
      currentReasoning = `Quality Audit Re-Evaluation (Iteration ${reevaluationCount}): Verification Audit requested tool ${suggestedTool}. Note: "${critiqueNotes}".`;
      selfCritique = critiqueNotes;

      recordStep({
        title: `Critique Feedback: Re-entering Loop (Iteration ${reevaluationCount})`,
        type: "critique",
        content: critiqueNotes,
        details: {
          reevaluationCount,
          suggestedTool,
          critiqueNotes,
        },
      });

      continue; // Re-enters master loop for another tool turn with full trace memory!
    }

    recordStep({
      title: "Quality Oversight & Verification Audit",
      type: "critique",
      content: critiqueNotes,
      details: {
        proposedScore: finalScore,
        calibratedScore,
        calibratedLabel,
        rpaArchetype,
        rpaArchetypeLabel,
        implementationEffort,
      },
    });

    evaluationComplete = true;
  }

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
