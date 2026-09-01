import { Activity, Assessment } from "@/types/models";
import { SUPPORTED_MODELS } from "@/features/automation-scoring/openrouter";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { Clock, Users, ArrowRightLeft, Sparkles, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";

interface ActivityDetailsPanelProps {
  selectedActivity: string | null;
  activity: Activity | null;
  activityAssessment: Assessment | null;
  activityLlmAssessments: Assessment[];
  llmAssessment: Assessment | null;
  viewLlmAssessmentId: string | null;
  setViewLlmAssessmentId: (id: string | null) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  evalType: "LLM_SINGLE_SHOT" | "LLM_AGENTIC";
  setEvalType: (type: "LLM_SINGLE_SHOT" | "LLM_AGENTIC") => void;
  liveThinkingTrace?: any[];
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
  viewLlmAssessmentId,
  setViewLlmAssessmentId,
  selectedModel,
  setSelectedModel,
  evalType,
  setEvalType,
  liveThinkingTrace = [],
  evaluating,
  evalError,
  handleRunLlmEvaluation,
  setIsCompareModalOpen,
  formatDuration,
  formatCost,
  getSubScores,
}: ActivityDetailsPanelProps) {
  const activeTrace = (evaluating && liveThinkingTrace && liveThinkingTrace.length > 0)
    ? liveThinkingTrace
    : (llmAssessment?.rawResponse as any)?.thinkingTrace;
  const isLiveTrace = evaluating && liveThinkingTrace && liveThinkingTrace.length > 0;

  const renderThinkingTrace = (traceSteps: any[], isLive: boolean = false) => {
    if (!traceSteps || traceSteps.length === 0) return null;
    return (
      <div className="card bg-slate-900 text-slate-100 p-4 rounded-sm space-y-3 font-mono text-xs border border-slate-700 shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2 text-[10px] uppercase font-bold tracking-wider text-teal-400">
          <div className="flex items-center gap-1.5">
            <i className="material-icons text-sm text-teal-400" style={{ fontSize: "16px" }}>psychology</i>
            <span>Agent Thinking Trace (Chain-of-Thought)</span>
            {isLive && (
              <span className="flex items-center gap-1 text-purple-400 ml-2 animate-pulse font-normal">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Streaming Steps Live...</span>
              </span>
            )}
          </div>
          <span className="text-slate-400 text-[9px]">
            {isLive ? `${traceSteps.length} Steps Received` : "6-Step Deep Execution"}
          </span>
        </div>

        <div className="space-y-2.5">
          {traceSteps.map((step: any, idx: number) => (
            <div key={idx} className="space-y-1 bg-slate-800/80 p-2.5 rounded-sm border border-slate-700/60 text-[11px] transition-all duration-200">
              <div className="flex items-center justify-between text-teal-300 font-semibold text-[10px] uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                  <span>Step {idx + 1}: {step.title}</span>
                </span>
                <span className="text-slate-400 text-[9px] lowercase font-normal">{step.type}</span>
              </div>
              <p className="text-slate-200 font-light leading-relaxed whitespace-pre-wrap">{step.content}</p>

              {step.type === "retrieval" && step.details && (
                <div className="mt-2 bg-slate-950 p-2 rounded text-[10px] text-teal-200 border border-slate-800 space-y-1">
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Retrieved Tool Metrics:</div>
                  {Object.entries(step.details).map(([k, metric]: [string, any]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">{k}:</span>
                      <span className="font-semibold text-teal-300">{metric.description || metric.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[200px] flex flex-col font-sans text-slate-800">
      <div className="flex-1 flex flex-col justify-center">
        {activity ? (
          <div className="space-y-6 text-left">
            {/* title and primary status */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 gap-2">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-600">
                  Selected Activity
                </span>
                <span className="text-xl font-bold text-slate-850 break-all mt-0.5 block" style={{ fontSize: "20px", fontWeight: "bold" }}>{activity.name}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="card bg-white z-depth-1 border border-slate-200 px-3 py-1.5 rounded-sm flex flex-col justify-between shadow-xs">
                  <span className="text-xs text-slate-500 flex items-center font-medium">
                    Frequency
                    <MetricTooltip text="total number of times this activity was executed across all log events." align="right" position="bottom" />
                  </span>
                  <strong className="text-slate-800 text-base font-bold">{activity.frequency.toLocaleString()}x</strong>
                </div>
                <div className="card bg-white z-depth-1 border border-slate-200 px-3 py-1.5 rounded-sm flex flex-col justify-between shadow-xs">
                  <span className="text-xs text-slate-500 flex items-center font-medium">
                    Case Coverage
                    <MetricTooltip text="percentage of process cases containing this activity at least once." align="right" position="bottom" />
                  </span>
                  <strong className="text-slate-800 text-base font-bold">{(activity.caseCoverage * 100).toFixed(1)}%</strong>
                </div>
                {activityAssessment && (
                  <div className="card bg-white z-depth-1 border border-slate-200 px-3 py-1.5 rounded-sm flex flex-col justify-between shadow-xs">
                    <span className="text-xs text-slate-500 flex items-center font-medium">
                      Rule-Based Automation Potential
                      <MetricTooltip text="rule-based feasibility score calculated using the Delphi consensus weights of Farinha et al. (2024)." align="right" position="bottom" />
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <strong className="text-slate-800 text-base font-bold">{activityAssessment.score}%</strong>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-white ${
                        activityAssessment.label === "HIGH"
                          ? "bg-teal-500"
                          : activityAssessment.label === "MEDIUM"
                          ? "bg-orange-500"
                          : "bg-pink-500"
                      }`}>
                        {activityAssessment.label}
                      </span>
                    </div>
                  </div>
                )}
                <div className="card bg-white z-depth-1 border border-slate-200 px-3 py-1.5 rounded-sm flex flex-col justify-between shadow-xs">
                  <span className="text-xs text-slate-500 flex items-center font-medium">
                    LLM Automation Potential
                    <MetricTooltip text="semantic and cognitive feasibility score evaluated using a generative AI LLM on OpenRouter." align="right" position="bottom" />
                  </span>
                  {llmAssessment ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <strong className="text-slate-800 text-base font-bold">{llmAssessment.score}%</strong>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-white ${
                        llmAssessment.label === "HIGH"
                          ? "bg-teal-500"
                          : llmAssessment.label === "MEDIUM"
                          ? "bg-orange-500"
                          : "bg-pink-500"
                      }`}>
                        {llmAssessment.label}
                      </span>
                      <span className="text-[10px] text-slate-450 font-light ml-1">
                        via {llmAssessment.model ? (SUPPORTED_MODELS.find(m => m.id === llmAssessment.model)?.name || llmAssessment.model.split("/").pop()) : "Unknown"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center mt-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-400 border border-slate-200">
                        NOT EVALUATED
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* rule-based reasoning block */}
            {activityAssessment && (
              <div className="card bg-white z-depth-1 border border-slate-200 p-4 rounded-sm text-slate-700 text-xs leading-relaxed space-y-1">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Rule-Based Feasibility Analysis
                </div>
                <p className="font-light leading-relaxed">{activityAssessment.reasoning}</p>
              </div>
            )}

            {/* suitability score breakdown grid */}
            {activityAssessment && (
              <div className="space-y-3">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                  Suitability Score Breakdown
                  <MetricTooltip text="shows the normalized scores and relative contributions of the six Delphi expert parameters used to calculate the automation potential." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white z-depth-1 border border-slate-200 p-4 rounded-sm">
                  {getSubScores(activity).map((param) => {
                    const contribution = (param.score * (param.weight / 100)).toFixed(1);
                    return (
                      <div key={param.name} className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-slate-750 flex items-center gap-1">
                            {param.name}
                            <MetricTooltip text={param.desc} />
                          </span>
                          <span className="text-slate-400 font-bold text-[10px]">
                            weight: {param.weight}% | contr: +{contribution}%
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-100 rounded-xs overflow-hidden relative">
                            <div
                              style={{ width: `${param.score}%` }}
                              className={`h-full rounded-xs transition-all duration-500 ${
                                param.score >= 70
                                  ? "bg-teal-500"
                                  : param.score >= 40
                                  ? "bg-orange-500"
                                  : "bg-pink-500"
                              }`}
                            />
                          </div>
                          <span className="w-24 text-right font-semibold text-slate-550 text-[10px] truncate" title={param.value}>
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
                <div className="flex items-center gap-2 font-semibold text-slate-750 border-b border-slate-200 pb-1 text-sm">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span className="flex items-center">
                    Duration & Variance
                    <MetricTooltip text="summarizes execution durations and predictability. lower variance indicates a highly standardized process step." />
                  </span>
                </div>
                <div className="space-y-2 text-xs text-slate-600 bg-white z-depth-1 p-3.5 rounded-sm border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center font-light">
                      Average Duration:
                      <MetricTooltip text="average time spent executing this activity." />
                    </span>
                    <strong className="text-slate-800">{formatDuration(activity.averageDuration)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center font-light">
                      Median Duration:
                      <MetricTooltip text="median execution time. 50% of executions are faster than this, and 50% are slower." />
                    </span>
                    <strong className="text-slate-800">{formatDuration(activity.medianDuration)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center font-light">
                      Min Duration:
                      <MetricTooltip text="shortest recorded execution time for this activity." />
                    </span>
                    <strong className="text-slate-800">{formatDuration(activity.minDuration)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center font-light">
                      Max Duration:
                      <MetricTooltip text="longest recorded execution time for this activity." />
                    </span>
                    <strong className="text-slate-800">{formatDuration(activity.maxDuration)}</strong>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 mt-1">
                    <span className="flex items-center font-light">
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
                <div className="flex items-center gap-2 font-semibold text-slate-755 border-b border-slate-200 pb-1 text-sm">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span className="flex items-center">
                    Resource Allocation
                    <MetricTooltip text="summarizes resource counts and specialization. lower entropy indicates the task is consistently handled by a specific group." />
                  </span>
                </div>
                <div className="space-y-2 text-xs text-slate-600 bg-white z-depth-1 p-3.5 rounded-sm border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center font-light">
                      Total Resources:
                      <MetricTooltip text="number of unique users or resources who performed this activity." />
                    </span>
                    <strong className="text-slate-800">{activity.resourceCount}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center font-light">
                      Resource Entropy:
                      <MetricTooltip text="diversity of resource allocation. lower values mean a specialized group consistently performs this task." />
                    </span>
                    <strong className="text-slate-800">{activity.resourceEntropy.toFixed(3)}</strong>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 mt-1">
                    <span className="block mb-1 text-[10px] uppercase font-bold text-slate-400">Resource List:</span>
                    <div className="max-h-16 overflow-y-auto font-mono text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-sm border border-slate-200 leading-tight">
                      {activity.resources.length > 0 ? activity.resources.join(", ") : "No resources recorded"}
                    </div>
                  </div>
                </div>
              </div>

              {/* column 3: context & flow */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-slate-755 border-b border-slate-200 pb-1 text-sm">
                  <ArrowRightLeft className="w-4 h-4 text-teal-655" />
                  <span className="flex items-center">
                    Process Context Flow
                    <MetricTooltip text="summarizes incoming and outgoing process connections. lower entropy represents a straight-through flow with minimal branching logic." align="right" />
                  </span>
                </div>
                <div className="space-y-2 text-xs text-slate-600 bg-white z-depth-1 p-3.5 rounded-sm border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center font-light">
                      Predecessor Entropy:
                      <MetricTooltip text="predictability of the preceding step. lower values mean this activity is consistently entered from the same source activity." />
                    </span>
                    <strong className="text-slate-800">{activity.predecessorEntropy.toFixed(3)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center font-light">
                      Successor Entropy:
                      <MetricTooltip text="predictability of the succeeding step. lower values mean this activity consistently leads to the same next activity." />
                    </span>
                    <strong className="text-slate-800">{activity.successorEntropy.toFixed(3)}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-1.5 mt-1">
                    <div>
                      <span className="block mb-1 text-[10px] uppercase font-bold text-slate-400">Predecessors:</span>
                      <div className="max-h-16 overflow-y-auto font-mono text-[9px] text-slate-500 bg-slate-50 p-1 rounded-sm border border-slate-200 leading-tight">
                        {activity.predecessors.length > 0 ? activity.predecessors.join(", ") : "None"}
                      </div>
                    </div>
                    <div>
                      <span className="block mb-1 text-[10px] uppercase font-bold text-slate-400">Successors:</span>
                      <div className="max-h-16 overflow-y-auto font-mono text-[9px] text-slate-500 bg-slate-50 p-1 rounded-sm border border-slate-200 leading-tight">
                        {activity.successors.length > 0 ? activity.successors.join(", ") : "None"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* LLM Semantic Feasibility Analysis */}
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5 block" style={{ fontSize: "14px", fontWeight: "bold" }}>
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  LLM Feasibility Analysis
                </span>
                {llmAssessment && (
                  <span className="text-[10px] text-slate-500 font-semibold font-mono">
                    model: {llmAssessment.model}
                  </span>
                )}
              </div>

              {evalError && (
                <div className="card border-l-4 border-red-500 bg-red-50 p-3 text-xs font-semibold text-red-800">
                  {evalError}
                </div>
              )}

              {llmAssessment ? (
                <div className="space-y-4">
                  {/* model evaluation tabs and comparison workbench trigger */}
                  {activityLlmAssessments.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      {/* model selection tabs */}
                      <div className="flex flex-wrap gap-1.5">
                        {activityLlmAssessments.map((asm) => {
                          const modelInfo = SUPPORTED_MODELS.find(m => m.id === asm.model);
                          const displayName = modelInfo?.name || asm.model?.split("/").pop() || "Unknown Model";
                          const isSelected = viewLlmAssessmentId === asm.id;
                          const isAgentic = asm.type === "LLM_AGENTIC";
                          return (
                            <button
                              key={asm.id}
                              onClick={() => {
                                setViewLlmAssessmentId(asm.id);
                                setEvalType(asm.type as any);
                                if (asm.model) setSelectedModel(asm.model);
                              }}
                              className={`text-[9px] px-2.5 py-1 rounded-sm border uppercase tracking-wider font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                                isSelected
                                  ? isAgentic ? "bg-purple-700 text-white border-purple-700 font-bold shadow-sm" : "bg-teal-600 text-white border-teal-600 font-bold shadow-sm"
                                  : isAgentic ? "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200" : "bg-white text-slate-500 hover:bg-slate-50 border-slate-200"
                              }`}
                            >
                              <span>{displayName}</span>
                              <span className={`text-[7px] px-1 py-0.2 rounded font-mono ${isAgentic ? (isSelected ? "bg-purple-900 text-purple-100" : "bg-purple-200 text-purple-800") : (isSelected ? "bg-teal-800 text-teal-100" : "bg-slate-100 text-slate-600")}`}>
                                {isAgentic ? "Agentic" : "Single"}
                              </span>
                              <span>({asm.score}%)</span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setIsCompareModalOpen(true)}
                        className="btn-small waves-effect waves-light teal darken-1 border-0 cursor-pointer text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                        style={{ height: "26px", lineHeight: "26px", fontSize: "10px" }}
                      >
                        <i className="material-icons left text-sm" style={{ margin: "0 2px 0 0", fontSize: "14px", lineHeight: "26px" }}>compare_arrows</i>
                        <span>Compare</span>
                      </button>
                    </div>
                  )}
                  {/* reasoning block */}
                  <div className="card bg-teal-50/5 border border-teal-200 p-4 rounded-sm text-slate-700 text-xs leading-relaxed space-y-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-teal-600 flex items-center justify-between">
                      <span>AI Assessment Reasoning</span>
                      {llmAssessment.type === "LLM_AGENTIC" && (
                        <div className="flex items-center gap-1.5">
                          {(llmAssessment.rawResponse as any)?.rpaArchetypeLabel && (
                            <span className="bg-blue-100 text-blue-800 text-[9px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider border border-blue-200">
                              {(llmAssessment.rawResponse as any).rpaArchetypeLabel}
                            </span>
                          )}
                          {(llmAssessment.rawResponse as any)?.implementationEffort && (
                            <span className="bg-purple-100 text-purple-800 text-[9px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider border border-purple-200">
                              Effort: {(llmAssessment.rawResponse as any).implementationEffort}
                            </span>
                          )}
                          <span className="bg-purple-600 text-white text-[9px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-wider shadow-xs">
                            6-Step Agentic Loop
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="font-light leading-relaxed">{llmAssessment.reasoning}</p>

                    {(llmAssessment.rawResponse as any)?.effortRationale && (
                      <div className="text-[10px] text-slate-500 font-mono border-t border-teal-100 pt-2 flex justify-between">
                        <span>Implementation Note: {(llmAssessment.rawResponse as any).effortRationale}</span>
                        {(llmAssessment.rawResponse as any)?.estimatedMonthlyHoursSaved !== undefined && (
                          <span className="font-bold text-teal-700">~{(llmAssessment.rawResponse as any).estimatedMonthlyHoursSaved} hrs/mo saved</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Agent Thinking Trace (Chain of Thought) */}
                  {renderThinkingTrace(activeTrace, isLiveTrace)}

                  {/* risks & missing info columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">                    {/* column 1: risks */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-pink-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Identified Automation Risks
                      </div>
                      <div className="bg-pink-50/10 border border-pink-200 p-3 rounded-sm text-xs min-h-[100px] flex flex-col justify-start">
                        {llmAssessment.risks.length > 0 ? (
                          <ul className="browser-default list-disc pl-4 space-y-1.5 text-slate-700 font-light">
                            {llmAssessment.risks.map((risk, index) => (
                              <li key={index}>{risk}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-400 italic my-auto text-center font-light">No major risks identified</p>
                        )}
                      </div>
                    </div>

                    {/* column 2: missing info */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-orange-500 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Missing Information Requirements
                      </div>
                      <div className="bg-orange-50/10 border border-orange-255 p-3 rounded-sm text-xs min-h-[100px] flex flex-col justify-start">
                        {llmAssessment.missingInfo.length > 0 ? (
                          <ul className="browser-default list-disc pl-4 space-y-1.5 text-slate-700 font-light">
                            {llmAssessment.missingInfo.map((info, index) => (
                              <li key={index}>{info}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-400 italic my-auto text-center font-light">No missing details required</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* API metadata & re-evaluate options */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50 p-3 rounded-sm border border-slate-200 gap-3">
                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-450 font-mono">
                      {llmAssessment.latencyMs !== null && (
                        <div>
                          latency: <strong className="text-slate-700">{(llmAssessment.latencyMs / 1000).toFixed(2)}s</strong>
                        </div>
                      )}
                      <div>
                        cost: <strong className="text-slate-700">{formatCost(llmAssessment.costUsd, llmAssessment.model)}</strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                      <select
                        disabled={evaluating}
                        value={evalType}
                        onChange={(e) => setEvalType(e.target.value as any)}
                        className="browser-default font-medium text-xs text-slate-700 cursor-pointer"
                        style={{
                          display: "block",
                          width: "auto",
                          height: "32px",
                          padding: "2px",
                          border: "none",
                          borderBottom: "1px solid #9e9e9e",
                          backgroundColor: "transparent"
                        }}
                      >
                        <option value="LLM_SINGLE_SHOT">Single-Shot Prompt</option>
                        <option value="LLM_AGENTIC">Agentic Loop (with Trace)</option>
                      </select>

                      <select
                        disabled={evaluating}
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="browser-default font-medium text-xs text-slate-700 cursor-pointer"
                        style={{
                          display: "block",
                          width: "auto",
                          height: "32px",
                          padding: "2px",
                          border: "none",
                          borderBottom: "1px solid #9e9e9e",
                          backgroundColor: "transparent"
                        }}
                      >
                        {SUPPORTED_MODELS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={evaluating}
                        onClick={handleRunLlmEvaluation}
                        className="btn-flat waves-effect text-slate-700 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        style={{ height: "32px", lineHeight: "32px", fontSize: "11px", border: "1px solid #e0e0e0" }}
                      >
                        {evaluating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            <span>Re-evaluating...</span>
                          </>
                        ) : (
                          "Re-evaluate"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {renderThinkingTrace(activeTrace, isLiveTrace)}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-teal-50/10 border border-teal-200 p-4 rounded-sm">
                  <div className="flex-1 space-y-1">
                    <span className="font-semibold text-xs text-teal-850 flex items-center gap-1.5 block" style={{ fontSize: "12px", fontWeight: "bold" }}>
                      <Sparkles className="w-3.5 h-3.5 text-teal-605" />
                      Run LLM Automation Feasibility Assessment
                    </span>
                    <p className="text-xs text-slate-550 leading-normal font-light">
                      uses generative AI to analyze the activity label semantically, checking cognitive complexity, manual rule density, OCR needs, and potential business exceptions.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0">
                    <select
                      disabled={evaluating}
                      value={evalType}
                      onChange={(e) => setEvalType(e.target.value as any)}
                      className="browser-default font-medium text-xs text-slate-700 cursor-pointer"
                      style={{
                        display: "block",
                        width: "auto",
                        height: "32px",
                        padding: "2px",
                        border: "none",
                        borderBottom: "1px solid #9e9e9e",
                        backgroundColor: "transparent"
                      }}
                    >
                      <option value="LLM_SINGLE_SHOT">Single-Shot Prompt</option>
                      <option value="LLM_AGENTIC">Agentic Loop (with Trace)</option>
                    </select>

                    <select
                      disabled={evaluating}
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="browser-default font-medium text-xs text-slate-700 cursor-pointer"
                      style={{
                        display: "block",
                        width: "auto",
                        height: "32px",
                        padding: "2px",
                        border: "none",
                        borderBottom: "1px solid #9e9e9e",
                        backgroundColor: "transparent"
                      }}
                    >
                      {SUPPORTED_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={evaluating}
                      onClick={handleRunLlmEvaluation}
                      className="btn waves-effect waves-light teal darken-1 text-xs font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer border-0"
                      style={{ height: "32px", lineHeight: "32px", fontSize: "11px" }}
                    >
                      {evaluating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          Evaluating...
                        </>
                      ) : (
                        "Evaluate Activity"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-2">
            <span className="text-4xl block">🔍</span>
            <p className="text-sm font-medium text-slate-400 font-light">
              Select an activity node in the process map to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
