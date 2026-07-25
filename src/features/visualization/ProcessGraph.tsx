"use client";

import { useEffect, useState, useCallback, memo } from "react";
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
  NodeProps,
  Handle,
  MarkerType,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── custom node components ──────────────────────────────────────────────────

const StartNode = memo(({ sourcePosition }: NodeProps) => {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50/50 shadow-sm transition-transform duration-150 hover:scale-105">
      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        isConnectable={false}
        className="w-2 h-2 !bg-emerald-500"
      />
      <span className="text-emerald-700 font-bold text-xs pl-0.5">▶</span>
    </div>
  );
});
StartNode.displayName = "StartNode";

const EndNode = memo(({ targetPosition }: NodeProps) => {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-rose-600 bg-rose-50/50 shadow-sm transition-transform duration-150 hover:scale-105">
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        isConnectable={false}
        className="w-2 h-2 !bg-rose-600"
      />
      <span className="text-rose-700 font-bold text-xs">■</span>
    </div>
  );
});
EndNode.displayName = "EndNode";

interface ActivityNodeData extends Record<string, unknown> {
  name: string;
  frequency: number;
  averageDuration: number;
  caseCoverage: number;
  resourceCount: number;
  automationScore?: number | null;
  automationLabel?: "LOW" | "MEDIUM" | "HIGH" | null;
}

const ActivityNode = memo(({
  data,
  selected,
  targetPosition,
  sourcePosition,
}: NodeProps<Node<ActivityNodeData>>) => {
  const formatDuration = (ms: number) => {
    if (ms === 0) return "0ms";
    const secs = ms / 1000;
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = secs / 60;
    if (mins < 60) return `${mins.toFixed(1)}m`;
    const hours = mins / 60;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  };

  // determine color scheme based on automation potential
  let cardStyles = "border-slate-400 bg-white text-slate-900";
  let nameText = "text-slate-800";
  let footerBorder = "border-slate-200";
  let footerText = "text-slate-500";
  let frequencyText = "text-slate-700";
  let durationBadge = "bg-slate-100 text-slate-600";
  
  if (data.automationLabel === "HIGH") {
    cardStyles = "border-emerald-500 bg-emerald-100/90 text-emerald-950 shadow-sm";
    nameText = "text-emerald-900 font-bold";
    footerBorder = "border-emerald-300/60";
    footerText = "text-emerald-800";
    frequencyText = "text-emerald-950 font-bold";
    durationBadge = "bg-emerald-200 text-emerald-950 font-semibold";
  } else if (data.automationLabel === "MEDIUM") {
    cardStyles = "border-amber-500 bg-amber-100/90 text-amber-950 shadow-sm";
    nameText = "text-amber-900 font-bold";
    footerBorder = "border-amber-300/60";
    footerText = "text-amber-800";
    frequencyText = "text-amber-950 font-bold";
    durationBadge = "bg-amber-200 text-amber-950 font-semibold";
  } else if (data.automationLabel === "LOW") {
    cardStyles = "border-rose-300 bg-rose-100/90 text-rose-950 shadow-sm";
    nameText = "text-rose-900 font-bold";
    footerBorder = "border-rose-300/60";
    footerText = "text-rose-800";
    frequencyText = "text-rose-950 font-bold";
    durationBadge = "bg-rose-200 text-rose-950 font-semibold";
  }

  // selection highlight using scaling and a thick outline ring offset
  const highlightStyles = selected
    ? "scale-[1.04] z-50 shadow-xl outline outline-3 outline-offset-2 outline-blue-600"
    : "hover:scale-[1.01] hover:shadow-md";

  return (
    <div
      className={`relative flex flex-col justify-between p-2.5 h-24 w-56 rounded-lg border text-left transition-all duration-150 ${cardStyles} ${highlightStyles}`}
    >
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        isConnectable={false}
        className="w-1.5 h-1.5 !bg-slate-400"
      />
      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        isConnectable={false}
        className="w-1.5 h-1.5 !bg-slate-400"
      />

      {data.automationScore !== undefined && data.automationScore !== null && (
        <span className={`absolute top-1.5 right-1.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-sm ${
          data.automationLabel === "HIGH"
            ? "bg-emerald-200 text-emerald-950 border border-emerald-300"
            : data.automationLabel === "MEDIUM"
            ? "bg-amber-200 text-amber-950 border border-amber-300"
            : "bg-rose-200 text-rose-950 border border-rose-300"
        }`}>
          {data.automationScore}%
        </span>
      )}

      {/* Centered Activity Name */}
      <div className="flex-1 flex items-center justify-center mt-1.5 mb-1">
        <p className={`text-center text-xs font-semibold line-clamp-2 px-1 max-h-[32px] overflow-hidden leading-tight ${nameText}`} title={data.name}>
          {data.name}
        </p>
      </div>

      {/* Metrics Footer */}
      <div className={`flex justify-between items-center text-[9px] border-t pt-1.5 px-0.5 ${footerBorder} ${footerText}`}>
        <span className={`font-semibold ${frequencyText}`}>{data.frequency.toLocaleString()}x</span>
        <span className={`font-mono px-1 py-0.25 rounded text-[8px] ${durationBadge}`}>
          {formatDuration(data.averageDuration)}
        </span>
        <span className="text-[8px] font-medium opacity-90">Cov: {(data.caseCoverage * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
});
ActivityNode.displayName = "ActivityNode";

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  activity: ActivityNode,
};

// ─── dagre auto-layout helper ───────────────────────────────────────────────

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 80, // spacing between sibling nodes
    ranksep: 140, // spacing between sequential flow steps
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    // set realistic dimensions of the rendered HTML nodes
    if (node.type === "start" || node.type === "end") {
      g.setNode(node.id, { width: 48, height: 48 });
    } else {
      g.setNode(node.id, { width: 224, height: 96 });
    }
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const { x, y } = g.node(node.id);
      const width = node.type === "start" || node.type === "end" ? 48 : 224;
      const height = node.type === "start" || node.type === "end" ? 48 : 96;

      return {
        ...node,
        targetPosition: direction === "TB" ? Position.Top : Position.Left,
        sourcePosition: direction === "TB" ? Position.Bottom : Position.Right,
        position: {
          x: x - width / 2, // centering offset correction
          y: y - height / 2,
        },
      };
    }),
    edges,
  };
};

