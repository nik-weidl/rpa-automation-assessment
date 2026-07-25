import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// in-memory cache with self-invalidation via ProcessLog.updatedAt
type CacheEntry = {
  updatedAt: number;
  graphData: any;
};
const transitionGraphCache = new Map<string, CacheEntry>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await params;
  const processLogId = resolvedParams.id;

  if (!processLogId) {
    return NextResponse.json(
      { success: false, error: "Missing processLogId" },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const assessmentType = url.searchParams.get("assessmentType") || "RULE_BASED";
  const model = url.searchParams.get("model");
  const cacheKey = `${processLogId}-${assessmentType}-${model || "none"}`;

  try {
    // only select id and updatedAt for ultra-fast cache validation
    const processLog = await prisma.processLog.findUnique({
      where: { id: processLogId },
      select: { id: true, updatedAt: true },
    });

    if (!processLog) {
      return NextResponse.json(
        { success: false, error: "Process log not found" },
        { status: 404 }
      );
    }

    let graphData: any;

    // check cache hit
    const cached = transitionGraphCache.get(cacheKey);
    if (cached && cached.updatedAt === processLog.updatedAt.getTime()) {
      graphData = cached.graphData;
    } else {
      // 1. Fetch activities and their matching assessments for this log
      const activities = await prisma.activity.findMany({
        where: { processLogId },
        include: {
          assessments: {
            where: {
              type: assessmentType as any,
              ...(model ? { model } : {}),
            },
          },
        },
      });

      // 2. Fetch traces and events sorted chronologically
      const traces = await prisma.trace.findMany({
        where: { processLogId },
        include: {
          events: {
            orderBy: { timestamp: "asc" },
          },
        },
      });

      type EdgeKey = string; // "source->target"
      type EdgeData = {
        source: string;
        target: string;
        count: number;
        delays: number[];
      };

      const edgesMap = new Map<EdgeKey, EdgeData>();
      const startTransitions = new Map<string, number>();
      const endTransitions = new Map<string, number>();

      for (const trace of traces) {
        const events = trace.events;
        if (events.length === 0) continue;

        // start Node transition
        const firstAct = events[0].activity;
        startTransitions.set(firstAct, (startTransitions.get(firstAct) || 0) + 1);

        // transitions between events
        for (let i = 0; i < events.length - 1; i++) {
          const source = events[i].activity;
          const target = events[i + 1].activity;
          const delay = events[i + 1].timestamp.getTime() - events[i].timestamp.getTime();

          const key = `${source}->${target}`;
          let edge = edgesMap.get(key);
          if (!edge) {
            edge = { source, target, count: 0, delays: [] };
            edgesMap.set(key, edge);
          }
          edge.count += 1;
          edge.delays.push(delay);
        }

        // end Node transition
        const lastAct = events[events.length - 1].activity;
        endTransitions.set(lastAct, (endTransitions.get(lastAct) || 0) + 1);
      }

      // 3. Format nodes (Start node, activities, End node)
      const nodes = [
        {
          id: "__START__",
          name: "Start",
          type: "start",
          frequency: traces.length,
          averageDuration: 0,
        },
        ...activities.map((act) => {
          const assessment = act.assessments?.[0];
          return {
            id: act.name,
            name: act.name,
            type: "activity",
            frequency: act.frequency,
            averageDuration: act.averageDuration,
            caseCoverage: act.caseCoverage,
            resourceCount: act.resourceCount,
            automationScore: assessment?.score ?? null,
            automationLabel: assessment?.label ?? null,
          };
        }),
        {
          id: "__END__",
          name: "End",
          type: "end",
          frequency: traces.length,
          averageDuration: 0,
        },
      ];

      // 4. Format edges
      const edges = [];

      // start transitions
      for (const [target, count] of startTransitions.entries()) {
        edges.push({
          id: `start->${target}`,
          source: "__START__",
          target,
          count,
          averageDelay: 0,
        });
      }

      // activity sequence flows
      for (const edge of edgesMap.values()) {
        const averageDelay =
          edge.delays.length > 0
            ? edge.delays.reduce((sum, d) => sum + d, 0) / edge.delays.length
            : 0;

        edges.push({
          id: `${edge.source}->${edge.target}`,
          source: edge.source,
          target: edge.target,
          count: edge.count,
          averageDelay,
        });
      }

      // end transitions
      for (const [source, count] of endTransitions.entries()) {
        edges.push({
          id: `${source}->end`,
          source,
          target: "__END__",
          count,
          averageDelay: 0,
        });
      }

      graphData = {
        nodes,
        edges,
      };

      // cache the calculated full graph data
      transitionGraphCache.set(cacheKey, {
        updatedAt: processLog.updatedAt.getTime(),
        graphData,
      });
    }

    // 5. Apply filtering based on nodeLimit (defaults to top 30 most frequent activities)
    const url = new URL(request.url);
    const nodeLimitParam = url.searchParams.get("nodeLimit");
    const nodeLimit = nodeLimitParam ? parseInt(nodeLimitParam, 10) : 30;

    const startNode = graphData.nodes.find((n: any) => n.type === "start");
    const endNode = graphData.nodes.find((n: any) => n.type === "end");
    const activityNodes = graphData.nodes.filter((n: any) => n.type === "activity");

    // sort by frequency descending and take top N
    const sortedActivities = [...activityNodes].sort((a, b) => b.frequency - a.frequency);
    const topActivities = sortedActivities.slice(0, nodeLimit);

    const filteredNodes = [];
    if (startNode) filteredNodes.push(startNode);
    filteredNodes.push(...topActivities);
    if (endNode) filteredNodes.push(endNode);

    const allowedNodeIds = new Set(filteredNodes.map((n) => n.id));

    // filter edges: only keep if both source and target nodes are in the allowed list
    const filteredEdges = graphData.edges.filter(
      (e: any) => allowedNodeIds.has(e.source) && allowedNodeIds.has(e.target)
    );

    return NextResponse.json({
      success: true,
      data: {
        nodes: filteredNodes,
        edges: filteredEdges,
      },
    });
  } catch (error) {
    console.error("error generating transition graph:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate transition graph" },
      { status: 500 }
    );
  }
}
