import { prisma } from "@/lib/prisma";
import { callOpenRouter } from "./openrouter";
import { AssessmentType, AutomationLabel } from "@/types/models";

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

function cleanAndParseJson(content: string): any {
  let cleanText = content.trim();

  // remove markdown code block wrappers if present
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  // isolate first { and last } to remove conversational headers/footers
  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

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

/**
 * evaluates a process activity's automation potential using single-shot LLM prompts
 */
export async function evaluateActivityWithLLMSingleShot(
  activityId: string,
  model: string
) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });

  if (!activity) {
    throw new Error(`activity with ID ${activityId} not found`);
  }

  const stdDev = Math.sqrt(activity.durationVariance);
  const cv = activity.averageDuration > 0 ? stdDev / activity.averageDuration : 0;

  const systemPrompt = `You are an expert robotic process automation (RPA) and process mining analyst. Your task is to evaluate process activities for their automation potential.
Evaluate the given activity on a scale of 0 to 100 based on both quantitative metrics (supplied in the request) and semantic evaluation of the activity's name and context.
Consider the following criteria from automation feasibility literature:
1. Standardization: Is the step highly standardized (high case coverage, low sequencing variation)?
2. Repetitiveness & Volume: Does the step execute frequently (high occurrence frequency)?
3. Complexity & Branching: Does the step have predictable predecessors and successors? High path entropy indicates high complexity.
4. Time Savings: Is the execution duration long enough to justify automating?
5. Predictability: Is the execution time consistent (low duration variance / coefficient of variation)?
6. Cognitive Requirements: Does the activity name suggest standard rule-based processing (high potential) or subjective human decision-making (low potential)?
7. System Involvement: Does the task label imply OCR or data entry across systems?

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
- Frequency: ${activity.frequency} executions
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
    { type: "json_object" }
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

  // clean up old assessment for this specific activity, type and model
  await prisma.assessment.deleteMany({
    where: {
      activityId,
      type: "LLM_SINGLE_SHOT" as AssessmentType,
      model,
    },
  });

  // insert the assessment
  const assessment = await prisma.assessment.create({
    data: {
      processLogId: activity.processLogId,
      activityId,
      type: "LLM_SINGLE_SHOT" as AssessmentType,
      model,
      score,
      label,
      reasoning,
      risks,
      missingInfo,
      latencyMs: llmResult.latencyMs,
      costUsd: llmResult.costUsd,
      rawResponse: parsedResponse as any,
    },
  });

  return assessment;
}
