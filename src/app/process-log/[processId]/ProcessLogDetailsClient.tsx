"use client";

import { useState, memo, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessLog, Activity, Assessment } from "@/types/models";
import ProcessGraph from "@/features/visualization/ProcessGraph";
import { Clock, Users, ArrowRightLeft, Info } from "lucide-react";

interface ProcessLogDetailsClientProps {
  processLog: ProcessLog & {
    activities: Activity[];
    assessments: Assessment[];
  };
}

// helper component to display explanation tooltip on hover
const MetricTooltip = memo(({
  text,
  align = "center",
  position = "top"
}: {
  text: string;
  align?: "center" | "right";
  position?: "top" | "bottom";
}) => {
  return (
    <span className="group relative cursor-default inline-flex items-center text-slate-400 hover:text-slate-600 transition-colors">
      <Info className="w-3.5 h-3.5 ml-1" />
      <span className={`absolute mb-1.5 hidden group-hover:block w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-lg z-30 font-normal normal-case leading-normal text-left break-words ${
        position === "bottom"
          ? "top-full mt-1.5 bottom-auto mb-0"
          : "bottom-full mb-1.5 top-auto mt-0"
      } ${
        align === "right"
          ? "right-0 translate-x-[15%] left-auto"
          : "left-1/2 -translate-x-1/2"
      }`}>
        {text}
        {/* tiny arrow tooltip indicator */}
        <span className={`absolute border-4 border-transparent ${
          position === "bottom"
            ? "bottom-full border-b-slate-900 border-t-transparent top-auto"
            : "top-full border-t-slate-900 border-b-transparent bottom-auto"
        } ${
          align === "right"
            ? "right-[36px] left-auto"
            : "left-1/2 -translate-x-1/2"
        }`} />
      </span>
    </span>
  );
});
MetricTooltip.displayName = "MetricTooltip";

