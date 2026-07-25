import { Activity, Assessment } from "@/types/models";
import { SUPPORTED_MODELS } from "@/features/automation-scoring/openrouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { Clock, Users, ArrowRightLeft, Sparkles, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";

interface ActivityDetailsPanelProps {
  selectedActivity: string | null;
  activity: Activity | null;
  activityAssessment: Assessment | null;
  activityLlmAssessments: Assessment[];
  llmAssessment: Assessment | null;
  viewLlmModel: string | null;
  setViewLlmModel: (model: string | null) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  evaluating: boolean;
  evalError: string | null;
  handleRunLlmEvaluation: () => void;
  setIsCompareModalOpen: (open: boolean) => void;
  formatDuration: (ms: number) => string;
  formatCost: (costUsd: number | null | undefined, modelId: string | null | undefined) => string;
  getSubScores: (act: Activity) => { name: string; score: number; weight: number; desc: string; value: string }[];
}

export default function ActivityDetailsPanel({
  selectedActivity,
  activity,
  activityAssessment,
  activityLlmAssessments,
  llmAssessment,
  viewLlmModel,
  setViewLlmModel,
  selectedModel,
  setSelectedModel,
  evaluating,
  evalError,
  handleRunLlmEvaluation,
  setIsCompareModalOpen,
  formatDuration,
  formatCost,
  getSubScores,
}: ActivityDetailsPanelProps) {
  return (
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
                      Rule-Based Automation Potential
                      <MetricTooltip text="rule-based feasibility score calculated using the Delphi consensus weights of Farinha et al. (2024)." align="right" position="bottom" />
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
                <div className="bg-slate-50 border px-3 py-1.5 rounded-md flex flex-col justify-between">
                  <span className="text-xs text-slate-500 flex items-center font-medium">
                    LLM Automation Potential
                    <MetricTooltip text="semantic and cognitive feasibility score evaluated using a generative AI LLM on OpenRouter." align="right" position="bottom" />
                  </span>
                  {llmAssessment ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <strong className="text-slate-800 text-base">{llmAssessment.score}%</strong>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        llmAssessment.label === "HIGH"
                          ? "bg-emerald-100 text-emerald-800"
                          : llmAssessment.label === "MEDIUM"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}>
                        {llmAssessment.label}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium ml-1">
                        via {llmAssessment.model ? (SUPPORTED_MODELS.find(m => m.id === llmAssessment.model)?.name || llmAssessment.model.split("/").pop()) : "Unknown"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        NOT EVALUATED
                      </span>
                    </div>
                  )}
                </div>
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

              {/* column 3: context & flow */}
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

            {/* LLM Semantic Feasibility Analysis */}
            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  LLM Feasibility Analysis
                </h4>
                {llmAssessment && (
                  <span className="text-[10px] text-slate-500 font-medium font-mono">
                    model: {llmAssessment.model}
                  </span>
                )}
              </div>

              {evalError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-lg font-medium">
                  {evalError}
                </div>
              )}

              {llmAssessment ? (
                <div className="space-y-4">
                  {/* model evaluation tabs and comparison workbench trigger */}
                  {activityLlmAssessments.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                      {/* model selection tabs */}
                      <div className="flex flex-wrap gap-1.5">
                        {activityLlmAssessments.map((asm) => {
                          const modelInfo = SUPPORTED_MODELS.find(m => m.id === asm.model);
                          const displayName = modelInfo?.name || asm.model?.split("/").pop() || "Unknown Model";
                          const isSelected = viewLlmModel === asm.model;
                          return (
                            <button
                              key={asm.id}
                              onClick={() => setViewLlmModel(asm.model)}
                              className={`text-[10px] px-2.5 py-1 rounded-full border transition-all duration-150 ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-sm"
                                  : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                              }`}
                            >
                              {displayName} ({asm.score}%)
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCompareModalOpen(true)}
                        className="text-[10px] h-6 px-2 font-bold border-blue-100 text-blue-700 bg-blue-50/50 hover:bg-blue-100 flex items-center gap-1 shadow-xs"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                        Compare
                      </Button>
                    </div>
                  )}
                  {/* reasoning block */}
                  <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-lg text-slate-700 text-xs leading-relaxed space-y-1">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-blue-600">
                      AI Assessment Reasoning
                    </div>
                    <p>{llmAssessment.reasoning}</p>
                  </div>

                  {/* risks & missing info columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* column 1: risks */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Identified Automation Risks
                      </div>
                      <div className="bg-rose-50/20 border border-rose-100 p-3 rounded-lg text-xs min-h-[100px] flex flex-col justify-start">
                        {llmAssessment.risks.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-700">
                            {llmAssessment.risks.map((risk, index) => (
                              <li key={index}>{risk}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-400 italic my-auto text-center">No major risks identified</p>
                        )}
                      </div>
                    </div>

                    {/* column 2: missing info */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-amber-600 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Missing Information Requirements
                      </div>
                      <div className="bg-amber-50/20 border border-amber-100 p-3 rounded-lg text-xs min-h-[100px] flex flex-col justify-start">
                        {llmAssessment.missingInfo.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-700">
                            {llmAssessment.missingInfo.map((info, index) => (
                              <li key={index}>{info}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-400 italic my-auto text-center">No missing details required</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* API metadata & re-evaluate options */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50 p-3 rounded-lg border gap-3">
                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 font-mono">
                      {llmAssessment.latencyMs !== null && (
                        <div>
                          latency: <strong className="text-slate-700">{(llmAssessment.latencyMs / 1000).toFixed(2)}s</strong>
                        </div>
                      )}
                      <div>
                        cost: <strong className="text-slate-700">{formatCost(llmAssessment.costUsd, llmAssessment.model)}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <select
                        disabled={evaluating}
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-white border rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {SUPPORTED_MODELS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        disabled={evaluating}
                        onClick={handleRunLlmEvaluation}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 font-medium shrink-0"
                      >
                        {evaluating ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Re-evaluating...
                          </>
                        ) : (
                          "Re-evaluate"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-blue-50/30 p-4 border border-blue-100 rounded-lg">
                  <div className="flex-1 space-y-1">
                    <h5 className="font-semibold text-xs text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      Run LLM Automation Feasibility Assessment
                    </h5>
                    <p className="text-xs text-blue-700/80 leading-normal">
                      uses generative AI to analyze the activity label semantically, checking cognitive complexity, manual rule density, OCR needs, and potential business exceptions.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0">
                    <select
                      disabled={evaluating}
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-white border rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    >
                      {SUPPORTED_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      disabled={evaluating}
                      onClick={handleRunLlmEvaluation}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white h-8"
                    >
                      {evaluating ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                          Evaluate Activity
                        </>
                      ) : (
                        "Evaluate Activity"
                      )}
                    </Button>
                  </div>
                </div>
              )}
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
  );
}
