"use client";

import { useEffect, useState, useCallback, memo, useRef } from "react";
import dagre from "dagre";
import { Button } from "@/components/ui/button";

// ─── local font declarations ──────────────────────────────────────────────────

const FONT_SANS = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

// ─── local type declarations ──────────────────────────────────────────────────

type Position = "Top" | "Bottom" | "Left" | "Right";

interface ActivityNodeData {
  id: string;
  type: string;
  name: string;
  frequency: number;
  averageDuration: number;
  caseCoverage: number;
  resourceCount: number;
  automationScore?: number | null;
  automationLabel?: "LOW" | "MEDIUM" | "HIGH" | null;
}

interface CanvasNode {
  id: string;
  type: "start" | "end" | "activity";
  data: ActivityNodeData;
  position: { x: number; y: number };
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data: { count: number };
  style?: { strokeWidth: number; stroke: string };
}

// ─── dagre auto-layout helper ───────────────────────────────────────────────

const getLayoutedElements = (
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  direction = "TB"
): { nodes: CanvasNode[]; edges: CanvasEdge[] } => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 100, // scaled spacing between sibling nodes
    ranksep: 180, // scaled spacing between sequential steps
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    if (node.type === "start" || node.type === "end") {
      g.setNode(node.id, { width: 144, height: 144 });
    } else {
      g.setNode(node.id, { width: 336, height: 144 });
    }
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const { x, y } = g.node(node.id);
      const width = node.type === "start" || node.type === "end" ? 144 : 336;
      const height = 144;

      return {
        ...node,
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
  isSidebarOpen?: boolean;
  sidebarWidth?: number;
  isResizing?: boolean;
}

