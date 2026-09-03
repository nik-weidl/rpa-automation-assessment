import { Activity, Assessment } from "@/types/models";
import { SUPPORTED_MODELS } from "@/features/automation-scoring/openrouter";
import { AlertTriangle, HelpCircle } from "lucide-react";

interface ComparativeWorkbenchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
  activityLlmAssessments: Assessment[];
  formatCost: (costUsd: number | null | undefined, modelId: string | null | undefined) => string;
}

export default function ComparativeWorkbenchModal({
  isOpen,
  onClose,
  activity,
  activityLlmAssessments,
  formatCost,
}: ComparativeWorkbenchModalProps) {
  if (!isOpen || !activity) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/45 backdrop-blur-[1px] z-50 flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-slate-200 rounded-sm z-depth-4 w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden font-sans text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* modal header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
          <div>
            <span className="text-base font-semibold text-slate-850 flex items-center gap-2 block" style={{ fontSize: "16px", fontWeight: "bold" }}>
              <span className="bg-teal-50 text-teal-805 border border-teal-200 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold">Comparative Workbench</span>
              Activity Evaluation: <span className="text-teal-600 font-bold">"{activity.name}"</span>
            </span>
            <p className="text-xs text-slate-500 font-light mt-0.5">
              Side-by-side semantic and scoring breakdown across all evaluated LLM models.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold border-0 bg-transparent cursor-pointer transition-all"
            title="Close Workbench"
          >
            ✕
          </button>
        </div>

        {/* modal body columns */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activityLlmAssessments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-light text-sm">
              No LLM assessments calculated for this activity yet. Run evaluations to compare models.
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-${Math.min(activityLlmAssessments.length, 3)} gap-6`}>
              {activityLlmAssessments.map((asm) => {
                const modelInfo = SUPPORTED_MODELS.find(m => m.id === asm.model);
                const displayName = modelInfo?.name || asm.model?.split("/").pop() || "Unknown Model";
                
                const scoreColor = asm.score >= 70 
                  ? "border-b border-teal-200 bg-teal-50/15 text-teal-900"
                  : asm.score >= 35
                  ? "border-b border-orange-200 bg-orange-50/15 text-orange-900"
                  : "border-b border-pink-200 bg-pink-50/15 text-pink-900";

                const badgeColor = asm.score >= 70
                  ? "bg-teal-500 text-white"
                  : asm.score >= 35
                  ? "bg-orange-500 text-white"
                  : "bg-pink-500 text-white";

                return (
                  <div key={asm.id} className="card bg-white z-depth-1 border border-slate-200 rounded-sm overflow-hidden flex flex-col">
                    {/* model header */}
                    <div className={`p-4 border-b flex items-center justify-between ${scoreColor}`}>
                      <div>
                        <span className="font-semibold text-xs tracking-wider uppercase text-slate-800 flex items-center gap-1.5" style={{ fontSize: "11px", fontWeight: "bold" }}>
                          {displayName}
                          <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${
                            asm.type === "LLM_AGENTIC"
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {asm.type === "LLM_AGENTIC" ? "Agentic" : "Single-Shot"}
                          </span>
                        </span>
                        <p className="text-[9px] text-slate-500 font-light mt-0.5">
                          Latency: {asm.latencyMs !== null && asm.latencyMs !== undefined ? `${(asm.latencyMs / 1000).toFixed(2)}s` : "n/a"} | Cost: {formatCost(asm.costUsd, asm.model)}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-sm shadow-sm ${badgeColor}`}>
                        {asm.score}% {asm.label}
                      </span>
                    </div>

                    {/* model content */}
                    <div className="p-4 flex-1 space-y-5 overflow-y-auto">
                      {/* reasoning */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block" style={{ fontSize: "10px", fontWeight: "bold" }}>
                          AI Reasoning
                        </span>
                        <p className="text-slate-700 text-xs leading-relaxed bg-slate-50/50 p-3 rounded-sm border border-slate-150 min-h-[100px] font-light">
                          {asm.reasoning}
                        </p>
                      </div>

                      {/* risks */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-semibold text-pink-600 uppercase tracking-wider flex items-center gap-1 block" style={{ fontSize: "10px", fontWeight: "bold" }}>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Identified Risks ({asm.risks?.length || 0})
                        </span>
                        <ul className="browser-default space-y-1.5 pl-4 list-disc text-slate-600 text-xs font-light">
                          {asm.risks && asm.risks.length > 0 ? (
                            asm.risks.map((r, i) => <li key={i}>{r}</li>)
                          ) : (
                            <li className="list-none text-slate-400 font-medium italic -ml-4">No risks identified.</li>
                          )}
                        </ul>
                      </div>
 
                      {/* missing info */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider flex items-center gap-1 block" style={{ fontSize: "10px", fontWeight: "bold" }}>
                          <HelpCircle className="w-3.5 h-3.5" />
                          Missing Information Requirements ({asm.missingInfo?.length || 0})
                        </span>
                        <ul className="browser-default space-y-1.5 pl-4 list-disc text-slate-600 text-xs font-light">
                          {asm.missingInfo && asm.missingInfo.length > 0 ? (
                            asm.missingInfo.map((m, i) => <li key={i}>{m}</li>)
                          ) : (
                            <li className="list-none text-slate-400 font-medium italic -ml-4">No missing information noted.</li>
                          )}
                        </ul>
                      </div>

                      {/* Quality Oversight & Verification Audit section for Agentic Loop evaluations */}
                      {asm.type === "LLM_AGENTIC" && (() => {
                        let thinkingTrace: any[] = [];
                        if (asm.rawResponse) {
                          try {
                            const parsed = typeof asm.rawResponse === "string" ? JSON.parse(asm.rawResponse) : asm.rawResponse;
                            if (Array.isArray(parsed?.thinkingTrace)) {
                              thinkingTrace = parsed.thinkingTrace;
                            }
                          } catch (e) {}
                        }

                        const critiqueSteps = thinkingTrace.filter((step: any) => step.type === "critique" || step.details?.calibratedScore !== undefined || step.details?.reevaluationCount !== undefined);

                        if (critiqueSteps.length === 0) return null;

                        return (
                          <div className="space-y-2 border-t border-slate-150 pt-3">
                            <span className="text-[10px] font-bold text-violet-900 uppercase tracking-wider block" style={{ fontSize: "10px", fontWeight: "bold" }}>
                              Quality Oversight & Verification Audit ({critiqueSteps.length})
                            </span>
                            <div className="space-y-2">
                              {critiqueSteps.map((step: any, cIdx: number) => {
                                if (step.details?.reevaluationCount) {
                                  const auditNotes = (step.details.critiqueNotes || step.content)
                                    ?.replace(/^(Red Team Auditor|Verification Audit)\s+(identified missing proof|requested tool):\s*"?/i, "")
                                    ?.replace(/"?\.\s*Re-entering loop to execute tool:.*$/i, "");

                                  return (
                                    <div key={cIdx} className="bg-violet-50/90 p-2.5 rounded-sm text-[10px] text-violet-950 border border-violet-200/90 space-y-1.5 shadow-2xs font-sans">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 font-bold text-violet-900 text-[10px]">
                                          <svg className="w-3 h-3 text-violet-600 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                          <span>Re-Entry Iteration #{step.details.reevaluationCount}</span>
                                        </div>
                                        {step.details.suggestedTool && (
                                          <span className="bg-violet-600 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                            {step.details.suggestedTool}
                                          </span>
                                        )}
                                      </div>
                                      {auditNotes && (
                                        <div className="bg-white/80 border-l-2 border-violet-500 p-2 rounded-r-xs text-[10px] leading-relaxed">
                                          <div className="text-[8.5px] uppercase font-bold text-violet-900 tracking-wider mb-0.5">Verification Audit Rationale:</div>
                                          <p className="text-slate-800 font-medium font-sans">{auditNotes}</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={cIdx} className="bg-pink-50/90 p-2.5 rounded-sm text-[10px] text-pink-950 border border-pink-200/90 space-y-1 shadow-2xs font-mono">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-pink-950">Quality Oversight & Verification Audit</span>
                                      <span className="bg-pink-700 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">
                                        {step.details?.proposedScore !== undefined && step.details?.proposedScore !== step.details?.calibratedScore
                                          ? `Calibrated: ${step.details.proposedScore}% → ${step.details.calibratedScore}%`
                                          : step.details?.calibratedScore !== undefined ? `Verified: ${step.details.calibratedScore}%` : "Verified"}
                                      </span>
                                    </div>
                                    {step.details?.calibratedScore !== undefined && (
                                      <div className="text-[9.5px] text-slate-700">
                                        Final Calibrated Score: <strong className="text-pink-950">{step.details.calibratedScore}% ({step.details.calibratedLabel})</strong>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* modal footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 font-medium px-6">
          Comparing {activityLlmAssessments.length} models for "{activity.name}".
        </div>
      </div>
    </div>
  );
}
