import { prisma } from "@/lib/prisma";
import { XesLog } from "@/types/domain";

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
      minDuration = Math.min(...durations);
      maxDuration = Math.max(...durations);
      averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      durationVariance =
        durations.reduce((sum, d) => sum + Math.pow(d - averageDuration, 2), 0) /
        durations.length;

      // calculate median duration
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

  // database ingestion transaction (increase timeout to 60s for large files)
  await prisma.$transaction(async (tx) => {
    // 1. delete any existing traces for this process log (for clean overwrites)
    await tx.trace.deleteMany({
      where: { processLogId },
    });
    await tx.activity.deleteMany({
      where: { processLogId },
    });

    // 2. batch insert Traces and retrieve database IDs using createManyAndReturn
    const tracesCreated = await tx.trace.createManyAndReturn({
      data: sortedTraces.map((trace) => ({
        caseId: trace.caseId,
        processLogId,
      })),
    });

    // 3. map caseId to the inserted Trace ID
    const caseIdToTraceId = new Map<string, string>();
    for (const t of tracesCreated) {
      caseIdToTraceId.set(t.caseId, t.id);
    }

    // 4. flatten and batch insert Events
    const eventsData = [];
    for (const trace of sortedTraces) {
      const traceId = caseIdToTraceId.get(trace.caseId);
      if (!traceId) continue;

      for (const event of trace.events) {
        eventsData.push({
          traceId,
          activity: event.activity,
          resource: event.resource || null,
          timestamp: event.timestamp,
          attributes: event.attributes || {},
        });
      }
    }

    if (eventsData.length > 0) {
      await tx.event.createMany({
        data: eventsData,
      });
    }

    // 5. batch insert Activity Profiles
    if (activitiesData.length > 0) {
      await tx.activity.createMany({
        data: activitiesData,
      });
    }
  }, {
    timeout: 60000,
  });
}
