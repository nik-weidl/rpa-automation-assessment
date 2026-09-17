import { prisma } from "@/lib/prisma";
import { callOpenRouter } from "./openrouter";
import { AssessmentType, AutomationLabel } from "@/types/models";
import { calculateLlmCost } from "./utils";

// format milliseconds to a human-readable duration string
function formatDuration(ms: number): string {
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

function extractBalancedJsonObject(text: string): string {
  let depth = 0;
  let firstBrace = -1;
  let lastBrace = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (firstBrace === -1) {
        firstBrace = i;
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && firstBrace !== -1) {
        lastBrace = i;
        return text.substring(firstBrace, lastBrace + 1);
      }
    }
  }

  // if the string ends but we never reached depth 0, return everything from first brace to try and repair it
  if (firstBrace !== -1) {
    return text.substring(firstBrace);
  }

  return text;
}

function repairTruncatedJson(jsonStr: string): string {
  let clean = jsonStr.trim();
  if (!clean.startsWith("{")) return clean;

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      stack.push("}");
    } else if (char === "[") {
      stack.push("]");
    } else if (char === "}") {
      if (stack[stack.length - 1] === "}") {
        stack.pop();
      }
    } else if (char === "]") {
      if (stack[stack.length - 1] === "]") {
        stack.pop();
      }
    }
  }

  let repaired = clean;
  if (inString) {
    repaired += "\"";
  }

  // pop and append missing closing structures in reverse order
  while (stack.length > 0) {
    const closingChar = stack.pop();
    repaired += closingChar;
  }

  return repaired;
}

function cleanAndParseJson(content: string): any {
  let cleanText = content.trim();

  // remove markdown code block wrappers if present
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  // 1. Extract first balanced JSON object to handle trailing garbage/extra braces
  cleanText = extractBalancedJsonObject(cleanText);

  // 2. Auto-close truncated JSON objects/arrays if the response was cut off
  cleanText = repairTruncatedJson(cleanText);

  try {
    return JSON.parse(cleanText);
  } catch (firstError: any) {
    // if standard parse fails, try to repair raw control characters (newlines, tabs) within string literals
    try {
      const repairedText = cleanText.replace(/"([^"\\]|\\.)*"/g, (match) => {
        // escape raw newlines and tabs inside the double-quoted string value
        return match
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t");
      });
      return JSON.parse(repairedText);
    } catch (secondError: any) {
      throw new Error(`failed to parse JSON: ${firstError.message}. Content was: ${content}`);
    }
  }
}

