"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessLog, Activity, Assessment } from "@/types/models";
import ProcessGraph from "@/features/visualization/ProcessGraph";
import { Loader2, Menu } from "lucide-react";
import { SUPPORTED_MODELS } from "@/features/automation-scoring/openrouter";
import { calculateLlmCost } from "@/features/automation-scoring/utils";

// import sub-components
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import FrequencyDashboard from "./components/FrequencyDashboard";
import PathsDashboard from "./components/PathsDashboard";
import PerformanceDashboard from "./components/PerformanceDashboard";
import FeasibilityMatrix from "./components/FeasibilityMatrix";
import ComparativeWorkbenchModal from "./components/ComparativeWorkbenchModal";
import ActivityDetailsPanel from "./components/ActivityDetailsPanel";

interface ProcessLogDetailsClientProps {
  processLog: ProcessLog & {
    activities: Activity[];
    assessments: Assessment[];
  };
}

export default function ProcessLogDetailsClient({ processLog }: ProcessLogDetailsClientProps) {
  const router = useRouter();
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<string>("frequency");
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [activeTransitionType, setActiveTransitionType] = useState<"start" | "end">("start");
  const [hoveredPathSlice, setHoveredPathSlice] = useState<number | null>(null);
  const [activeDurationType, setActiveDurationType] = useState<"average" | "median">("average");
  const [selectedModel, setSelectedModel] = useState<string>("~google/gemini-pro-latest");
  const [viewLlmModel, setViewLlmModel] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [batchEvaluating, setBatchEvaluating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [batchModel, setBatchModel] = useState<string>("~google/gemini-pro-latest");
  const [colorSource, setColorSource] = useState<"RULE_BASED" | "LLM">("RULE_BASED");
  const [graphModel, setGraphModel] = useState<string>("~google/gemini-pro-latest");
  const [nodeLimit, setNodeLimit] = useState<number>(20);
  const [batchScope, setBatchScope] = useState<"all" | "visible">("all");
  const [graphReloadTrigger, setGraphReloadTrigger] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(480);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  const startResizingTouch = (touchEvent: React.TouchEvent) => {
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxWidth = window.innerWidth / 2;
      const newWidth = Math.max(480, Math.min(maxWidth, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const clientX = e.touches[0].clientX;
      const maxWidth = window.innerWidth / 2;
      const newWidth = Math.max(480, Math.min(maxWidth, clientX));
      setSidebarWidth(newWidth);
    };

    const handleTouchEnd = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isResizing]);

  // fetch transition-graph data from API on mount to calculate path volumes
  useEffect(() => {
    fetch(`/api/process-logs/${processLog.id}/transition-graph?nodeLimit=1000`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setGraphData(res.data);
        }
      })
      .catch((err) => console.error("failed to fetch transition graph for analytics", err));
  }, [processLog.id]);

  // helper to format duration in a human-readable format
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

  // helper to estimate and format token cost for display in cents, falling back to local calculation if null
  const formatCost = (costUsd: number | null | undefined, modelId: string | null | undefined) => {
    if (costUsd !== null && costUsd !== undefined) {
      const cents = costUsd * 100;
      return `${cents.toFixed(4)}¢`;
    }
    if (!modelId) return "n/a";
    // approximate fallback based on average prompt length (650 tokens) and completion length (250 tokens)
    const estimatedUsd = calculateLlmCost(modelId, 650, 250);
    const estimatedCents = estimatedUsd * 100;
    return `~${estimatedCents.toFixed(4)}¢`;
  };

  // helper to calculate suitability sub-scores for breakdown visualization
  const getSubScores = (act: Activity) => {
    const uniqueActivitiesCount = processLog.activities.length;

    // 1. standardization: case coverage (26.4%)
    const scoreCoverage = act.caseCoverage;

    // 2. standardization: execution duration coefficient of variation (32.2%)
    const cv = act.averageDuration > 0 ? Math.sqrt(act.durationVariance) / act.averageDuration : 0;
    // Use hyperbolic decay (1 / (1 + CV)) instead of linear clamping (1 - CV)
    // to map the coefficient of variation (CV) smoothly to [0, 1].
    // This prevents the score from collapsing to exactly 0% whenever CV >= 1.0,
    // ensuring the progress bar renders dynamically for all variation ranges.
    const scoreDurationVariance = 1 / (1 + cv);

    // 3. frequency: frequency ranking weight (18.6%)
    const sortedActivities = [...processLog.activities].sort((a, b) => b.frequency - a.frequency);
    const rankIndex = sortedActivities.findIndex((a) => a.id === act.id);
    const scoreFrequencyRank = uniqueActivitiesCount > 1 ? 1 - rankIndex / (uniqueActivitiesCount - 1) : 1;

    // 4. resource allocation: resource entropy (13.6%)
    const scoreResourceEntropy = act.resourceEntropy > 0 ? Math.max(0, 1 - act.resourceEntropy / 3) : 1;

    // 5. flow predictability: predecessor entropy (4.6%)
    const scorePredecessorEntropy = act.predecessorEntropy > 0 ? Math.max(0, 1 - act.predecessorEntropy / 3) : 1;

    // 6. flow predictability: successor entropy (4.6%)
    const scoreSuccessorEntropy = act.successorEntropy > 0 ? Math.max(0, 1 - act.successorEntropy / 3) : 1;

    // consolidate parameters
    return [
      {
        name: "Case Coverage",
        score: scoreCoverage * 100,
        weight: 26.4,
        desc: "percentage of cases that execute this activity.",
        value: `${(act.caseCoverage * 100).toFixed(1)}% coverage`,
      },
      {
        name: "Duration Predictability",
        score: scoreDurationVariance * 100,
        weight: 32.2,
        desc: "standardization based on duration variance. lower variance indicates predictable patterns.",
        value: `CV: ${cv.toFixed(2)}`,
      },
      {
        name: "Frequency Rank",
        score: scoreFrequencyRank * 100,
        weight: 18.6,
        desc: "relative frequency weight. frequent items offer higher automation return on investment.",
        value: `#${rankIndex + 1} of ${uniqueActivitiesCount}`,
      },
      {
        name: "Resource Specialization",
        score: scoreResourceEntropy * 100,
        weight: 13.6,
        desc: "diversity of resource allocation. lower values mean a specialized group performs the task.",
        value: `entropy: ${act.resourceEntropy.toFixed(2)}`,
      },
      {
        name: "Entry Predictability",
        score: scorePredecessorEntropy * 100,
        weight: 4.6,
        desc: "flow predictability of incoming connections.",
        value: `entropy: ${act.predecessorEntropy.toFixed(2)}`,
      },
      {
        name: "Exit Predictability",
        score: scoreSuccessorEntropy * 100,
        weight: 4.6,
        desc: "flow predictability of outgoing connections.",
        value: `entropy: ${act.successorEntropy.toFixed(2)}`,
      },
    ];
  };

  // find the selected activity details from the process log relation
  const activity = processLog.activities.find((act) => act.name === selectedActivity);
  const activityAssessment = selectedActivity && processLog.assessments
    ? processLog.assessments.find((a) => a.activityId === activity?.id && a.type === "RULE_BASED")
    : null;

  // resolve all LLM assessments for the selected activity
  const activityLlmAssessments = selectedActivity && processLog.assessments && activity
    ? processLog.assessments.filter(
        (a) => a.activityId === activity.id && a.type === "LLM_SINGLE_SHOT"
      )
    : [];

  // synchronize viewLlmModel state when selected activity or assessments collection changes
  useEffect(() => {
    if (activity && activityLlmAssessments.length > 0) {
      // default to the active selected model if an assessment exists for it, otherwise fallback to the first available
      const hasSelectedModel = activityLlmAssessments.some(a => a.model === selectedModel);
      if (hasSelectedModel) {
        setViewLlmModel(selectedModel);
      } else {
        setViewLlmModel(activityLlmAssessments[0].model);
      }
    } else {
      setViewLlmModel(null);
    }
  }, [selectedActivity, processLog.assessments]);

  // resolve currently viewed LLM assessment details based on selected tab
  const llmAssessment = selectedActivity && processLog.assessments && viewLlmModel
    ? processLog.assessments.find(
        (a) => a.activityId === activity?.id && a.type === "LLM_SINGLE_SHOT" && a.model === viewLlmModel
      )
    : null;

  // run single-activity LLM feasibility evaluation
  const handleRunLlmEvaluation = async () => {
    if (!activity) return;
    setEvaluating(true);
    setEvalError(null);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: activity.id,
          type: "LLM_SINGLE_SHOT",
          model: selectedModel,
        }),
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || "failed to evaluate activity");
      }

      // refresh Next.js server page content to fetch updated assessments
      router.refresh();

      // check if the model just evaluated is the same as the selected overlay model
      if (selectedModel === graphModel) {
        setGraphReloadTrigger((prev) => prev + 1);
      }
    } catch (err: any) {
      console.error(err);
      setEvalError(err.message || "failed to run evaluation");
    } finally {
      setEvaluating(false);
    }
  };

  // run batch LLM evaluations across activities
  const handleRunBatchLlmEvaluation = async () => {
    setBatchEvaluating(true);
    setBatchProgress(0);

    // filter target activities based on batchScope selection
    let targets = [...processLog.activities];
    if (batchScope === "visible") {
      const sorted = [...processLog.activities].sort((a, b) => b.frequency - a.frequency);
      targets = sorted.slice(0, Math.min(nodeLimit, sorted.length));
    }

    const total = targets.length;
    if (total === 0) {
      setBatchEvaluating(false);
      return;
    }

    // configure a concurrency limit pool of 3 workers
    const concurrencyLimit = 3;
    let activeIndex = 0;

    const worker = async () => {
      while (activeIndex < total) {
        const currentJobIndex = activeIndex++;
        const targetAct = targets[currentJobIndex];

        try {
          const response = await fetch("/api/assessments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              activityId: targetAct.id,
              type: "LLM_SINGLE_SHOT",
              model: batchModel,
            }),
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            console.error(`failed to evaluate activity ${targetAct.name}:`, errBody.error || "unknown error");
          }
        } catch (err) {
          console.error(`network error evaluating activity ${targetAct.name}:`, err);
        } finally {
          setBatchProgress((prev) => prev + 1);
        }
      }
    };

    // start worker pool
    const workers = Array.from({ length: Math.min(concurrencyLimit, total) }, () => worker());
    await Promise.all(workers);

    setBatchEvaluating(false);
    router.refresh();
    
    // invalidate transition graph fetch cache to trigger instant overlay refresh
    if (batchModel === graphModel) {
      setGraphReloadTrigger((prev) => prev + 1);
    }
  };

  // memoized metrics for dashboards
  const {
    top10Activities,
    maxFrequencyInTop10,
    donutData,
    totalEvents,
    top10Transitions,
    maxTransitionCount,
    pathDonutData,
    totalPathCases,
    top10Durations,
    maxDurationInTop10,
    top10Entropy,
    maxEntropyValue,
  } = useMemo(() => {
    // 1. frequency dashboard stats
    const sortedFreq = [...processLog.activities].sort((a, b) => b.frequency - a.frequency);
    const top10 = sortedFreq.slice(0, 10);
    const maxFreq = top10.length > 0 ? Math.max(...top10.map((a) => a.frequency)) : 1;

    const totalEv = processLog.activities.reduce((sum, a) => sum + a.frequency, 0);
    const top5 = sortedFreq.slice(0, 5);
    const top5Sum = top5.reduce((sum, a) => sum + a.frequency, 0);

    const donut = top5.map((a) => ({
      name: a.name,
      frequency: a.frequency,
      percentage: totalEv > 0 ? (a.frequency / totalEv) * 100 : 0,
    }));

    if (totalEv > top5Sum) {
      donut.push({
        name: "Other Activities",
        frequency: totalEv - top5Sum,
        percentage: totalEv > 0 ? ((totalEv - top5Sum) / totalEv) * 100 : 0,
      });
    }

    // 2. path dashboard stats
    const activityTransitions = (graphData?.edges || [])
      .filter((e) => e.source !== "__START__" && e.target !== "__END__")
      .sort((a, b) => b.count - a.count);

    const top10Tr = activityTransitions
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        count: e.count,
      }))
      .slice(0, 10);

    const maxTr = top10Tr.length > 0 ? top10Tr[0].count : 1;

    // calculate start & end steps
    const starts: { [key: string]: number } = {};
    const ends: { [key: string]: number } = {};

    if (graphData) {
      graphData.edges.forEach((edge) => {
        if (edge.source === "__START__") {
          starts[edge.target] = (starts[edge.target] || 0) + edge.count;
        }
        if (edge.target === "__END__") {
          ends[edge.source] = (ends[edge.source] || 0) + edge.count;
        }
      });
    }

    const startList = Object.entries(starts).map(([name, freq]) => ({ name, frequency: freq }));
    const endList = Object.entries(ends).map(([name, freq]) => ({ name, frequency: freq }));

    const targetList = activeTransitionType === "start" ? startList : endList;
    const sortedTargets = targetList.sort((a, b) => b.frequency - a.frequency);

    const totalPathC = sortedTargets.reduce((sum, a) => sum + a.frequency, 0);
    const top5Targets = sortedTargets.slice(0, 5);
    const top5TargetsSum = top5Targets.reduce((sum, a) => sum + a.frequency, 0);

    const pathDonut = top5Targets.map((t) => ({
      name: t.name,
      frequency: t.frequency,
      percentage: totalPathC > 0 ? (t.frequency / totalPathC) * 100 : 0,
    }));

    if (totalPathC > top5TargetsSum) {
      pathDonut.push({
        name: "Other Steps",
        frequency: totalPathC - top5TargetsSum,
        percentage: totalPathC > 0 ? ((totalPathC - top5TargetsSum) / totalPathC) * 100 : 0,
      });
    }

    // 3. performance dashboard stats
    const sortedDur = [...processLog.activities].sort((a, b) => {
      const aVal = activeDurationType === "average" ? a.averageDuration : a.medianDuration;
      const bVal = activeDurationType === "average" ? b.averageDuration : b.medianDuration;
      return bVal - aVal;
    });

    const top10D = sortedDur.slice(0, 10);
    const maxDur = top10D.length > 0
      ? Math.max(...top10D.map((a) => (activeDurationType === "average" ? a.averageDuration : a.medianDuration)))
      : 1;

    // branching entropy stats
    const sortedEnt = [...processLog.activities].sort(
      (a, b) => b.predecessorEntropy + b.successorEntropy - (a.predecessorEntropy + a.successorEntropy)
    );

    const top10E = sortedEnt.slice(0, 10);
    const maxEnt = top10E.length > 0
      ? Math.max(...top10E.flatMap((a) => [a.predecessorEntropy, a.successorEntropy]))
      : 1;

    return {
      top10Activities: top10,
      maxFrequencyInTop10: maxFreq,
      donutData: donut,
      totalEvents: totalEv,
      top10Transitions: top10Tr,
      maxTransitionCount: maxTr,
      pathDonutData: pathDonut,
      totalPathCases: totalPathC,
      top10Durations: top10D,
      maxDurationInTop10: maxDur,
      top10Entropy: top10E,
      maxEntropyValue: maxEnt,
    };
  }, [processLog.activities, graphData, activeTransitionType, activeDurationType]);

  // callback when comparing row in feasibility matrix
  const handleSelectAndCompare = (activityName: string, activeAssessmentsCount: number) => {
    setSelectedActivity(activityName);
    if (activeAssessmentsCount >= 2) {
      setIsCompareModalOpen(true);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-65px)] flex flex-row overflow-hidden bg-slate-50 select-none">
      {/* 1. Collapsible Left Sidebar */}
      <div
        style={{ width: `${sidebarWidth}px` }}
        className={`absolute top-0 left-0 h-full bg-white border-r shadow-2xl z-30 flex flex-col ${
          isResizing ? "transition-none" : "transition-transform duration-300 ease-in-out"
        } ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ minWidth: "480px" }}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b bg-slate-50/50 shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-800 truncate max-w-[340px]" title={processLog.name}>
                📊 Log: {processLog.name}
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                Analytics & Dashboards
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(false)}
              className="text-slate-400 hover:text-slate-600 rounded-full h-8 w-8 p-0"
            >
              ✕
            </Button>
          </div>

          {/* Dashboard Selector */}
          <div className="p-4 border-b bg-slate-50/30 shrink-0">
            <select
              value={selectedDashboard}
              onChange={(e) => setSelectedDashboard(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold cursor-pointer shadow-xs"
            >
              <option value="frequency">Activity Frequency Analysis</option>
              <option value="paths">Transition Path Analysis</option>
              <option value="performance">Performance & Standardization</option>
              <option value="comparison">LLM Feasibility Comparison Matrix</option>
            </select>
          </div>

          {/* Scrollable Dashboard Body */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {selectedDashboard === "frequency" && (
              <FrequencyDashboard
                top10Activities={top10Activities}
                maxFrequencyInTop10={maxFrequencyInTop10}
                donutData={donutData}
                totalEvents={totalEvents}
                hoveredSlice={hoveredSlice}
                setHoveredSlice={setHoveredSlice}
                isExpanded={sidebarWidth >= 800}
              />
            )}

            {selectedDashboard === "paths" && (
              <PathsDashboard
                top10Transitions={top10Transitions}
                maxTransitionCount={maxTransitionCount}
                pathDonutData={pathDonutData}
                totalPathCases={totalPathCases}
                hoveredPathSlice={hoveredPathSlice}
                setHoveredPathSlice={setHoveredPathSlice}
                activeTransitionType={activeTransitionType}
                setActiveTransitionType={setActiveTransitionType}
                isExpanded={sidebarWidth >= 800}
              />
            )}

            {selectedDashboard === "performance" && (
              <PerformanceDashboard
                activeDurationType={activeDurationType}
                setActiveDurationType={setActiveDurationType}
                top10Durations={top10Durations}
                maxDurationInTop10={maxDurationInTop10}
                formatDuration={formatDuration}
                top10Entropy={top10Entropy}
                maxEntropyValue={maxEntropyValue}
                isExpanded={sidebarWidth >= 800}
              />
            )}

            {selectedDashboard === "comparison" && (
              <FeasibilityMatrix
                activities={processLog.activities}
                assessments={processLog.assessments}
                onSelectAndCompare={handleSelectAndCompare}
                formatCost={formatCost}
                isExpanded={sidebarWidth >= 800}
              />
            )}
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={startResizing}
          onTouchStart={startResizingTouch}
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 select-none transition-colors ${
            isResizing ? "bg-blue-600" : "bg-transparent hover:bg-slate-200/60"
          }`}
        />
      </div>

      {/* 2. Main Graph Area */}
      <div className="flex-1 h-full relative z-10 bg-slate-50">
        {/* Floating Sidebar Toggle Button (Hamburger) */}
        {!isSidebarOpen && (
          <Button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 bg-white border hover:bg-slate-50 text-slate-700 shadow-md h-10 w-10 p-0 flex items-center justify-center rounded-lg"
            title="Open Dashboards"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </Button>
        )}

        {/* Floating Controls Box (Top Right) */}
        <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-xs border shadow-md p-4 rounded-xl flex flex-col gap-3.5 w-80 max-h-[calc(100%-32px)] overflow-y-auto text-slate-700">
          {/* Overlay Selection */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Graph Overlay
            </span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-1.5">
              <button
                onClick={() => setColorSource("RULE_BASED")}
                className={`flex-1 py-1 text-[10px] font-extrabold rounded transition-colors ${
                  colorSource === "RULE_BASED"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Rule-Based
              </button>
              <button
                onClick={() => setColorSource("LLM")}
                className={`flex-1 py-1 text-[10px] font-extrabold rounded transition-colors ${
                  colorSource === "LLM"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                LLM Overlay
              </button>
            </div>
            {colorSource === "LLM" && (
              <select
                value={graphModel}
                onChange={(e) => setGraphModel(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-700 rounded px-2.5 py-1 text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1 cursor-pointer"
              >
                {SUPPORTED_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Detail Node Limit Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <span>Node Density</span>
              <span className="text-blue-600 font-extrabold normal-case font-mono">{nodeLimit} nodes</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border p-2 rounded-lg">
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={nodeLimit}
                onChange={(e) => setNodeLimit(parseInt(e.target.value, 10))}
                className="flex-1 cursor-pointer accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Batch Evaluation Control Box */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Batch LLM Evaluator
            </span>
            <div className="bg-slate-50 border p-3 rounded-lg space-y-2.5">
              {/* scope select */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                <span className="text-slate-400 text-[10px]">Scope:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="batchScope"
                      value="all"
                      checked={batchScope === "all"}
                      onChange={() => setBatchScope("all")}
                      disabled={batchEvaluating}
                      className="w-3 h-3 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    All ({processLog.activities.length})
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="batchScope"
                      value="visible"
                      checked={batchScope === "visible"}
                      onChange={() => setBatchScope("visible")}
                      disabled={batchEvaluating}
                      className="w-3 h-3 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    Visible ({Math.min(nodeLimit, processLog.activities.length)})
                  </label>
                </div>
              </div>

              {/* model select */}
              <select
                disabled={batchEvaluating}
                value={batchModel}
                onChange={(e) => setBatchModel(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-700 rounded py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold cursor-pointer"
              >
                {SUPPORTED_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>

              {/* run button */}
              <Button
                disabled={batchEvaluating}
                onClick={handleRunBatchLlmEvaluation}
                size="sm"
                className="w-full bg-slate-800 hover:bg-slate-900 text-xs font-semibold text-white h-8 shadow-sm flex items-center justify-center gap-1.5"
              >
                {batchEvaluating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Evaluating ({batchProgress}/{batchScope === "all" ? processLog.activities.length : Math.min(nodeLimit, processLog.activities.length)})...
                  </>
                ) : (
                  "Evaluate Batch"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Process Transition Map Canvas */}
        <ProcessGraph
          processLogId={processLog.id}
          onNodeSelect={setSelectedActivity}
          assessmentType={colorSource === "RULE_BASED" ? "RULE_BASED" : "LLM_SINGLE_SHOT"}
          model={colorSource === "RULE_BASED" ? null : graphModel}
          nodeLimit={nodeLimit}
          onNodeLimitChange={setNodeLimit}
          reloadTrigger={graphReloadTrigger}
          isSidebarOpen={isSidebarOpen}
          sidebarWidth={sidebarWidth}
          isResizing={isResizing}
        />
      </div>

      {/* 3. popup overlay modal for activity details */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 select-text">
          {/* backdrop layer */}
          <div
            onClick={() => setSelectedActivity(null)}
            className="absolute inset-0 bg-slate-900/25 transition-opacity duration-300"
          />

          {/* modal container */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* close button */}
            <button
              onClick={() => setSelectedActivity(null)}
              className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full shadow-xs transition-all z-20 font-black text-sm"
              title="Close Panel"
            >
              ✕
            </button>
            {/* modal scroll content wrapper */}
            <div className="flex-1 overflow-y-auto p-6 pt-10 custom-scrollbar">
              <ActivityDetailsPanel
                selectedActivity={selectedActivity}
                activity={activity || null}
                activityAssessment={activityAssessment || null}
                activityLlmAssessments={activityLlmAssessments}
                llmAssessment={llmAssessment || null}
                viewLlmModel={viewLlmModel}
                setViewLlmModel={setViewLlmModel}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                evaluating={evaluating}
                evalError={evalError}
                handleRunLlmEvaluation={handleRunLlmEvaluation}
                setIsCompareModalOpen={setIsCompareModalOpen}
                formatDuration={formatDuration}
                formatCost={formatCost}
                getSubScores={getSubScores}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Side-by-Side Comparison Modal */}
      <ComparativeWorkbenchModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        activity={activity || null}
        activityLlmAssessments={activityLlmAssessments}
        formatCost={formatCost}
      />
    </div>
  );
}