export default function ProcessLogDetailsClient({ processLog }: ProcessLogDetailsClientProps) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<string>("frequency");
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [activeTransitionType, setActiveTransitionType] = useState<"start" | "end">("start");
  const [hoveredPathSlice, setHoveredPathSlice] = useState<number | null>(null);
  const [activeDurationType, setActiveDurationType] = useState<"average" | "median">("average");
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] } | null>(null);

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

  // helper to calculate suitability sub-scores for breakdown visualization
  const getSubScores = (act: Activity) => {
    const uniqueActivitiesCount = processLog.activities.length;

    // 1. standardization: case coverage (26.4%)
    const scoreCoverage = act.caseCoverage;

    // 2. complexity: path entropy (24.1%)
    const complexityEntropy = (act.predecessorEntropy + act.successorEntropy) / 2;
    const maxExpectedEntropy = Math.log2(Math.max(2, uniqueActivitiesCount));
    const scoreComplexity = Math.max(0, 1 - (maxExpectedEntropy > 0 ? complexityEntropy / maxExpectedEntropy : 0));

    // 3. time-consuming: execution duration (19.5%)
    const avgSec = act.averageDuration / 1000;
    const logDuration = avgSec > 0 ? Math.log10(avgSec + 1) : 0;
    const scoreDuration = Math.min(1, logDuration / 5);

    // 4. repetitiveness: total execution frequency (18.4%)
    const logFreq = Math.log10(act.frequency + 1);
    const scoreFrequency = Math.min(1, logFreq / 4);

    // 5. predictability: duration variance (10.3%)
    const stdDev = Math.sqrt(act.durationVariance);
    const cv = act.averageDuration > 0 ? stdDev / act.averageDuration : 0;
    const scorePredictability = Math.exp(-cv);

    // 6. resource fragmentation: resource entropy (1.3%)
    const maxExpectedResourceEntropy = Math.log2(Math.max(2, act.resourceCount));
    const scoreResource = maxExpectedResourceEntropy > 0
      ? Math.max(0, 1 - act.resourceEntropy / maxExpectedResourceEntropy)
      : 1;

    return [
      {
        name: "Standardization",
        desc: "measures how consistently this step appears across cases. high coverage minimizes custom variations.",
        weight: 26.4,
        score: scoreCoverage * 100,
        value: `${(act.caseCoverage * 100).toFixed(0)}% coverage`,
      },
      {
        name: "Complexity",
        desc: "evaluates sequential branching. lower path entropy means a straightforward, standard process sequence.",
        weight: 24.1,
        score: scoreComplexity * 100,
        value: `${complexityEntropy.toFixed(2)} entropy`,
      },
      {
        name: "Time-consuming",
        desc: "assesses potential time savings. longer steps yield higher automation benefits.",
        weight: 19.5,
        score: scoreDuration * 100,
        value: formatDuration(act.averageDuration),
      },
      {
        name: "Repetitiveness",
        desc: "counts total occurrences. highly frequent steps maximize RPA return on investment.",
        weight: 18.4,
        score: scoreFrequency * 100,
        value: `${act.frequency.toLocaleString()}x executions`,
      },
      {
        name: "Predictability",
        desc: "analyzes duration variance. low duration coefficient of variation indicates standardized, predictable execution.",
        weight: 10.3,
        score: scorePredictability * 100,
        value: `CV: ${cv.toFixed(2)}`,
      },
      {
        name: "Resource Specialization",
        desc: "examines task allocation. lower resource entropy implies a small, specialized group handles it.",
        weight: 1.3,
        score: scoreResource * 100,
        value: `${act.resourceCount} resources`,
      },
    ];
  };

  // find the selected activity details from the process log relation
  const activity = processLog.activities.find((act) => act.name === selectedActivity);
  const activityAssessment = selectedActivity && processLog.assessments
    ? processLog.assessments.find((a) => a.activityId === activity?.id && a.type === "RULE_BASED")
    : null;

  // sort and filter activity statistics for the dashboard
  const sortedActivities = [...processLog.activities].sort((a, b) => b.frequency - a.frequency);
  const totalEvents = processLog.activities.reduce((sum, act) => sum + act.frequency, 0);

  // calculate top 10 activities for the bar chart
  const top10Activities = sortedActivities.slice(0, 10);
  const maxFrequencyInTop10 = top10Activities.length > 0 ? top10Activities[0].frequency : 1;

  // calculate top 5 activities + "others" group for the donut chart
  const top5Activities = sortedActivities.slice(0, 5);
  const othersFrequency = sortedActivities.slice(5).reduce((sum, act) => sum + act.frequency, 0);

  const donutData = top5Activities.map((act) => ({
    name: act.name,
    frequency: act.frequency,
    percentage: totalEvents > 0 ? (act.frequency / totalEvents) * 100 : 0,
  }));

  if (othersFrequency > 0) {
    donutData.push({
      name: "Others",
      frequency: othersFrequency,
      percentage: totalEvents > 0 ? (othersFrequency / totalEvents) * 100 : 0,
    });
  }

  // list of harmonious colors for the donut slices
  const sliceColors = [
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // rose
    "#64748b", // slate (for "others")
  ];

  // ─── path transition data calculations ─────────────────────────────────────
  
  // calculate top 10 transitions excluding start/end placeholders
  const activityTransitions = (graphData?.edges || [])
    .filter((e) => e.source !== "__START__" && e.target !== "__END__")
    .sort((a, b) => b.count - a.count);

  const top10Transitions = activityTransitions.slice(0, 10);
  const maxTransitionCount = top10Transitions.length > 0 ? top10Transitions[0].count : 1;

  // calculate start and end transition points for the path donut chart
  const startEdges = (graphData?.edges || []).filter((e) => e.source === "__START__");
  const endEdges = (graphData?.edges || []).filter((e) => e.target === "__END__");
  
  const selectedPathEdges = activeTransitionType === "start" ? startEdges : endEdges;
  const totalPathCases = selectedPathEdges.reduce((sum, e) => sum + e.count, 0);

  const sortedPathTransitions = [...selectedPathEdges]
    .map((e) => ({
      name: activeTransitionType === "start" ? e.target : e.source,
      count: e.count,
    }))
    .sort((a, b) => b.count - a.count);

  const top5Paths = sortedPathTransitions.slice(0, 5);
  const othersPathsCount = sortedPathTransitions.slice(5).reduce((sum, t) => sum + t.count, 0);

  const pathDonutData = top5Paths.map((t) => ({
    name: t.name,
    frequency: t.count,
    percentage: totalPathCases > 0 ? (t.count / totalPathCases) * 100 : 0,
  }));

  if (othersPathsCount > 0) {
    pathDonutData.push({
      name: "Others",
      frequency: othersPathsCount,
      percentage: totalPathCases > 0 ? (othersPathsCount / totalPathCases) * 100 : 0,
    });
  }

  // ─── performance & standardization calculations ───────────────────────────
  
  // calculate top 10 activities by selected duration type
  const durationSorted = [...processLog.activities].sort((a, b) => {
    const valA = activeDurationType === "average" ? a.averageDuration : a.medianDuration;
    const valB = activeDurationType === "average" ? b.averageDuration : b.medianDuration;
    return valB - valA;
  });
  const top10Durations = durationSorted.slice(0, 10);
  const maxDurationInTop10 = top10Durations.length > 0 
    ? (activeDurationType === "average" ? top10Durations[0].averageDuration : top10Durations[0].medianDuration)
    : 1;

  // calculate top 10 activities by combined branching complexity
  const entropySorted = [...processLog.activities].sort(
    (a, b) => (b.predecessorEntropy + b.successorEntropy) - (a.predecessorEntropy + a.successorEntropy)
  );
  const top10Entropy = entropySorted.slice(0, 10);
  const maxEntropyValue = Math.max(
    ...top10Entropy.map((a) => Math.max(a.predecessorEntropy, a.successorEntropy)),
    1
  );

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{processLog.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            File: <span className="font-mono">{processLog.fileName}</span> • Size: {(
              processLog.fileSize /
              1024 /
              1024
            ).toFixed(2)}{" "}
            MB
          </p>
          <span
            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset mt-2 ${
              processLog.status === "READY"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                : processLog.status === "ERROR"
                ? "bg-rose-50 text-rose-700 ring-rose-600/10"
                : "bg-amber-50 text-amber-700 ring-amber-600/10"
            }`}
          >
            {processLog.status}
          </span>
        </div>
        <Link href="/upload">
          <Button variant="outline">Back to uploads</Button>
        </Link>
      </div>

      {/* React Flow Graph (Full Width) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Process Transition Map
          </h2>
          <p className="text-xs text-muted-foreground">
            Select a node to inspect activity details
          </p>
        </div>
        <ProcessGraph processLogId={processLog.id} onNodeSelect={setSelectedActivity} />
      </div>

      {/* Process Log Analytics */}
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
          </select>
        </CardHeader>
        <CardContent className="p-6">
          {selectedDashboard === "frequency" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* left column: horizontal bar chart */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                  Top 10 Most Frequent Activities
                  <MetricTooltip text="frequency of execution for the top 10 most active process steps." />
                </h4>
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] flex flex-col justify-between">
                  {top10Activities.map((act) => {
                    const percent = (act.frequency / maxFrequencyInTop10) * 100;
                    return (
                      <div key={act.name} className="flex items-center text-xs gap-3">
                        <span
                          className="w-28 text-slate-600 font-medium truncate"
                          title={act.name}
                        >
                          {act.name}
                        </span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative group">
                          <div
                            style={{ width: `${percent}%` }}
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 group-hover:brightness-110"
                          />
                        </div>
                        <span className="w-12 text-right font-semibold text-slate-700">
                          {act.frequency.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* right column: donut chart */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                  Activity Volume Share
                  <MetricTooltip text="relative percentage share of total event volume by activity." />
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] items-center">
                  
                  {/* circular donut */}
                  <div className="relative flex justify-center items-center h-44">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      {/* base grid circle */}
                      <circle
                        cx="80"
                        cy="80"
                        r="50"
                        fill="transparent"
                        stroke="#e2e8f0"
                        strokeWidth="12"
                      />
                      {(() => {
                        let accumulatedPercent = 0;
                        // compute rotation angles in original order first to preserve positions
                        const preparedSlices = donutData.map((slice, index) => {
                          const circumference = 314.16;
                          const strokeDasharray = `${(slice.percentage / 100) * circumference} ${circumference}`;
                          // calculate rotation angle so each segment starts exactly where the previous ended
                          const rotationAngle = -90 + (accumulatedPercent / 100) * 360;
                          accumulatedPercent += slice.percentage;
                          return {
                            ...slice,
                            index,
                            strokeDasharray,
                            rotationAngle,
                          };
                        });

                        // sort so that the hovered slice is rendered last (on top of others)
                        const sortedForRender = [...preparedSlices].sort((a, b) => {
                          if (a.index === hoveredSlice) return 1;
                          if (b.index === hoveredSlice) return -1;
                          return 0;
                        });

                        return sortedForRender.map((slice) => {
                          const color = sliceColors[slice.index % sliceColors.length];
                          const isHovered = hoveredSlice === slice.index;

                          return (
                            <circle
                              key={slice.name}
                              cx="80"
                              cy="80"
                              r="50"
                              fill="transparent"
                              stroke={color}
                              strokeWidth={isHovered ? "16" : "12"}
                              style={{
                                strokeDasharray: slice.strokeDasharray,
                                strokeDashoffset: 0,
                              }}
                              transform={`rotate(${slice.rotationAngle} 80 80)`}
                              className="transition-[stroke-width] duration-200 cursor-pointer"
                              onMouseEnter={() => setHoveredSlice(slice.index)}
                              onMouseLeave={() => setHoveredSlice(null)}
                            />
                          );
                        });
                      })()}
                    </svg>
                    
                    {/* center info overlay */}
                    <div className="absolute flex flex-col justify-center items-center pointer-events-none w-24 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-full">
                        {hoveredSlice !== null ? donutData[hoveredSlice].name : "Total Events"}
                      </span>
                      <strong className="text-base font-extrabold text-slate-800 mt-0.5">
                        {hoveredSlice !== null 
                          ? donutData[hoveredSlice].frequency.toLocaleString()
                          : totalEvents.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* legend list */}
                  <div className="space-y-1.5 justify-center flex flex-col">
                    {donutData.map((slice, index) => {
                      const color = sliceColors[index % sliceColors.length];
                      const isHovered = hoveredSlice === index;
                      return (
                        <div
                          key={slice.name}
                          className={`flex items-center text-xs justify-between p-1 rounded transition-colors duration-150 ${
                            isHovered ? "bg-white shadow-sm border border-slate-100" : "border border-transparent"
                          }`}
                          onMouseEnter={() => setHoveredSlice(index)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          <div className="flex items-center gap-2 truncate pr-1">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-slate-600 font-medium truncate" title={slice.name}>
                              {slice.name}
                            </span>
                          </div>
                          <span className="text-slate-700 font-semibold flex-shrink-0">
                            {slice.percentage.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>

            </div>
          )}

          {selectedDashboard === "paths" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* left column: top 10 transitions bar chart */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                  Top 10 Sequence Transitions
                  <MetricTooltip text="shows the most frequent transitions between consecutive activities." />
                </h4>
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] flex flex-col justify-between">
                  {top10Transitions.length > 0 ? (
                    top10Transitions.map((trans) => {
                      const percent = (trans.count / maxTransitionCount) * 100;
                      return (
                        <div key={trans.id} className="flex items-center text-xs gap-3">
                          <span
                            className="w-36 text-slate-600 font-medium truncate flex items-center gap-1"
                            title={`${trans.source} → ${trans.target}`}
                          >
                            <span className="truncate max-w-[64px]">{trans.source}</span>
                            <span className="text-slate-400 text-[10px]">→</span>
                            <span className="truncate max-w-[64px]">{trans.target}</span>
                          </span>
                          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative group">
                            <div
                              style={{ width: `${percent}%` }}
                              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500 group-hover:brightness-110"
                            />
                          </div>
                          <span className="w-12 text-right font-semibold text-slate-700">
                            {trans.count.toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      No transitions found
                    </div>
                  )}
                </div>
              </div>

              {/* right column: toggleable start and end step donut chart */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                    Start & End Step Distribution
                    <MetricTooltip text="distribution of activities that initiate or terminate cases." />
                  </h4>
                  {/* start/end step toggle buttons */}
                  <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                    <button
                      onClick={() => {
                        setActiveTransitionType("start");
                        setHoveredPathSlice(null);
                      }}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                        activeTransitionType === "start"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Start Steps
                    </button>
                    <button
                      onClick={() => {
                        setActiveTransitionType("end");
                        setHoveredPathSlice(null);
                      }}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                        activeTransitionType === "end"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      End Steps
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] items-center">
                  
                  {/* circular path donut */}
                  <div className="relative flex justify-center items-center h-44">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      {/* base circle backdrop */}
                      <circle
                        cx="80"
                        cy="80"
                        r="50"
                        fill="transparent"
                        stroke="#e2e8f0"
                        strokeWidth="12"
                      />
                      {(() => {
                        let accumulatedPercent = 0;
                        // pre-calculate segment rotation angles in sequence first
                        const preparedSlices = pathDonutData.map((slice, index) => {
                          const circumference = 314.16;
                          const strokeDasharray = `${(slice.percentage / 100) * circumference} ${circumference}`;
                          const rotationAngle = -90 + (accumulatedPercent / 100) * 360;
                          accumulatedPercent += slice.percentage;
                          return {
                            ...slice,
                            index,
                            strokeDasharray,
                            rotationAngle,
                          };
                        });

                        // sort rendering circles to draw hovered slice last (on top)
                        const sortedForRender = [...preparedSlices].sort((a, b) => {
                          if (a.index === hoveredPathSlice) return 1;
                          if (b.index === hoveredPathSlice) return -1;
                          return 0;
                        });

                        return sortedForRender.map((slice) => {
                          const color = sliceColors[slice.index % sliceColors.length];
                          const isHovered = hoveredPathSlice === slice.index;

                          return (
                            <circle
                              key={slice.name}
                              cx="80"
                              cy="80"
                              r="50"
                              fill="transparent"
                              stroke={color}
                              strokeWidth={isHovered ? "16" : "12"}
                              style={{
                                strokeDasharray: slice.strokeDasharray,
                                strokeDashoffset: 0,
                              }}
                              transform={`rotate(${slice.rotationAngle} 80 80)`}
                              className="transition-[stroke-width] duration-200 cursor-pointer"
                              onMouseEnter={() => setHoveredPathSlice(slice.index)}
                              onMouseLeave={() => setHoveredPathSlice(null)}
                            />
                          );
                        });
                      })()}
                    </svg>
                    
                    {/* display hovered step name and absolute frequency inside circle */}
                    <div className="absolute flex flex-col justify-center items-center pointer-events-none w-24 text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-full">
                        {hoveredPathSlice !== null ? pathDonutData[hoveredPathSlice].name : "Total Cases"}
                      </span>
                      <strong className="text-base font-extrabold text-slate-800 mt-0.5">
                        {hoveredPathSlice !== null 
                          ? pathDonutData[hoveredPathSlice].frequency.toLocaleString()
                          : totalPathCases.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* path legend list */}
                  <div className="space-y-1.5 justify-center flex flex-col">
                    {pathDonutData.length > 0 ? (
                      pathDonutData.map((slice, index) => {
                        const color = sliceColors[index % sliceColors.length];
                        const isHovered = hoveredPathSlice === index;
                        return (
                          <div
                            key={slice.name}
                            className={`flex items-center text-xs justify-between p-1 rounded transition-colors duration-150 ${
                              isHovered ? "bg-white shadow-sm border border-slate-100" : "border border-transparent"
                            }`}
                            onMouseEnter={() => setHoveredPathSlice(index)}
                            onMouseLeave={() => setHoveredPathSlice(null)}
                          >
                            <div className="flex items-center gap-2 truncate pr-1">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-slate-600 font-medium truncate" title={slice.name}>
                                {slice.name}
                              </span>
                            </div>
                            <span className="text-slate-700 font-semibold flex-shrink-0">
                              {slice.percentage.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-slate-400 text-xs py-4">
                        No steps recorded
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>
          )}

          {selectedDashboard === "performance" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* left column: execution duration per activity (toggleable) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                    {activeDurationType === "average" ? "Average Duration" : "Median Duration"}
                    <MetricTooltip text="shows the execution duration for the top 10 longest-running activities." />
                  </h4>
                  {/* average/median toggle buttons */}
                  <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                    <button
                      onClick={() => setActiveDurationType("average")}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                        activeDurationType === "average"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Average
                    </button>
                    <button
                      onClick={() => setActiveDurationType("median")}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                        activeDurationType === "median"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Median
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] flex flex-col justify-between">
                  {top10Durations.length > 0 ? (
                    top10Durations.map((act) => {
                      const durationVal = activeDurationType === "average" ? act.averageDuration : act.medianDuration;
                      const percent = (durationVal / maxDurationInTop10) * 100;
                      return (
                        <div key={act.name} className="flex items-center text-xs gap-3">
                          <span
                            className="w-28 text-slate-600 font-medium truncate"
                            title={act.name}
                          >
                            {act.name}
                          </span>
                          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative group">
                            <div
                              style={{ width: `${percent}%` }}
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 group-hover:brightness-110"
                            />
                          </div>
                          <span className="w-16 text-right font-semibold text-slate-700">
                            {formatDuration(durationVal)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      No duration data found
                    </div>
                  )}
                </div>
              </div>

              {/* right column: branching complexity (incoming vs outgoing) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                    Branching Complexity (Entropy)
                    <MetricTooltip text="predecessor and successor path entropy. lower values mean higher predictability (ideal for RPA)." />
                  </h4>
                  {/* legend for entropy types */}
                  <div className="flex gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-blue-600">
                      <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                      In
                    </span>
                    <span className="flex items-center gap-1 text-purple-600">
                      <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm" />
                      Out
                    </span>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] flex flex-col justify-between">
                  {top10Entropy.length > 0 ? (
                    top10Entropy.map((act) => {
                      const predPercent = (act.predecessorEntropy / maxEntropyValue) * 100;
                      const succPercent = (act.successorEntropy / maxEntropyValue) * 100;
                      return (
                        <div key={act.name} className="flex items-start text-xs gap-3">
                          <span
                            className="w-28 text-slate-600 font-medium truncate pt-0.5"
                            title={act.name}
                          >
                            {act.name}
                          </span>
                          
                          {/* stacked predecessor and successor bars */}
                          <div className="flex-1 space-y-1.5 pt-0.5">
                            {/* predecessor bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative group">
                                <div
                                  style={{ width: `${predPercent}%` }}
                                  className="h-full bg-blue-500 rounded-full transition-all duration-500 group-hover:brightness-115"
                                />
                              </div>
                              <span className="w-8 text-right font-mono text-[10px] text-slate-500 font-medium">
                                {act.predecessorEntropy.toFixed(2)}
                              </span>
                            </div>
                            
                            {/* successor bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative group">
                                <div
                                  style={{ width: `${succPercent}%` }}
                                  className="h-full bg-purple-500 rounded-full transition-all duration-500 group-hover:brightness-115"
                                />
                              </div>
                              <span className="w-8 text-right font-mono text-[10px] text-slate-500 font-medium">
                                {act.successorEntropy.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      No entropy data found
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Panel (At the Bottom) */}
      <Card className="min-h-[200px] flex flex-col border shadow-md">
        <CardHeader className="border-b bg-slate-50/50">
          <CardTitle>Activity Details</CardTitle>
          <CardDescription>
            {selectedActivity ? "Profile and metrics" : "No activity selected"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center p-6 overflow-y-auto">
          {activity ? (
            <div className="space-y-6 text-left">
              {/* title and primary status */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">
                    Selected Activity
                  </span>
                  <h3 className="text-xl font-bold text-slate-800 break-all mt-0.5">{activity.name}</h3>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="bg-slate-50 border px-3 py-1.5 rounded-md">
                    <span className="text-xs text-slate-500 flex items-center font-medium">
                      Frequency
                      <MetricTooltip text="total number of times this activity was executed across all log events." align="right" position="bottom" />
                    </span>
                    <strong className="text-slate-800 text-base">{activity.frequency.toLocaleString()}x</strong>
                  </div>
                  <div className="bg-slate-50 border px-3 py-1.5 rounded-md">
                    <span className="text-xs text-slate-500 flex items-center font-medium">
                      Case Coverage
                      <MetricTooltip text="percentage of process cases containing this activity at least once." align="right" position="bottom" />
                    </span>
                    <strong className="text-slate-800 text-base">{(activity.caseCoverage * 100).toFixed(1)}%</strong>
                  </div>
                  {activityAssessment && (
                    <div className="bg-slate-50 border px-3 py-1.5 rounded-md flex flex-col justify-between">
                      <span className="text-xs text-slate-500 flex items-center font-medium">
                        Automation Potential
                        <MetricTooltip text="rule-based feasibility score calculated from repetition, standardized paths, predictability, and duration." align="right" position="bottom" />
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <strong className="text-slate-800 text-base">{activityAssessment.score}%</strong>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          activityAssessment.label === "HIGH"
                            ? "bg-emerald-100 text-emerald-800"
                            : activityAssessment.label === "MEDIUM"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}>
                          {activityAssessment.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* rule-based reasoning block */}
              {activityAssessment && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs leading-relaxed space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    Rule-Based Feasibility Analysis
                  </div>
                  <p>{activityAssessment.reasoning}</p>
                </div>
              )}

              {/* suitability score breakdown grid */}
              {activityAssessment && (
                <div className="space-y-3">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                    Suitability Score Breakdown
                    <MetricTooltip text="shows the normalized scores and relative contributions of the six Delphi expert parameters used to calculate the automation potential." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 border rounded-lg">
                    {getSubScores(activity).map((param) => {
                      const contribution = (param.score * (param.weight / 100)).toFixed(1);
                      return (
                        <div key={param.name} className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              {param.name}
                              <MetricTooltip text={param.desc} />
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              weight: {param.weight}% | contr: +{contribution}%
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${param.score}%` }}
                                className={`h-full rounded-full transition-all duration-500 ${
                                  param.score >= 70
                                    ? "bg-emerald-500"
                                    : param.score >= 40
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                              />
                            </div>
                            <span className="w-24 text-right font-medium text-slate-600 text-[10px] truncate" title={param.value}>
                              {param.value}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3-column metrics grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* column 1: time & variability */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-slate-700 border-b pb-1 text-sm">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="flex items-center">
                      Duration & Variance
                      <MetricTooltip text="summarizes execution durations and predictability. lower variance indicates a highly standardized process step." />
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        Average Duration:
                        <MetricTooltip text="average time spent executing this activity." />
                      </span>
                      <strong className="text-slate-800">{formatDuration(activity.averageDuration)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        Median Duration:
                        <MetricTooltip text="median execution time. 50% of executions are faster than this, and 50% are slower." />
                      </span>
                      <strong className="text-slate-800">{formatDuration(activity.medianDuration)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        Min Duration:
                        <MetricTooltip text="shortest recorded execution time for this activity." />
                      </span>
                      <strong className="text-slate-800">{formatDuration(activity.minDuration)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        Max Duration:
                        <MetricTooltip text="longest recorded execution time for this activity." />
                      </span>
                      <strong className="text-slate-800">{formatDuration(activity.maxDuration)}</strong>
                    </div>
                    <div className="flex justify-between items-center border-t pt-1.5 mt-1">
                      <span className="flex items-center">
                        Standard Deviation:
                        <MetricTooltip text="standard deviation (variability) of execution times. lower values indicate a predictable, highly standardized task (ideal for automation)." />
                      </span>
                      <strong className="text-slate-800">
                        ±{formatDuration(Math.sqrt(activity.durationVariance))}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* column 2: resources & diversity */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-slate-700 border-b pb-1 text-sm">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="flex items-center">
                      Resource Allocation
                      <MetricTooltip text="summarizes resource counts and specialization. lower entropy indicates the task is consistently handled by a specific group." />
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        Total Resources:
                        <MetricTooltip text="number of unique users or resources who performed this activity." />
                      </span>
                      <strong className="text-slate-800">{activity.resourceCount}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        Resource Entropy:
                        <MetricTooltip text="diversity of resource allocation. lower values mean a specialized group consistently performs this task." />
                      </span>
                      <strong className="text-slate-800">{activity.resourceEntropy.toFixed(3)}</strong>
                    </div>
                    <div className="border-t pt-1.5 mt-1">
                      <span className="block mb-1 text-[10px] uppercase font-bold text-slate-400">Resource List:</span>
                      <div className="max-h-16 overflow-y-auto font-mono text-[10px] text-slate-500 bg-white p-1.5 rounded border leading-tight">
                        {activity.resources.length > 0 ? activity.resources.join(", ") : "No resources recorded"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* column 3: context & standardization */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-slate-700 border-b pb-1 text-sm">
                    <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                    <span className="flex items-center">
                      Process Context Flow
                      <MetricTooltip text="summarizes incoming and outgoing process connections. lower entropy represents a straight-through flow with minimal branching logic." align="right" />
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        Predecessor Entropy:
                        <MetricTooltip text="predictability of the preceding step. lower values mean this activity is consistently entered from the same source activity." />
                      </span>
                      <strong className="text-slate-800">{activity.predecessorEntropy.toFixed(3)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        Successor Entropy:
                        <MetricTooltip text="predictability of the succeeding step. lower values mean this activity consistently leads to the same next activity." />
                      </span>
                      <strong className="text-slate-800">{activity.successorEntropy.toFixed(3)}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t pt-1.5 mt-1">
                      <div>
                        <span className="block mb-1 text-[10px] uppercase font-bold text-slate-400">Predecessors:</span>
                        <div className="max-h-16 overflow-y-auto font-mono text-[9px] text-slate-500 bg-white p-1 rounded border leading-tight">
                          {activity.predecessors.length > 0 ? activity.predecessors.join(", ") : "None"}
                        </div>
                      </div>
                      <div>
                        <span className="block mb-1 text-[10px] uppercase font-bold text-slate-400">Successors:</span>
                        <div className="max-h-16 overflow-y-auto font-mono text-[9px] text-slate-500 bg-white p-1 rounded border leading-tight">
                          {activity.successors.length > 0 ? activity.successors.join(", ") : "None"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <span className="text-4xl block">🔍</span>
              <p className="text-sm font-medium text-slate-500">
                Select an activity node in the process map to view details
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