// ─── main component ─────────────────────────────────────────────────────────

interface ProcessGraphProps {
  processLogId: string;
  onNodeSelect?: (activityName: string | null) => void;
  assessmentType?: string;
  model?: string | null;
  nodeLimit?: number;
  onNodeLimitChange?: (limit: number) => void;
  reloadTrigger?: number;
}

export default function ProcessGraph({
  processLogId,
  onNodeSelect,
  assessmentType = "RULE_BASED",
  model = null,
  nodeLimit: propNodeLimit,
  onNodeLimitChange,
  reloadTrigger = 0,
}: ProcessGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"TB" | "LR">("LR");
  const [localNodeLimit, setLocalNodeLimit] = useState(30);
  const [sliderVal, setSliderVal] = useState(30);
  const [showLabels, setShowLabels] = useState(true);

  const nodeLimit = propNodeLimit !== undefined ? propNodeLimit : localNodeLimit;
  const setNodeLimit = (val: number) => {
    setLocalNodeLimit(val);
    if (onNodeLimitChange) {
      onNodeLimitChange(val);
    }
  };

  // reset slider states if process log changes
  useEffect(() => {
    setNodeLimit(30);
    setSliderVal(30);
  }, [processLogId]);

  // sync transient slider value with nodeLimit prop changes
  useEffect(() => {
    setSliderVal(nodeLimit);
  }, [nodeLimit]);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const modelParam = model ? `&model=${encodeURIComponent(model)}` : "";
      const triggerParam = reloadTrigger ? `&t=${reloadTrigger}` : "";
      const response = await fetch(
        `/api/process-logs/${processLogId}/transition-graph?nodeLimit=${nodeLimit}&assessmentType=${assessmentType}${modelParam}${triggerParam}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch graph data");
      }

      const graphData = result.data;
      const maxCount = Math.max(...graphData.edges.map((e: any) => e.count), 1);

      const rawNodes = graphData.nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        data: n,
        position: { x: 0, y: 0 }, 
      }));

      // map API edges to React Flow edges
      const rawEdges = graphData.edges.map((e: any) => {
        const ratio = e.count / maxCount;

        // 1. Thickness scale: 1.5px (rare) to 5.5px (most frequent)
        const strokeWidth = 1.5 + ratio * 4;

        // 2. 5-Tier Color Scale
        let strokeColor = "#cbd5e1"; // tier 5: < 5% (Very light slate)
        if (ratio >= 0.7) {
          strokeColor = "#1d4ed8"; // tier 1: >= 70% (Deep Royal Blue)
        } else if (ratio >= 0.4) {
          strokeColor = "#3b82f6"; // tier 2: 40% - 70% (Medium blue)
        } else if (ratio >= 0.15) {
          strokeColor = "#475569"; // tier 3: 15% - 40% (Dark Slate)
        } else if (ratio >= 0.05) {
          strokeColor = "#94a3b8"; // tier 4: 5% - 15% (Slate-400)
        }

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "smoothstep", // use clean rounded 90-degree orthogonal line paths
          label: showLabels ? `${e.count}x` : undefined,
          data: { count: e.count },
          style: { strokeWidth, stroke: strokeColor },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
          },
        };
      });

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        rawNodes,
        rawEdges,
        direction
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load process flow");
    } finally {
      setLoading(false);
    }
  }, [processLogId, direction, nodeLimit, showLabels, assessmentType, model, reloadTrigger, setNodes, setEdges]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // update edge labels dynamically when toggle changes
  useEffect(() => {
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        const count = edge.data?.count;
        return {
          ...edge,
          label: showLabels && count !== undefined ? `${count}x` : undefined,
        };
      })
    );
  }, [showLabels, setEdges]);

  const handleNodeClick = useCallback(
    (_: any, node: Node) => {
      if (onNodeSelect) {
        if (node.type === "activity") {
          onNodeSelect(node.id);
        } else {
          onNodeSelect(null);
        }
      }
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    if (onNodeSelect) {
      onNodeSelect(null);
    }
  }, [onNodeSelect]);

  const toggleDirection = () => {
    setDirection((prev) => (prev === "TB" ? "LR" : "TB"));
  };

  // only render a full loading placeholder if we don't have any nodes loaded yet
  if (nodes.length === 0 && loading) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-lg border-2 border-dashed bg-slate-50">
        <p className="text-slate-500 animate-pulse font-medium">Computing process map layout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-semibold mb-2">Error loading process graph</p>
        <p className="text-red-600 text-sm">{error}</p>
        <Button className="mt-4" onClick={fetchGraph}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Card className="relative w-full h-[600px] border shadow-md overflow-hidden bg-slate-50">
      {/* loading overlay (stops unmounting/remounting ReactFlow) */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center transition-all">
          <p className="text-slate-600 font-semibold animate-pulse">Recalculating layout...</p>
        </div>
      )}

      {/* controls overlay */}
      <div className="absolute left-4 top-4 z-10 flex gap-2">
        <Button variant="secondary" size="sm" onClick={toggleDirection} className="shadow-sm">
          Layout: {direction === "TB" ? "Vertical" : "Horizontal"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowLabels((prev) => !prev)}
          className="shadow-sm bg-white border border-slate-200"
        >
          {showLabels ? "Hide Path Counts" : "Show Path Counts"}
        </Button>
        <Button variant="outline" size="sm" onClick={fetchGraph} className="shadow-sm bg-white">
          Reload
        </Button>
      </div>

      {/* detail level slider overlay */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-3 bg-white px-3 py-1.5 rounded-md border shadow-sm text-xs font-medium">
        <span className="text-slate-500 font-semibold">Detail:</span>
        <input
          type="range"
          min="10"
          max="100"
          step="10"
          value={sliderVal}
          onChange={(e) => setSliderVal(parseInt(e.target.value, 10))}
          onMouseUp={() => setNodeLimit(sliderVal)}
          onTouchEnd={() => setNodeLimit(sliderVal)}
          className="w-20 cursor-pointer accent-blue-600 h-1.5 bg-slate-100 rounded-lg appearance-none"
        />
        <span className="text-slate-700 w-6 text-right font-bold">{sliderVal} nodes</span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements={true}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.05}
        maxZoom={4}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </Card>
  );
}
