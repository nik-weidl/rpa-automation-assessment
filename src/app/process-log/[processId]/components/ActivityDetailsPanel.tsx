import { Activity, Assessment } from "@/types/models";
import { SUPPORTED_MODELS } from "@/features/automation-scoring/openrouter";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { Clock, Users, ArrowRightLeft, Bot, AlertTriangle, HelpCircle, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";

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
  const getRawResponseObject = (assessment: Assessment | null) => {
    if (!assessment || !assessment.rawResponse) return null;
    if (typeof assessment.rawResponse === "object") return assessment.rawResponse as any;
    if (typeof assessment.rawResponse === "string") {
      try {
        return JSON.parse(assessment.rawResponse);
      } catch {
        return null;
      }
    }
    return null;
  };

  const rawObj = getRawResponseObject(llmAssessment);
  const activeTrace = (evaluating && liveThinkingTrace && liveThinkingTrace.length > 0)
    ? liveThinkingTrace
    : rawObj?.thinkingTrace;
  const isLiveTrace = evaluating && liveThinkingTrace && liveThinkingTrace.length > 0;

  const traceContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTrace && activeTrace.length > 0) {
      traceContainerRef.current?.scrollTo({
        top: traceContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeTrace?.length]);

  const renderThinkingTrace = (traceSteps: any[], isLive: boolean = false) => {
    if (evaluating && (!traceSteps || traceSteps.length === 0)) {
      return (
        <div className="bg-slate-50 p-4 rounded-sm space-y-3 font-mono text-xs border border-slate-200 shadow-sm text-slate-800">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] uppercase font-bold tracking-wider text-purple-700">
            <div className="flex items-center gap-1.5">
              <i className="material-icons text-sm text-purple-700" style={{ fontSize: "16px" }}>psychology</i>
              <span>Agent Thinking Trace (Live Execution Stream)</span>
              <span className="flex items-center gap-1 text-purple-600 ml-2 animate-pulse font-normal">
                <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                <span>Initializing Agentic Loop...</span>
              </span>
            </div>
            <span className="text-slate-500 text-[9px]">Connecting Stream...</span>
          </div>
          <div className="p-4 bg-white rounded-sm border border-slate-200 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-purple-700 font-semibold text-xs animate-pulse">
              <Bot className="w-4 h-4 text-purple-600" />
              <span>Agent is formulating Turn 1 hypothesis & selecting tools...</span>
            </div>
            <p className="text-[10px] text-slate-500">Analyzing process metrics, trace variants, and graph connections...</p>
          </div>
        </div>
      );
    }

    if (!traceSteps || traceSteps.length === 0) {
      if (evalType === "LLM_AGENTIC" || llmAssessment?.type === "LLM_AGENTIC") {
        return (
          <div className="bg-slate-50 p-4 rounded-sm space-y-3 font-mono text-xs border border-slate-200 shadow-sm text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] uppercase font-bold tracking-wider text-purple-700">
              <div className="flex items-center gap-1.5">
                <i className="material-icons text-sm text-purple-700" style={{ fontSize: "16px" }}>psychology</i>
                <span>Agent Thinking Trace (Dynamic Agentic Trajectory)</span>
              </div>
              <span className="text-slate-500 text-[9px]">Ready for Evaluation</span>
            </div>
            <div className="p-4 bg-white rounded-sm border border-slate-200 text-center space-y-2">
              <p className="text-[11px] text-slate-700 font-medium">No agentic thinking trace recorded for this selection yet.</p>
              <p className="text-[10px] text-slate-500">Click <strong>&quot;Run LLM Agent Evaluation&quot;</strong> below to launch the dynamic multi-turn agentic evaluation loop.</p>
            </div>
          </div>
        );
      }
      return null;
    }

    return (
      <div className="bg-slate-50 p-4 rounded-sm space-y-3 font-mono text-xs border border-slate-200 shadow-sm text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] uppercase font-bold tracking-wider text-purple-700">
          <div className="flex items-center gap-1.5">
            <i className="material-icons text-sm text-purple-700" style={{ fontSize: "16px" }}>psychology</i>
            <span>Agent Thinking Trace (Live Execution Stream)</span>
            {isLive && (
              <span className="flex items-center gap-1 text-purple-600 ml-2 animate-pulse font-normal">
                <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                <span>Streaming Agent Steps...</span>
              </span>
            )}
          </div>
          <span className="text-slate-500 text-[9px]">
            {isLive ? `${traceSteps.length} Steps Received` : "Dynamic Agentic Trajectory"}
          </span>
        </div>

        <div
          ref={traceContainerRef}
          className="max-h-[380px] overflow-y-auto pr-1 space-y-2.5 scroll-smooth"
        >
          {traceSteps.map((step: any, idx: number) => (
            <div
              key={idx}
              className="space-y-1.5 bg-white p-3 rounded-sm border border-slate-250 text-[11px] shadow-sm transition-all duration-200"
            >
              <div className="flex items-center justify-between text-purple-800 font-bold text-[10px] uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                  <span>{step.title.replace(/^Turn\s+\d+:\s*/i, "")}</span>
                </span>
                <span className="text-slate-500 text-[9px] lowercase font-normal">{step.type}</span>
              </div>
              {(() => {
                if (step.content.includes("Hypothesis:") || step.content.includes("Self Critique:")) {
                  const parts = step.content.split(/\n?Self Critique:\s*/);
                  const hypothesisText = parts[0]?.replace(/^Hypothesis:\s*/i, "").trim();
                  const critiqueText = parts[1]?.trim();

                  return (
                    <div className="space-y-1.5 mt-1">
                      {hypothesisText && (
                        <div className="bg-indigo-50/70 border border-indigo-200/80 p-2.5 rounded-sm text-indigo-950 text-[11px] leading-relaxed">
                          <span className="inline-block bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mr-2 shadow-xs">
                            Hypothesis
                          </span>
                          <span className="font-medium text-slate-800">{hypothesisText}</span>
                        </div>
                      )}
                      {critiqueText && (
                        <div className="bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-sm text-amber-950 text-[11px] leading-relaxed">
                          <span className="inline-block bg-amber-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mr-2 shadow-xs">
                            Self Critique
                          </span>
                          <span className="font-medium text-slate-800">{critiqueText}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                if (step.type === "critique" && step.details?.reevaluationCount) {
                  return null;
                }

                return (
                  <p className="text-slate-900 font-medium leading-relaxed whitespace-pre-wrap block text-[11px]">{step.content}</p>
                );
              })()}

              {step.type === "hypothesis" && step.details && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                  {step.details.confidenceScore !== undefined && (
                    <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded border border-purple-300 font-bold">
                      Confidence: {step.details.confidenceScore}%
                    </span>
                  )}
                  {step.details.selectedTool && (
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300 font-bold">
                      Selected Tool: {step.details.selectedTool}
                    </span>
                  )}
                </div>
              )}

              {step.type === "retrieval" && step.details && (
                <div className="mt-2 bg-slate-100 p-2 rounded-sm text-[10px] text-slate-800 border border-slate-200 space-y-1">
                  <div className="text-[9px] uppercase font-bold text-slate-600 tracking-wider">Retrieved Tool Metrics:</div>
                  {Object.entries(step.details).map(([k, metric]: [string, any]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-slate-600 font-mono">{k}:</span>
                      <span className="font-semibold text-purple-900">{metric.description || metric.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {step.type === "neighbors" && step.details && (
                <div className="mt-2 bg-slate-100 p-2 rounded-sm text-[10px] text-slate-800 border border-slate-200 space-y-1">
                  <div className="text-[9px] uppercase font-bold text-slate-600 tracking-wider">Inspected Process Graph Context:</div>
                  {step.details.predecessors && step.details.predecessors.length > 0 && (
                    <div>
                      <span className="text-slate-600">Predecessors:</span>{" "}
                      <span className="text-slate-900 font-medium">{step.details.predecessors.map((p: any) => `"${p.name}" (${p.avgDuration}, ${p.resourceCount} actors)`).join("; ")}</span>
                    </div>
                  )}
                  {step.details.successors && step.details.successors.length > 0 && (
                    <div>
                      <span className="text-slate-600">Successors:</span>{" "}
                      <span className="text-slate-900 font-medium">{step.details.successors.map((s: any) => `"${s.name}" (${s.avgDuration}, ${s.resourceCount} actors)`).join("; ")}</span>
                    </div>
                  )}
                </div>
              )}

              {step.type === "archetype" && step.details && (
                <div className="mt-2 bg-purple-50 p-2 rounded-sm text-[10px] text-purple-900 border border-purple-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-950">{step.details.rpaArchetypeLabel} ({step.details.rpaArchetype})</span>
                    <span className="bg-purple-200 text-purple-900 text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">Effort: {step.details.implementationEffort}</span>
                  </div>
                  {step.details.effortRationale && <p className="text-slate-700 font-sans text-[10px]">{step.details.effortRationale}</p>}
                </div>
              )}

              {step.type === "variants" && step.details && (
                <div className="mt-2 bg-blue-50/80 p-2.5 rounded-sm text-[10px] text-blue-950 border border-blue-200/80 space-y-1.5 font-mono shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950">Process Variant & Happy Path Inspection</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold text-white ${
                      step.details.isOnHappyPath === true ? "bg-teal-600" : step.details.isOnHappyPath === false ? "bg-orange-600" : "bg-blue-600"
                    }`}>
                      {step.details.isOnHappyPath !== undefined ? (step.details.isOnHappyPath ? "Happy Path" : "Branch Variant") : "Variant Analysis"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[9.5px] text-slate-700">
                    <div>Variants with Activity: <strong className="text-blue-950">{step.details.activityVariantCount ?? 0} / {step.details.totalProcessVariants ?? step.details.totalVariants ?? "N/A"}</strong></div>
                    <div>Happy Path Case Share: <strong className="text-blue-950">{step.details.happyPathCoverage ?? "N/A"}</strong></div>
                  </div>
                </div>
              )}

              {step.type === "rework" && step.details && (
                <div className="mt-2 bg-orange-50/80 p-2.5 rounded-sm text-[10px] text-orange-950 border border-orange-200/80 space-y-1.5 font-mono shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-orange-950">Process Rework & Self-Loop Analysis</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold text-white ${
                      step.details.reworkSeverity === "HIGH" ? "bg-pink-600" : step.details.reworkSeverity === "MEDIUM" ? "bg-orange-600" : "bg-teal-600"
                    }`}>
                      Rework: {step.details.reworkSeverity || (step.details.reworkCaseCount > 0 || step.details.reworkTraces > 0 ? "LOW" : "NONE")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[9.5px] text-slate-700">
                    <div>Rework Cases: <strong className="text-orange-950">
                      {step.details.reworkPercentage 
                        ? step.details.reworkPercentage 
                        : `${step.details.reworkCaseCount ?? step.details.reworkTraces ?? 0} cases`}
                    </strong></div>
                    <div>Max Loop Repetitions: <strong className="text-orange-950">
                      {step.details.maxExecutionsInSingleCase !== undefined ? `${step.details.maxExecutionsInSingleCase}x / case` : "1x / case"}
                    </strong></div>
                  </div>
                </div>
              )}

              {step.type === "roi" && step.details && (
                <div className="mt-2 bg-teal-50/80 p-2.5 rounded-sm text-[10px] text-teal-950 border border-teal-200/80 space-y-1.5 font-mono shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-950">Financial ROI & Payback Simulation</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold text-white ${
                      step.details.roiTier === "HIGH_ROI" ? "bg-teal-600" : step.details.roiTier === "MODERATE_ROI" ? "bg-orange-600" : "bg-slate-600"
                    }`}>
                      {step.details.roiTier || "ROI SIMULATED"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[9.5px] text-slate-700">
                    <div>Annual Hours Spent: <strong className="text-teal-950">{(step.details.totalAnnualHoursSpent ?? 0).toLocaleString()} hrs/yr</strong></div>
                    <div>Annual Labor Cost: <strong className="text-teal-950">${(step.details.annualLaborCostUsd ?? 0).toLocaleString()}</strong></div>
                    <div>Build Cost Est: <strong className="text-teal-950">${(step.details.implementationCostEstUsd ?? 12000).toLocaleString()}</strong></div>
                    <div>Est Payback Period: <strong className="text-teal-950">{step.details.estimatedPaybackMonths !== undefined ? `${step.details.estimatedPaybackMonths} mos` : "N/A"}</strong></div>
                  </div>
                </div>
              )}

              {step.type === "synthesis" && step.details && (
                <div className="mt-2 bg-purple-50 p-2 rounded-sm text-[10px] text-purple-950 border border-purple-200 space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-950">
                      Score: {step.details.finalScore}% ({step.details.finalLabel})
                    </span>
                    {step.details.implementationEffort && (
                      <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold text-white ${
                        step.details.implementationEffort === "LOW" ? "bg-teal-600" : step.details.implementationEffort === "MEDIUM" ? "bg-orange-600" : "bg-pink-600"
                      }`}>
                        Effort: {step.details.implementationEffort}
                      </span>
                    )}
                  </div>
                  {step.details.rpaArchetypeLabel && (
                    <div className="text-[9.5px] text-slate-700">
                      Archetype: <strong className="text-purple-950">{step.details.rpaArchetypeLabel}</strong>
                    </div>
                  )}
                </div>
              )}

              {step.type === "critique" && step.details && (
                step.details.reevaluationCount ? (
                  /* Loop Re-Entry Critique Step */
                  <div className="mt-2 bg-violet-50/90 p-2.5 rounded-sm text-[10px] text-violet-950 border border-violet-200/90 space-y-2 shadow-xs font-sans">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-violet-900 text-[10.5px]">
                        <svg className="w-3.5 h-3.5 text-violet-600 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Critique Loop Re-Entry (Iteration #{step.details.reevaluationCount})</span>
                      </div>
                      <span className="bg-violet-600 text-white text-[8.5px] px-2 py-0.5 rounded uppercase font-bold tracking-wider shadow-xs">
                        Re-Inspecting via {step.details.suggestedTool}
                      </span>
                    </div>
                    {(step.details.critiqueNotes || step.content) && (
                      <div className="bg-white/80 border-l-2 border-violet-500 p-2 rounded-r-xs text-[10.5px] leading-relaxed">
                        <div className="text-[9px] uppercase font-bold text-violet-900 tracking-wider mb-0.5">Verification Audit Rationale:</div>
                        <p className="text-slate-800 font-medium font-sans">
                          {(step.details.critiqueNotes || step.content)
                            .replace(/^(Red Team Auditor|Verification Audit)\s+(identified missing proof|requested tool):\s*"?/i, "")
                            .replace(/"?\.\s*Re-entering loop to execute tool:.*$/i, "")}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Final Adversarial Calibration Audit Step */
                  <div className="mt-2 bg-pink-50/90 p-2.5 rounded-sm text-[10px] text-pink-950 border border-pink-200/90 space-y-1 shadow-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-pink-950">Quality Oversight & Verification Audit</span>
                      <span className="bg-pink-700 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">
                        {step.details.proposedScore !== step.details.calibratedScore
                          ? `Calibrated: ${step.details.proposedScore}% → ${step.details.calibratedScore}%`
                          : `Verified: ${step.details.calibratedScore}%`}
                      </span>
                    </div>
                    {step.details.calibratedScore !== undefined && (
                      <div className="text-[9.5px] text-slate-700">
                        Final Calibrated Score: <strong className="text-pink-950">{step.details.calibratedScore}% ({step.details.calibratedLabel})</strong>
                      </div>
                    )}
                  </div>
                )
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
                  <Bot className="w-4 h-4 text-teal-600" />
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
                              className={`text-[9px] px-2.5 py-1 rounded-sm border uppercase tracking-wider font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-0 ${
                                isSelected
                                  ? isAgentic ? "bg-purple-700 text-white border-purple-700 font-bold shadow-sm" : "bg-teal-600 text-white border-teal-600 font-bold shadow-sm"
                                  : isAgentic ? "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200" : "bg-white text-slate-500 hover:bg-slate-50 border-slate-200"
                              }`}
                              style={{
                                backgroundColor: isSelected
                                  ? (isAgentic ? "#7e22ce" : "#0d9488")
                                  : (isAgentic ? "#faf5ff" : "#ffffff"),
                                borderColor: isSelected
                                  ? (isAgentic ? "#7e22ce" : "#0d9488")
                                  : (isAgentic ? "#e9d5ff" : "#e2e8f0"),
                                color: isSelected ? "#ffffff" : (isAgentic ? "#6b21a8" : "#64748b"),
                              }}
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
                        className={`btn-small waves-effect waves-light border-0 cursor-pointer text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-white ${
                          evalType === "LLM_AGENTIC" ? "purple darken-1" : "teal darken-1"
                        }`}
                        style={{
                          height: "26px",
                          lineHeight: "26px",
                          fontSize: "10px",
                          backgroundColor: evalType === "LLM_AGENTIC" ? "#7e22ce" : "#00897b",
                        }}
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
                            Dynamic Agentic Loop
                          </span>
                        </div>
                      )}
                    </div>
                    {(() => {
                      const reasoningParts = llmAssessment.reasoning ? llmAssessment.reasoning.split(/\[Adversarial Verification Audit\]:\s*/) : ["", ""];
                      const mainReasoningText = reasoningParts[0].trim();
                      const auditText = reasoningParts[1] ? reasoningParts[1].trim() : null;
                      return (
                        <>
                          <p className="font-light leading-relaxed whitespace-pre-wrap">{mainReasoningText}</p>
                          {auditText && (
                            <div className="mt-3 bg-pink-50 border border-pink-200 p-3 rounded-sm text-slate-800 text-xs space-y-1">
                              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-pink-800">
                                <ShieldCheck className="w-3.5 h-3.5 text-pink-700" />
                                <span>Adversarial Verification Audit</span>
                              </div>
                              <p className="font-normal text-slate-700 text-[11px] leading-relaxed">{auditText}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}

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
                        className={`btn waves-effect text-xs font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer border-0 text-white transition-colors ${
                          evalType === "LLM_AGENTIC"
                            ? "purple darken-1 hover:bg-purple-700"
                            : "teal darken-1 hover:bg-teal-700"
                        }`}
                        style={{
                          height: "32px",
                          lineHeight: "32px",
                          fontSize: "11px",
                          minWidth: "110px",
                          backgroundColor: evalType === "LLM_AGENTIC" ? "#7e22ce" : "#00897b",
                        }}
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
                  <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-4 border p-4 rounded-sm transition-colors ${
                    evalType === "LLM_AGENTIC" ? "bg-purple-50/20 border-purple-200" : "bg-teal-50/10 border-teal-200"
                  }`}>
                  <div className="flex-1 space-y-1">
                    <span className={`font-semibold text-xs flex items-center gap-1.5 block ${
                      evalType === "LLM_AGENTIC" ? "text-purple-900" : "text-teal-850"
                    }`} style={{ fontSize: "12px", fontWeight: "bold" }}>
                      <Bot className={`w-3.5 h-3.5 ${evalType === "LLM_AGENTIC" ? "text-purple-600" : "text-teal-605"}`} />
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
                      className={`btn waves-effect waves-light text-xs font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer border-0 text-white transition-colors ${
                        evalType === "LLM_AGENTIC"
                          ? "purple darken-1 hover:bg-purple-700"
                          : "teal darken-1 hover:bg-teal-700"
                      }`}
                      style={{
                        height: "32px",
                        lineHeight: "32px",
                        fontSize: "11px",
                        backgroundColor: evalType === "LLM_AGENTIC" ? "#7e22ce" : "#00897b",
                      }}
                    >
                      {evaluating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          <span>Evaluating...</span>
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
