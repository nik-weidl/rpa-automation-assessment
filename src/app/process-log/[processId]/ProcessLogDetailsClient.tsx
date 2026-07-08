"use client";

import { useState, memo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessLog, Activity } from "@/types/models";
import ProcessGraph from "@/features/visualization/ProcessGraph";
import { Clock, Users, ArrowRightLeft, Info } from "lucide-react";

interface ProcessLogDetailsClientProps {
  processLog: ProcessLog & {
    activities: Activity[];
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

  // find the selected activity details from the process log relation
  const activity = processLog.activities.find((act) => act.name === selectedActivity);

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
                <div className="flex gap-4 text-sm">
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
                </div>
              </div>

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