export default function ProcessGraph({
  processLogId,
  onNodeSelect,
  assessmentType = "RULE_BASED",
  model = null,
  nodeLimit: propNodeLimit,
  onNodeLimitChange,
  reloadTrigger = 0,
  isSidebarOpen = false,
  sidebarWidth = 480,
  isResizing = false,
}: ProcessGraphProps) {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"TB" | "LR">("LR");
  const [localNodeLimit, setLocalNodeLimit] = useState(20);
  const [sliderVal, setSliderVal] = useState(20);
  const [showLabels, setShowLabels] = useState(true);

  // canvas transformation state
  const [zoom, setZoom] = useState<number>(0.75);
  const [offsetX, setOffsetX] = useState<number>(50);
  const [offsetY, setOffsetY] = useState<number>(50);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const offsetStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const clickStartRef = useRef<number>(0);
  const dragDistanceRef = useRef<number>(0);
  const layoutCacheRef = useRef<Record<string, Record<string, { x: number; y: number }>>>({});
  const lastLayoutKeyRef = useRef<string>("");

  const nodeLimit = propNodeLimit !== undefined ? propNodeLimit : localNodeLimit;
  const setNodeLimit = (val: number) => {
    setLocalNodeLimit(val);
    if (onNodeLimitChange) {
      onNodeLimitChange(val);
    }
  };

  // track container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // reset slider states if process log changes
  useEffect(() => {
    setNodeLimit(20);
    setSliderVal(20);
    setSelectedNodeId(null);
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

      const rawEdges = graphData.edges.map((e: any) => {
        const ratio = e.count / maxCount;
        const strokeWidth = 1.5 + ratio * 3.0;

        let strokeColor = "#94a3b8"; // tier 5: < 5% (slate-400)
        if (ratio >= 0.7) {
          strokeColor = "#4f46e5"; // tier 1: >= 70% (indigo-600)
        } else if (ratio >= 0.4) {
          strokeColor = "#2563eb"; // tier 2: 40% - 70% (blue-600)
        } else if (ratio >= 0.15) {
          strokeColor = "#0284c7"; // tier 3: 15% - 40% (sky-600)
        } else if (ratio >= 0.05) {
          strokeColor = "#475569"; // tier 4: 5% - 15% (slate-600)
        }

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: showLabels ? `${e.count}x` : undefined,
          data: { count: e.count },
          style: { strokeWidth, stroke: strokeColor },
        };
      });

      const layoutKey = `${processLogId}-${nodeLimit}-${direction}`;
      let layoutedNodes: CanvasNode[];
      let layoutedEdges: CanvasEdge[];

       const cachedPositions = layoutCacheRef.current[layoutKey];
       const isCacheHit = cachedPositions && rawNodes.every((n: CanvasNode) => n.id in cachedPositions);
 
       if (isCacheHit) {
         layoutedNodes = rawNodes.map((node: CanvasNode) => ({
           ...node,
           position: { ...cachedPositions[node.id] },
         }));
         layoutedEdges = rawEdges;
      } else {
        const layoutResult = getLayoutedElements(
          rawNodes,
          rawEdges,
          direction
        );
        layoutedNodes = layoutResult.nodes;
        layoutedEdges = layoutResult.edges;

        // save to cache
        const positions: Record<string, { x: number; y: number }> = {};
        layoutedNodes.forEach((node) => {
          positions[node.id] = { ...node.position };
        });
        layoutCacheRef.current[layoutKey] = positions;
      }

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load process flow");
    } finally {
      setLoading(false);
    }
  }, [processLogId, direction, nodeLimit, showLabels, assessmentType, model, reloadTrigger]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // fit graph to center screen bounds
  const fitView = useCallback(() => {
    if (nodes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth || dimensions.width || 800;
    const height = canvas.clientHeight || dimensions.height || 600;

    const minX = Math.min(...nodes.map((n) => n.position.x));
    const maxX = Math.max(
      ...nodes.map((n) => n.position.x + (n.type === "start" || n.type === "end" ? 144 : 336))
    );
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxY = Math.max(...nodes.map((n) => n.position.y + 144));

    const graphW = maxX - minX;
    const graphH = maxY - minY;

    const padding = 80;
    const fitScaleX = (width - padding * 2) / graphW;
    const fitScaleY = (height - padding * 2) / graphH;
    const fitScale = Math.min(1.0, Math.max(0.01, Math.min(fitScaleX, fitScaleY)));

    const nextOffsetX = (width - graphW * fitScale) / 2 - minX * fitScale;
    const nextOffsetY = (height - graphH * fitScale) / 2 - minY * fitScale;

    setZoom(fitScale);
    setOffsetX(nextOffsetX);
    setOffsetY(nextOffsetY);
  }, [nodes, dimensions]);

  // fit viewport on initial render layout load and size updates
  useEffect(() => {
    const currentLayoutKey = `${processLogId}-${nodeLimit}-${direction}`;
    if (nodes.length > 0 && lastLayoutKeyRef.current !== currentLayoutKey) {
      lastLayoutKeyRef.current = currentLayoutKey;
      fitView();
    }
  }, [nodes, processLogId, nodeLimit, direction, fitView]);

  // helper formatting routines
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

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines = 2
  ) => {
    const words = text.split(" ");
    let line = "";
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const linesToDraw = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      linesToDraw[maxLines - 1] = linesToDraw[maxLines - 1].trim() + "...";
    }

    const startY = y - ((linesToDraw.length - 1) * lineHeight) / 2;
    for (let i = 0; i < linesToDraw.length; i++) {
      ctx.fillText(linesToDraw[i].trim(), x, startY + i * lineHeight);
    }
  };

  // graphic draw procedures
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 40;
    const startX = Math.floor(-offsetX / zoom / gridSize) * gridSize;
    const startY = Math.floor(-offsetY / zoom / gridSize) * gridSize;
    const endX = startX + width / zoom + gridSize;
    const endY = startY + height / zoom + gridSize;

    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1 / zoom;

    ctx.beginPath();
    for (let x = startX; x < endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  };

  const drawEdge = (
    ctx: CanvasRenderingContext2D,
    edge: CanvasEdge,
    sourceNode?: CanvasNode,
    targetNode?: CanvasNode
  ) => {
    if (!sourceNode || !targetNode) return;

    const srcW = sourceNode.type === "activity" ? 336 : 144;
    const srcH = 144;
    const tgtW = targetNode.type === "activity" ? 336 : 144;
    const tgtH = 144;

    let fromX = sourceNode.position.x + srcW;
    let fromY = sourceNode.position.y + srcH / 2;
    let toX = targetNode.position.x;
    let toY = targetNode.position.y + tgtH / 2;

    if (direction === "TB") {
      fromX = sourceNode.position.x + srcW / 2;
      fromY = sourceNode.position.y + srcH;
      toX = targetNode.position.x + tgtW / 2;
      toY = targetNode.position.y;
    }

    ctx.strokeStyle = edge.style?.stroke || "#94a3b8";
    ctx.lineWidth = edge.style?.strokeWidth || 2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const arrowSize = 10;

    ctx.fillStyle = edge.style?.stroke || "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - arrowSize * Math.cos(angle - Math.PI / 6),
      toY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - arrowSize * Math.cos(angle + Math.PI / 6),
      toY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    if (showLabels && edge.label && zoom >= 0.40) {
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      const text = edge.label;
      ctx.font = `bold 9px ${FONT_SANS}`;
      const txtW = ctx.measureText(text).width + 8;
      const txtH = 14;

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - txtW / 2, midY - txtH / 2, txtW, txtH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, midX, midY);
    }
  };

  const drawNode = (
    ctx: CanvasRenderingContext2D,
    node: CanvasNode,
    isHovered: boolean,
    isSelected: boolean
  ) => {
    const { x, y } = node.position;
    const isStartEnd = node.type === "start" || node.type === "end";
    const w = isStartEnd ? 144 : 336;
    const h = 144;

    if (isSelected) {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 6;
      if (isStartEnd) {
        ctx.beginPath();
        ctx.arc(x + 72, y + 72, 77, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 14);
        ctx.stroke();
      }
    }

    if (node.type === "start") {
      ctx.fillStyle = "#ecfdf5";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x + 72, y + 72, 72, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#047857";
      ctx.font = `bold 32px ${FONT_SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("▶", x + 75, y + 72);
    } else if (node.type === "end") {
      ctx.fillStyle = "#fff1f2";
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x + 72, y + 72, 72, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#be123c";
      ctx.font = `bold 32px ${FONT_SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("■", x + 72, y + 72);
    } else {
      let bgColor = "#ffffff";
      let titleColor = "#1e293b";
      let footerColor = "#64748b";
      let badgeBg = "#f1f5f9";
      let badgeText = "#475569";

      if (node.data.automationLabel === "HIGH") {
        bgColor = "#d1fae5";
        titleColor = "#064e3b";
        footerColor = "#065f46";
        badgeBg = "#a7f3d0";
        badgeText = "#064e3b";
      } else if (node.data.automationLabel === "MEDIUM") {
        bgColor = "#fef3c7";
        titleColor = "#78350f";
        footerColor = "#92400e";
        badgeBg = "#fde68a";
        badgeText = "#78350f";
      } else if (node.data.automationLabel === "LOW") {
        bgColor = "#ffe4e6";
        titleColor = "#4c0519";
        footerColor = "#9f1239";
        badgeBg = "#fecdd3";
        badgeText = "#4c0519";
      }

      ctx.fillStyle = bgColor;
      ctx.strokeStyle = isHovered ? "#2563eb" : "#000000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 12);
      ctx.fill();
      ctx.stroke();

      const isMicroLOD = zoom < 0.20;
      const isLOD = zoom < 0.45;

      if (!isLOD && node.data.automationScore !== undefined && node.data.automationScore !== null) {
        ctx.fillStyle = badgeBg;
        ctx.strokeStyle =
          node.data.automationLabel === "HIGH"
            ? "#6ee7b7"
            : node.data.automationLabel === "MEDIUM"
            ? "#fcd34d"
            : "#fca5a5";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x + w - 55, y + 8, 48, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = badgeText;
        ctx.font = `bold 9px ${FONT_SANS}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${node.data.automationScore}%`, x + w - 31, y + 17);
      }

      ctx.fillStyle = titleColor;
      ctx.font = isMicroLOD ? `bold 32px ${FONT_SANS}` : isLOD ? `bold 24px ${FONT_SANS}` : `bold 18px ${FONT_SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const txtX = x + w / 2;
      const txtY = isLOD ? y + h / 2 : y + h / 2 - 14;
      wrapText(ctx, node.data.name, txtX, txtY, w - 30, isMicroLOD ? 36 : isLOD ? 28 : 22, isMicroLOD ? 2 : isLOD ? 3 : 2);

      if (!isLOD) {
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + h - 36);
        ctx.lineTo(x + w - 10, y + h - 36);
        ctx.stroke();

        ctx.fillStyle = titleColor;
        ctx.font = `bold 10px ${FONT_SANS}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`${node.data.frequency.toLocaleString()}x`, x + 12, y + h - 18);

        ctx.fillStyle = footerColor;
        ctx.font = `500 9px ${FONT_SANS}`;
        ctx.textAlign = "right";
        ctx.fillText(`Cov: ${(node.data.caseCoverage * 100).toFixed(0)}%`, x + w - 12, y + h - 18);

        const durTxt = formatDuration(node.data.averageDuration);
        const bW = ctx.measureText(durTxt).width + 12;
        const bX = x + w / 2 - bW / 2;

        ctx.fillStyle = badgeBg;
        ctx.beginPath();
        ctx.roundRect(bX, y + h - 26, bW, 16, 4);
        ctx.fill();

        ctx.fillStyle = badgeText;
        ctx.font = `9px ${FONT_MONO}`;
        ctx.textAlign = "center";
        ctx.fillText(durTxt, x + w / 2, y + h - 18);
      }
    }
  };

  // canvas paint effect loop with Viewport Culling & rAF scheduling
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || dimensions.width || 800;
      const height = canvas.clientHeight || dimensions.height || 600;
      
      // set actual screen pixel dimensions for high-DPI
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(offsetX, offsetY);
      ctx.scale(zoom, zoom);

      drawGrid(ctx, width, height);

      // Viewport Culling (off-screen clipping) bounds
      const margin = 60;
      const visibleMinX = -offsetX / zoom - margin;
      const visibleMinY = -offsetY / zoom - margin;
      const visibleMaxX = (width - offsetX) / zoom + margin;
      const visibleMaxY = (height - offsetY) / zoom + margin;

      const visibleNodeIds = new Set<string>();

      nodes.forEach((node) => {
        const w = node.type === "activity" ? 336 : 144;
        const h = 144;
        const isVisible =
          node.position.x + w >= visibleMinX &&
          node.position.x <= visibleMaxX &&
          node.position.y + h >= visibleMinY &&
          node.position.y <= visibleMaxY;

        if (isVisible) {
          visibleNodeIds.add(node.id);
        }
      });

      edges.forEach((edge) => {
        if (visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target)) {
          const srcNode = nodes.find((n) => n.id === edge.source);
          const tgtNode = nodes.find((n) => n.id === edge.target);
          drawEdge(ctx, edge, srcNode, tgtNode);
        }
      });

      nodes.forEach((node) => {
        if (visibleNodeIds.has(node.id)) {
          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          drawNode(ctx, node, isHovered, isSelected);
        }
      });

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [nodes, edges, zoom, offsetX, offsetY, dimensions, hoveredNodeId, selectedNodeId, showLabels]);

  // pointer position detection helper
  const getNodeAtPosition = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const graphX = (mouseX - offsetX) / zoom;
    const graphY = (mouseY - offsetY) / zoom;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const { x, y } = node.position;
      const isStartEnd = node.type === "start" || node.type === "end";
      const w = isStartEnd ? 144 : 336;
      const h = 144;

      if (isStartEnd) {
        const centerX = x + 72;
        const centerY = y + 72;
        const dist = Math.sqrt((graphX - centerX) ** 2 + (graphY - centerY) ** 2);
        if (dist <= 72) return node;
      } else {
        if (graphX >= x && graphX <= x + w && graphY >= y && graphY <= y + h) {
          return node;
        }
      }
    }
    return null;
  };

  // interactions pointer gesture handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    clickStartRef.current = Date.now();
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { x: offsetX, y: offsetY };
    dragDistanceRef.current = 0;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    dragStartRef.current = null;
    const clickDuration = Date.now() - clickStartRef.current;
    const dragDistance = dragDistanceRef.current;

    if (clickDuration < 300 || dragDistance < 6) {
      const node = getNodeAtPosition(e.clientX, e.clientY);
      if (node) {
        if (node.type === "activity") {
          setSelectedNodeId(node.id);
          if (onNodeSelect) onNodeSelect(node.id);
        } else {
          setSelectedNodeId(null);
          if (onNodeSelect) onNodeSelect(null);
        }
      } else {
        setSelectedNodeId(null);
        if (onNodeSelect) onNodeSelect(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const hovered = getNodeAtPosition(e.clientX, e.clientY);
    setHoveredNodeId(hovered ? hovered.id : null);
    e.currentTarget.style.cursor = hovered
      ? "pointer"
      : dragStartRef.current
      ? "grabbing"
      : "grab";

    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      setOffsetX(offsetStartRef.current.x + dx);
      setOffsetY(offsetStartRef.current.y + dy);
    }
  };

  const handleMouseUpOrLeave = () => {
    dragStartRef.current = null;
  };

  // attach non-passive wheel zoom listener to canvas to support trackpad pinch-zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const graphX = (mouseX - offsetX) / zoom;
      const graphY = (mouseY - offsetY) / zoom;

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = Math.min(4, Math.max(0.01, zoom * factor));

      const nextOffsetX = mouseX - graphX * nextZoom;
      const nextOffsetY = mouseY - graphY * nextZoom;

      setZoom(nextZoom);
      setOffsetX(nextOffsetX);
      setOffsetY(nextOffsetY);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoom, offsetX, offsetY]);

  const zoomIn = () => {
    setZoom((z) => Math.min(4, z * 1.2));
  };
  const zoomOut = () => {
    setZoom((z) => Math.max(0.01, z / 1.2));
  };

  const toggleDirection = () => {
    setDirection((prev) => (prev === "TB" ? "LR" : "TB"));
  };

  if (nodes.length === 0 && loading) {
    return (
      <div className="flex w-full h-full items-center justify-center rounded-lg border-2 border-dashed bg-slate-50/50">
        <p className="text-slate-500 animate-pulse font-medium">Computing process map layout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full h-full flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-semibold mb-2">Error loading process graph</p>
        <p className="text-red-600 text-sm">{error}</p>
        <Button className="mt-4" onClick={fetchGraph}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white select-none">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center transition-all">
          <p className="text-slate-600 font-semibold animate-pulse">Recalculating layout...</p>
        </div>
      )}

      {/* Canvas rendering view */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUpOrLeave}
        className="absolute inset-0 block w-full h-full select-none"
      />

      {/* Zoom and view options buttons */}
      <div
        style={{ left: `${isSidebarOpen ? sidebarWidth + 16 : 16}px`, zIndex: 40 }}
        className={`absolute bottom-4 flex flex-col bg-white border border-slate-300 rounded-sm shadow-sm overflow-hidden ${
          isResizing ? "transition-none" : "transition-all duration-300 ease-in-out"
        }`}
      >
        <button
          onClick={zoomIn}
          className="w-8 h-8 flex items-center justify-center text-slate-650 hover:bg-slate-50 font-bold border-b border-slate-200 text-sm cursor-pointer border-0 bg-transparent"
          title="Zoom In"
        >
          ＋
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 flex items-center justify-center text-slate-650 hover:bg-slate-50 font-bold border-b border-slate-200 text-sm cursor-pointer border-0 bg-transparent"
          title="Zoom Out"
        >
          －
        </button>
        <button
          onClick={fitView}
          className="w-8 h-8 flex items-center justify-center text-slate-650 hover:bg-slate-50 text-xs font-bold cursor-pointer border-0 bg-transparent"
          title="Fit View"
        >
          ⛶
        </button>
      </div>

      {/* Layout controllers */}
      <div
        style={{ left: `${isSidebarOpen ? sidebarWidth + 76 : 64}px`, zIndex: 40 }}
        className={`absolute bottom-4 flex gap-2 ${
          isResizing ? "transition-none" : "transition-all duration-300 ease-in-out"
        }`}
      >
        <button
          onClick={toggleDirection}
          className="btn-small waves-effect waves-light white text-slate-800 cursor-pointer font-semibold uppercase tracking-wider text-[10px]"
          style={{ height: "32px", lineHeight: "32px", color: "#333", backgroundColor: "#fff", border: "1px solid #cbd5e1", display: "inline-flex", alignItems: "center", padding: "0 12px" }}
        >
          Layout: {direction === "TB" ? "Vertical" : "Horizontal"}
        </button>
        <button
          onClick={() => setShowLabels((prev) => !prev)}
          className="btn-small waves-effect waves-light white text-slate-800 cursor-pointer font-semibold uppercase tracking-wider text-[10px]"
          style={{ height: "32px", lineHeight: "32px", color: "#333", backgroundColor: "#fff", border: "1px solid #cbd5e1", display: "inline-flex", alignItems: "center", padding: "0 12px" }}
        >
          {showLabels ? "Hide Path Counts" : "Show Path Counts"}
        </button>
        <button
          onClick={fetchGraph}
          className="btn-small waves-effect waves-light white text-slate-800 cursor-pointer font-semibold uppercase tracking-wider text-[10px]"
          style={{ height: "32px", lineHeight: "32px", color: "#333", backgroundColor: "#fff", border: "1px solid #cbd5e1", display: "inline-flex", alignItems: "center", padding: "0 12px" }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