export const SINGLE_SHOT_JSON_SCHEMA = {
  name: "rpa_single_shot_assessment",
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

/**
 * evaluates a process activity's automation potential using single-shot LLM prompts
 */
export async function evaluateActivityWithLLMSingleShot(
  activityId: string,
  model: string,
  options?: {
    includeRuleBaseline?: boolean;
  }
) {
  const includeRuleBaseline = options?.includeRuleBaseline ?? true;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });

  if (!activity) {
    throw new Error(`activity with ID ${activityId} not found`);
  }

  // fetch Rule-Based assessment for baseline anchoring if enabled
  let ruleBasedScore: number | null = null;
  let ruleBasedLabel: string | null = null;

  if (includeRuleBaseline) {
    const ruleBasedAssessment = await prisma.assessment.findFirst({
      where: {
        activityId,
        type: "RULE_BASED",
      },
    });
    if (ruleBasedAssessment) {
      ruleBasedScore = Math.round(ruleBasedAssessment.score);
      ruleBasedLabel = ruleBasedAssessment.label;
    }
  }

  const stdDev = Math.sqrt(activity.durationVariance);
  const cv = activity.averageDuration > 0 ? stdDev / activity.averageDuration : 0;

  const systemPrompt = `You are an expert robotic process automation (RPA) analyst conducting an objective technical evaluation of process activity automatability.
Evaluate the given activity on a continuous feasibility scale of 0 to 100 based on supplied process mining metrics and semantic task requirements.
Assess feasibility using standard process mining evaluation criteria:
1. Process Standardization & Volume: Case coverage percentage and execution frequency.
2. Structural & Routing Complexity: Incoming and outgoing path entropy (higher entropy indicates non-standard branching and routing friction).
3. Timing Predictability: Average duration and Coefficient of Variation (CV) (higher CV indicates inconsistent execution timing).
4. Cognitive & Decision Requirements: Assess whether task semantics indicate deterministic rule-based processing vs. subjective human discretion.
5. Technical Handoffs: Evaluate system interaction complexity implied by the task label.

Score Guidelines:
- High Feasibility (67-100%): Standardized, predictable, highly repetitive rule-based tasks.
- Medium Feasibility (34-66%): Semi-structured administrative tasks with moderate routing or timing variation.
- Low Feasibility (0-33%): Unstructured, highly variable tasks requiring human discretion or complex decision-making.

You must output a strict JSON object with this format, containing no other text:
{
  "score": 85, // number from 0 to 100
  "label": "HIGH", // "HIGH", "MEDIUM", or "LOW"
  "reasoning": "A concise paragraph explaining the assessment based on metrics and semantic analysis.",
  "risks": [
    "A list of key risks (e.g. system changes, complex decision rules, sensitive data, security compliance)."
  ],
  "missingInfo": [
    "A list of additional details required from the business to finalize feasibility (e.g., standard operating procedures, exception rates)."
  ]
}`;

  const userPrompt = `Please evaluate this process activity:
- Name: "${activity.name}"
${ruleBasedScore !== null ? `- Statistical Rule-Based Baseline Score: ${ruleBasedScore}% (${ruleBasedLabel}) (derived from deterministic process mining weights)\n` : ""}- Frequency: ${activity.frequency} executions
- Case Coverage: ${(activity.caseCoverage * 100).toFixed(1)}% of process instances
- Predecessor Steps: ${activity.predecessors.join(", ") || "None"} (Incoming Path Entropy: ${activity.predecessorEntropy.toFixed(2)})
- Successor Steps: ${activity.successors.join(", ") || "None"} (Outgoing Path Entropy: ${activity.successorEntropy.toFixed(2)})
- Average Execution Duration: ${formatDuration(activity.averageDuration)} (Median: ${formatDuration(activity.medianDuration)})
- Duration Predictability (CV): ${cv.toFixed(2)} (Standard Deviation: ${formatDuration(stdDev)})
- Resource Count: ${activity.resourceCount} actors (Allocation Entropy: ${activity.resourceEntropy.toFixed(2)})`;

  // execute request using OpenRouter client
  const llmResult = await callOpenRouter(
    model,
    systemPrompt,
    userPrompt,
    {
      type: "json_schema",
      json_schema: SINGLE_SHOT_JSON_SCHEMA,
    }
  );

  const parsedResponse = cleanAndParseJson(llmResult.content);

  // validate parsed content attributes
  const score = typeof parsedResponse.score === "number" ? parsedResponse.score : 0;
  const labelText = typeof parsedResponse.label === "string" ? parsedResponse.label.toUpperCase() : "MEDIUM";
  const label = (labelText === "HIGH" || labelText === "LOW" ? labelText : "MEDIUM") as AutomationLabel;
  const reasoning = typeof parsedResponse.reasoning === "string" ? parsedResponse.reasoning : "no reasoning provided";
  const risks = Array.isArray(parsedResponse.risks)
    ? parsedResponse.risks.map((r: any) => String(r))
    : [];
  const missingInfo = Array.isArray(parsedResponse.missingInfo)
    ? parsedResponse.missingInfo.map((m: any) => String(m))
    : [];

  // clean up old assessment for this specific activity, type, model, and rule context state
  const existingSingleShot = await prisma.assessment.findMany({
    where: {
      activityId,
      type: "LLM_SINGLE_SHOT" as AssessmentType,
      model,
    },
  });
  const toDeleteSingleShot = existingSingleShot.filter(
    (a) => ((a.rawResponse as any)?.includeRuleBaseline !== false) === includeRuleBaseline
  );
  if (toDeleteSingleShot.length > 0) {
    await prisma.assessment.deleteMany({
      where: {
        id: { in: toDeleteSingleShot.map((a) => a.id) },
      },
    });
  }

  // Calculate 70/30 Hybrid Score for un-anchored independent evaluations (70% Rule + 30% Independent LLM)
  let hybridScore: number | null = null;
  if (!includeRuleBaseline) {
    const ruleBasedAssessment = await prisma.assessment.findFirst({
      where: {
        activityId,
        type: "RULE_BASED" as AssessmentType,
      },
    });
    if (ruleBasedAssessment) {
      hybridScore = Math.round(0.70 * ruleBasedAssessment.score + 0.30 * score);
    }
  }

  // insert the assessment
  const assessment = await prisma.assessment.create({
    data: {
      processLogId: activity.processLogId,
      activityId,
      type: "LLM_SINGLE_SHOT" as AssessmentType,
      model,
      score,
      hybridScore,
      label,
      reasoning,
      risks,
      missingInfo,
      latencyMs: llmResult.latencyMs,
      costUsd: llmResult.costUsd ?? calculateLlmCost(model, llmResult.tokens.prompt, llmResult.tokens.completion),
      rawResponse: {
        includeRuleBaseline,
        ruleBasedScore,
        ruleBasedLabel,
        hybridScore,
        ...parsedResponse,
      } as any,
    },
  });

  // update parent ProcessLog updatedAt timestamp to invalidate transition-graph cache
  await prisma.processLog.update({
    where: { id: activity.processLogId },
    data: { updatedAt: new Date() },
  });

  return assessment;
}
