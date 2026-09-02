import { prisma } from "@/lib/prisma";
import { XesLog } from "@/types/domain";
import { AssessmentType, AutomationLabel } from "@/types/models";

type ActivityStats = {
  name: string;
  frequency: number;
  durations: number[]; // non-null durations (in ms) for events at index > 0
  resources: string[];
  cases: Set<string>;
  predecessors: Map<string, number>;
  successors: Map<string, number>;
};

/**
 * Calculates activity profiles and persists traces, events, and profiles in a database transaction.
 * @param processLogId The ProcessLog database ID
 * @param parsedLog The parsed XesLog domain object
 */
export async function calculateAndStoreActivityProfiles(
  processLogId: string,
  parsedLog: XesLog
): Promise<void> {
  // sort events chronologically per trace to ensure correct duration/transition mapping.
  const sortedTraces = parsedLog.traces.map((trace) => {
    const sortedEvents = [...trace.events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    return {
      ...trace,
      events: sortedEvents,
    };
  });

  // calculate statistics in memory
  const statsMap = new Map<string, ActivityStats>();

  for (const trace of sortedTraces) {
    const events = trace.events;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const activityName = event.activity;

      let stats = statsMap.get(activityName);
      if (!stats) {
        stats = {
          name: activityName,
          frequency: 0,
          durations: [],
          resources: [],
          cases: new Set(),
          predecessors: new Map(),
          successors: new Map(),
        };
        statsMap.set(activityName, stats);
      }

      stats.frequency += 1;
      stats.cases.add(trace.caseId);

      if (event.resource) {
        stats.resources.push(event.resource);
      }

      // elapsed duration from predecessor event in trace
      if (i > 0) {
        const duration = event.timestamp.getTime() - events[i - 1].timestamp.getTime();
        stats.durations.push(duration);

        // track predecessor transition
        const pred = events[i - 1].activity;
        stats.predecessors.set(pred, (stats.predecessors.get(pred) || 0) + 1);
      }

      // track successor transition
      if (i < events.length - 1) {
        const succ = events[i + 1].activity;
        stats.successors.set(succ, (stats.successors.get(succ) || 0) + 1);
      }
    }
  }

  const totalTracesCount = parsedLog.traces.length;

  const activitiesData = Array.from(statsMap.values()).map((stats) => {
    const durations = stats.durations;
    let minDuration = 0;
    let maxDuration = 0;
    let averageDuration = 0;
    let medianDuration = 0;
    let durationVariance = 0;

    if (durations.length > 0) {
      let minD = Infinity;
      let maxD = -Infinity;
      let sumD = 0;

      for (let i = 0; i < durations.length; i++) {
        const d = durations[i];
        if (d < minD) minD = d;
        if (d > maxD) maxD = d;
        sumD += d;
      }

      minDuration = minD === Infinity ? 0 : minD;
      maxDuration = maxD === -Infinity ? 0 : maxD;
      averageDuration = sumD / durations.length;

      let sumSq = 0;
      for (let i = 0; i < durations.length; i++) {
        sumSq += Math.pow(durations[i] - averageDuration, 2);
      }
      durationVariance = sumSq / durations.length;

      // calculate median duration safely
      const sorted = [...durations].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianDuration = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // resources and Resource Entropy
    const uniqueResources = Array.from(new Set(stats.resources));
    const resourceFreq = new Map<string, number>();
    stats.resources.forEach((r) => {
      resourceFreq.set(r, (resourceFreq.get(r) || 0) + 1);
    });
    const totalResourceEvents = stats.resources.length;
    let resourceEntropy = 0;
    if (totalResourceEvents > 0) {
      for (const count of resourceFreq.values()) {
        const p = count / totalResourceEvents;
        resourceEntropy -= p * Math.log2(p);
      }
    }

    // predecessor Entropy
    const totalPreds = Array.from(stats.predecessors.values()).reduce((sum, val) => sum + val, 0);
    let predecessorEntropy = 0;
    if (totalPreds > 0) {
      for (const count of stats.predecessors.values()) {
        const p = count / totalPreds;
        predecessorEntropy -= p * Math.log2(p);
      }
    }

    // successor Entropy
    const totalSuccs = Array.from(stats.successors.values()).reduce((sum, val) => sum + val, 0);
    let successorEntropy = 0;
    if (totalSuccs > 0) {
      for (const count of stats.successors.values()) {
        const p = count / totalSuccs;
        successorEntropy -= p * Math.log2(p);
      }
    }

    // predecessors list and successors list (unique names)
    const predecessors = Array.from(stats.predecessors.keys());
    const successors = Array.from(stats.successors.keys());

    return {
      processLogId,
      name: stats.name,
      frequency: stats.frequency,
      caseCoverage: totalTracesCount > 0 ? stats.cases.size / totalTracesCount : 0,
      averageDuration,
      medianDuration,
      minDuration,
      maxDuration,
      resourceCount: uniqueResources.length,
      resources: uniqueResources,
      predecessors,
      successors,
      durationVariance,
      resourceEntropy,
      predecessorEntropy,
      successorEntropy,
    };
  });

  // Sample up to 3,000 traces for raw DB storage to prevent DB parameter/lock overflows on huge logs (e.g. 150k+ traces)
  const sampledTraces = sortedTraces.slice(0, 3000);

  // database ingestion transaction with 60s timeout
  await prisma.$transaction(async (tx) => {
    // 1. delete any existing traces and assessments for this process log (for clean overwrites)
    await tx.assessment.deleteMany({
      where: { processLogId },
    });
    await tx.trace.deleteMany({
      where: { processLogId },
    });
    await tx.activity.deleteMany({
      where: { processLogId },
    });

    // 2. batch insert Traces in chunks of 1000
    const tracesCreated: any[] = [];
    const CHUNK_SIZE = 1000;

    for (let i = 0; i < sampledTraces.length; i += CHUNK_SIZE) {
      const chunk = sampledTraces.slice(i, i + CHUNK_SIZE);
      const inserted = await tx.trace.createManyAndReturn({
        data: chunk.map((trace) => ({
          caseId: trace.caseId,
          processLogId,
        })),
      });
      tracesCreated.push(...inserted);
    }

    // 3. map caseId to the inserted Trace ID
    const caseIdToTraceId = new Map<string, string>();
    for (const t of tracesCreated) {
      caseIdToTraceId.set(t.caseId, t.id);
    }

    // 4. flatten and batch insert Events in chunks of 1000
    const eventsData = [];
    for (const trace of sampledTraces) {
      const traceId = caseIdToTraceId.get(trace.caseId);
      if (!traceId) continue;

      for (const event of trace.events) {
        eventsData.push({
          traceId,
          activity: event.activity,
          resource: event.resource || null,
          timestamp: event.timestamp,
          attributes: (event.attributes || {}) as any,
        });
      }
    }

    for (let i = 0; i < eventsData.length; i += CHUNK_SIZE) {
      const chunk = eventsData.slice(i, i + CHUNK_SIZE);
      await tx.event.createMany({
        data: chunk,
      });
    }

    // 5. batch insert Activity Profiles and get created items
    let activitiesCreated: any[] = [];
    if (activitiesData.length > 0) {
      activitiesCreated = await tx.activity.createManyAndReturn({
        data: activitiesData,
      });
    }

    // 6. calculate and store Rule-Based Assessments
    if (activitiesCreated.length > 0) {
      const maxFreq = Math.max(...activitiesCreated.map((a) => a.frequency), 1);
      const maxAvgDuration = Math.max(...activitiesCreated.map((a) => a.averageDuration), 1);
      const maxEntropy = Math.max(
        ...activitiesCreated.map((a) => Math.max(a.predecessorEntropy, a.successorEntropy)),
        1
      );
      const maxResourceEntropy = Math.max(...activitiesCreated.map((a) => a.resourceEntropy), 1);

      const assessmentsData = [];

      for (const act of activitiesCreated) {
        // compute individual scores between 0.0 and 1.0
        const scoreCoverage = act.caseCoverage;

        const avgEntropy = (act.predecessorEntropy + act.successorEntropy) / 2;
        const normalizedEntropy = maxEntropy > 0 ? avgEntropy / maxEntropy : 0;
        const scoreComplexity = Math.max(0, 1 - normalizedEntropy);

        const scoreDuration = Math.log(act.averageDuration + 1) / Math.log(maxAvgDuration + 1);
        const scoreFrequency = Math.log(act.frequency + 1) / Math.log(maxFreq + 1);

        const stdDev = Math.sqrt(act.durationVariance);
        const cv = act.averageDuration > 0 ? stdDev / act.averageDuration : 0;
        // cv closer to 0 indicates high predictability (exponential decay score)
        const scorePredictability = Math.exp(-cv);

        const normalizedResourceEntropy = maxResourceEntropy > 0 ? act.resourceEntropy / maxResourceEntropy : 0;
        const scoreResource = Math.max(0, 1 - normalizedResourceEntropy);

        // weighted formula using Delphi expert weights scaled to 100%
        const score =
          (scoreCoverage * 0.264 +
            scoreComplexity * 0.241 +
            scoreDuration * 0.195 +
            scoreFrequency * 0.184 +
            scorePredictability * 0.103 +
            scoreResource * 0.013) *
          100;

        const finalScore = Math.round(score * 10) / 10;
        const label = (finalScore >= 70 ? "HIGH" : finalScore >= 40 ? "MEDIUM" : "LOW") as AutomationLabel;

        // generate dynamic, user-facing explanation paragraphs
        const reasons = [];
        if (act.caseCoverage >= 0.8) {
          reasons.push(`is highly standardized, appearing in most cases (coverage: ${Math.round(act.caseCoverage * 100)}%)`);
        } else if (act.caseCoverage < 0.4) {
          reasons.push(`has low case coverage (${Math.round(act.caseCoverage * 100)}%), suggesting it is an optional or exceptional step`);
        }

        if (avgEntropy < 0.8) {
          reasons.push("has low sequence branching complexity, representing a highly predictable operational path");
        } else if (avgEntropy > 2.0) {
          reasons.push("has high branching complexity, indicating many different preceding or succeeding activities");
        }

        if (act.frequency > maxFreq * 0.5) {
          reasons.push(`is highly repetitive (frequency: ${act.frequency.toLocaleString()}x)`);
        }

        if (cv < 0.3 && act.averageDuration > 1000) {
          reasons.push("exhibits highly predictable execution times");
        } else if (cv > 1.5) {
          reasons.push("has significant duration variance, representing inconsistent manual performance");
        }

        let reasoning = "";
        if (reasons.length > 0) {
          reasoning = `This activity ${reasons.join(", and ")}.`;
        } else {
          reasoning = "This activity has typical execution frequency and complexity patterns.";
        }

        if (finalScore >= 70) {
          reasoning += " It is a prime candidate for robotic process automation due to its high predictability and volume.";
        } else if (finalScore >= 40) {
          reasoning += " It represents a moderate candidate for automation; standardizing its logic or reducing exceptions is recommended first.";
        } else {
          reasoning += " It is not recommended for automation in its current state due to high complexity, low frequency, or high variability.";
        }

        assessmentsData.push({
          processLogId,
          activityId: act.id,
          type: "RULE_BASED" as AssessmentType,
          score: finalScore,
          label,
          reasoning,
          risks: [],
          missingInfo: [],
        });
      }

      await tx.assessment.createMany({
        data: assessmentsData,
      });
    }
  }, {
    timeout: 60000,
  });
}
