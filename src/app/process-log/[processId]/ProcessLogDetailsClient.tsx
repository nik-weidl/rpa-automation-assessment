"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessLog, Activity, Assessment } from "@/types/models";
import ProcessGraph from "@/features/visualization/ProcessGraph";
import { Loader2 } from "lucide-react";
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
  const [nodeLimit, setNodeLimit] = useState<number>(30);
  const [batchScope, setBatchScope] = useState<"all" | "visible">("all");
  const [graphReloadTrigger, setGraphReloadTrigger] = useState<number>(0);

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
    const scoreDurationVariance = cv > 0 ? Math.max(0, 1 - cv) : 1;

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            📊 Process Log: <span className="text-blue-600 font-extrabold">{processLog.name}</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Analyze execution behavior, path predictability, and run generative AI automation potential evaluations.
          </p>
        </div>

        {/* Batch Evaluate Control Box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-slate-50 border p-3 rounded-lg gap-3">
          <div className="space-y-2.5">
            {/* scope radios */}
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 pl-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Scope:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="batchScope"
                  value="all"
                  checked={batchScope === "all"}
                  onChange={() => setBatchScope("all")}
                  disabled={batchEvaluating}
                  className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                All ({processLog.activities.length})
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="batchScope"
                  value="visible"
                  checked={batchScope === "visible"}
                  onChange={() => setBatchScope("visible")}
                  disabled={batchEvaluating}
                  className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                Visible ({Math.min(nodeLimit, processLog.activities.length)})
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                disabled={batchEvaluating}
                value={batchModel}
                onChange={(e) => setBatchModel(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 rounded py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
              >
                {SUPPORTED_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <Button
                disabled={batchEvaluating}
                onClick={handleRunBatchLlmEvaluation}
                size="sm"
                className="bg-slate-800 hover:bg-slate-900 text-xs font-semibold text-white h-7 shadow-sm px-3"
              >
                {batchEvaluating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                    Evaluating ({batchProgress} / {batchScope === "all" ? processLog.activities.length : Math.min(nodeLimit, processLog.activities.length)})...
                  </>
                ) : (
                  "Evaluate Batch"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Process Graph Panel */}
      <div className="bg-white border rounded-xl shadow-md p-6 relative overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-4 gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              🗺️ Process Transition Map
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              interactive node-link diagram mapping common execution pathways. thicker connections represent higher transition counts.
            </p>
          </div>
          
          {/* overlay togglers */}
          <div className="flex flex-wrap items-center bg-slate-100 p-0.75 rounded-lg border border-slate-200 gap-1 sm:gap-2">
            <div className="flex p-0.5 rounded bg-white/80 border border-slate-200/50 shadow-xs">
              <button
                onClick={() => setColorSource("RULE_BASED")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                  colorSource === "RULE_BASED"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Rule-Based Overlay
              </button>
              <button
                onClick={() => setColorSource("LLM")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
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
                className="bg-white border rounded ml-1.5 px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                {SUPPORTED_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <ProcessGraph
          processLogId={processLog.id}
          onNodeSelect={setSelectedActivity}
          assessmentType={colorSource === "RULE_BASED" ? "RULE_BASED" : "LLM_SINGLE_SHOT"}
          model={colorSource === "RULE_BASED" ? null : graphModel}
          nodeLimit={nodeLimit}
          onNodeLimitChange={setNodeLimit}
          reloadTrigger={graphReloadTrigger}
        />
      </div>

      {/* Process Log Analytics Card */}
      <Card className="border shadow-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 border-b bg-slate-50/50">
          <div>
            <CardTitle>Process Log Analytics</CardTitle>
            <CardDescription>Visual insights into event frequencies and execution paths</CardDescription>
          </div>
          {/* Dropdown Selector */}
          <select
            value={selectedDashboard}
            onChange={(e) => setSelectedDashboard(e.target.value)}
            className="w-full sm:w-64 bg-white border border-slate-200 text-slate-700 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
          >
            <option value="frequency">Activity Frequency Analysis</option>
            <option value="paths">Transition Path Analysis</option>
            <option value="performance">Performance & Standardization</option>
            <option value="comparison">LLM Feasibility Comparison Matrix</option>
          </select>
        </CardHeader>
        <CardContent className="p-6">
          {selectedDashboard === "frequency" && (
            <FrequencyDashboard
              top10Activities={top10Activities}
              maxFrequencyInTop10={maxFrequencyInTop10}
              donutData={donutData}
              totalEvents={totalEvents}
              hoveredSlice={hoveredSlice}
              setHoveredSlice={setHoveredSlice}
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
            />
          )}

          {selectedDashboard === "comparison" && (
            <FeasibilityMatrix
              activities={processLog.activities}
              assessments={processLog.assessments}
              onSelectAndCompare={handleSelectAndCompare}
              formatCost={formatCost}
            />
          )}
        </CardContent>
      </Card>

      {/* Details Panel (At the Bottom) */}
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

      {/* Side-by-Side Comparison Modal */}
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
