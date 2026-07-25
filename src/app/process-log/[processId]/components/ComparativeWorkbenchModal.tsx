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
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white border rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* modal header */}
        <div className="flex items-center justify-between p-5 border-b bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 text-[10px] uppercase px-2 py-0.5 rounded font-extrabold">Comparative Workbench</span>
              Activity Evaluation: <span className="text-blue-700">"{activity.name}"</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Side-by-side semantic and scoring breakdown across all evaluated LLM models.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-white border p-1.5 rounded-lg transition-colors hover:shadow-xs"
          >
            <span className="text-xs font-bold px-1">Close [X]</span>
          </button>
        </div>

        {/* modal body columns */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activityLlmAssessments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No LLM assessments calculated for this activity yet. Run evaluations to compare models.
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-${Math.min(activityLlmAssessments.length, 3)} gap-6`}>
              {activityLlmAssessments.map((asm) => {
                const modelInfo = SUPPORTED_MODELS.find(m => m.id === asm.model);
                const displayName = modelInfo?.name || asm.model?.split("/").pop() || "Unknown Model";
                
                const scoreColor = asm.score >= 70 
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : asm.score >= 35
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-rose-200 bg-rose-50 text-rose-950";

                const badgeColor = asm.score >= 70
                  ? "bg-emerald-500 text-white"
                  : asm.score >= 35
                  ? "bg-amber-500 text-white"
                  : "bg-rose-500 text-white";

                return (
                  <div key={asm.id} className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    {/* model header */}
                    <div className={`p-4 border-b flex items-center justify-between ${scoreColor}`}>
                      <div>
                        <h4 className="font-bold text-xs tracking-wide uppercase text-slate-800">
                          {displayName}
                        </h4>
                        <p className="text-[9px] text-slate-500 font-semibold mt-0.5">
                          Latency: {asm.latencyMs !== null && asm.latencyMs !== undefined ? `${(asm.latencyMs / 1000).toFixed(2)}s` : "n/a"} | Cost: {formatCost(asm.costUsd, asm.model)}
                        </p>
                      </div>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full shadow-xs ${badgeColor}`}>
                        {asm.score}% {asm.label}
                      </span>
                    </div>

                    {/* model content */}
                    <div className="p-4 flex-1 space-y-5 overflow-y-auto">
                      {/* reasoning */}
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          AI Reasoning
                        </h5>
                        <p className="text-slate-700 text-xs leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100 min-h-[100px]">
                          {asm.reasoning}
                        </p>
                      </div>

                      {/* risks */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Identified Risks ({asm.risks?.length || 0})
                        </h5>
                        <ul className="space-y-1.5 pl-4 list-disc text-slate-600 text-xs">
                          {asm.risks && asm.risks.length > 0 ? (
                            asm.risks.map((r, i) => <li key={i}>{r}</li>)
                          ) : (
                            <li className="list-none text-slate-400 font-medium italic -ml-4">No risks identified.</li>
                          )}
                        </ul>
                      </div>

                      {/* missing info */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          Missing Information Requirements ({asm.missingInfo?.length || 0})
                        </h5>
                        <ul className="space-y-1.5 pl-4 list-disc text-slate-600 text-xs">
                          {asm.missingInfo && asm.missingInfo.length > 0 ? (
                            asm.missingInfo.map((m, i) => <li key={i}>{m}</li>)
                          ) : (
                            <li className="list-none text-slate-400 font-medium italic -ml-4">No missing information noted.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* modal footer */}
        <div className="p-4 border-t bg-slate-50 flex items-center justify-between text-[10px] text-slate-500 font-medium px-6">
          <span>Comparing {activityLlmAssessments.length} models for "{activity.name}".</span>
          <button 
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors shadow-xs"
          >
            Close Workbench
          </button>
        </div>
      </div>
    </div>
  );
}
