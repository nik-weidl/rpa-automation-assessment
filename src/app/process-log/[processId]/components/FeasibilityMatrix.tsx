import { useState, useMemo } from "react";
import { Activity, Assessment } from "@/types/models";
import { SUPPORTED_MODELS } from "@/features/automation-scoring/openrouter";

interface FeasibilityMatrixProps {
  activities: Activity[];
  assessments: Assessment[];
  onSelectAndCompare: (activityName: string, activeAssessmentsCount: number) => void;
  onFocusNode?: (activity: Activity) => void;
  formatCost: (costUsd: number | null | undefined, modelId: string | null | undefined) => string;
  activeConfirmedNodeLimit?: number;
  isExpanded?: boolean;
}

export default function FeasibilityMatrix({
  activities,
  assessments,
  onSelectAndCompare,
  onFocusNode,
  formatCost,
  activeConfirmedNodeLimit = 20,
  isExpanded = false,
}: FeasibilityMatrixProps) {
  const [matrixScope, setMatrixScope] = useState<"all" | "visible">("visible");
  const [matrixTypeFilter, setMatrixTypeFilter] = useState<"ALL" | "LLM_SINGLE_SHOT" | "LLM_AGENTIC">("ALL");

  const displayedActivities = useMemo(() => {
    if (matrixScope === "visible") {
      const sorted = [...activities].sort((a, b) => b.frequency - a.frequency);
      return sorted.slice(0, Math.min(activeConfirmedNodeLimit, sorted.length));
    }
    return activities;
  }, [activities, matrixScope, activeConfirmedNodeLimit]);

  const totalLlmCostUsd = assessments
    ? assessments
        .filter((a) => (a.type === "LLM_SINGLE_SHOT" || a.type === "LLM_AGENTIC") && a.costUsd !== null && a.costUsd !== undefined)
        .reduce((sum, a) => sum + (a.costUsd || 0), 0)
    : 0;

  return (
    <div className="space-y-6 font-sans">
      <div className="card bg-white z-depth-1 border border-slate-200 rounded-sm p-4 flex flex-col gap-3">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500 flex items-center gap-1 block">
            Feasibility Scoring Matrix
          </span>
          <p className="text-xs text-slate-500 font-light mt-0.5">
            Compare automation scores across rule-based criteria, single-shot LLM prompts, and dynamic agentic reasoning loops.
          </p>
        </div>
        
        {/* model summary stats - row below */}
        <div className="flex flex-row flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500 font-semibold">
          <div>Displayed Steps: <span className="text-slate-800 font-bold ml-1">{displayedActivities.length} / {activities.length}</span></div>
          <div>AI Models Stored: <span className="text-slate-800 font-bold ml-1">
            {new Set(assessments.filter(a => a.type === "LLM_SINGLE_SHOT" || a.type === "LLM_AGENTIC").map(a => a.model)).size}
          </span></div>
          {totalLlmCostUsd > 0 && (
            <div>Total LLM Cost: <span className="text-slate-800 font-bold ml-1">{formatCost(totalLlmCostUsd, null)}</span></div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-sm bg-white z-depth-1">
        {/* Integrated Table Header Filter Strip */}
        <div className={`bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex ${isExpanded ? "flex-row items-center justify-between" : "flex-col items-start"} gap-2.5 flex-wrap`}>
          {/* Left: Evaluation Mode Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap max-w-full">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Mode:</span>
            <div className="flex flex-wrap bg-slate-200/80 p-0.5 rounded border border-slate-300/70 gap-0.5 text-[11px] font-medium select-none">
              <button
                type="button"
                onClick={() => setMatrixTypeFilter("ALL")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                  matrixTypeFilter === "ALL"
                    ? "bg-white text-teal-800 font-bold shadow-2xs"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                All Evaluations
              </button>
              <button
                type="button"
                onClick={() => setMatrixTypeFilter("LLM_SINGLE_SHOT")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                  matrixTypeFilter === "LLM_SINGLE_SHOT"
                    ? "bg-white text-teal-800 font-bold shadow-2xs"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                Single-Shot
              </button>
              <button
                type="button"
                onClick={() => setMatrixTypeFilter("LLM_AGENTIC")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                  matrixTypeFilter === "LLM_AGENTIC"
                    ? "bg-purple-600 text-white font-bold shadow-2xs"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                Agentic Loop
              </button>
            </div>
          </div>

          {/* Right: Activity Scope Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap max-w-full">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Scope:</span>
            <div className="flex flex-wrap bg-slate-200/80 p-0.5 rounded border border-slate-300/70 gap-0.5 text-[11px] font-medium select-none">
              <button
                type="button"
                onClick={() => setMatrixScope("all")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 flex items-center gap-1 ${
                  matrixScope === "all"
                    ? "bg-white text-teal-800 font-bold shadow-2xs"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>All Activities</span>
                <span className={`text-[10px] font-mono ${matrixScope === "all" ? "text-teal-600 font-semibold" : "text-slate-400"}`}>
                  ({activities.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixScope("visible")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 flex items-center gap-1 ${
                  matrixScope === "visible"
                    ? "bg-white text-teal-800 font-bold shadow-2xs"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Visible Only</span>
                <span className={`text-[10px] font-mono ${matrixScope === "visible" ? "text-teal-600 font-semibold" : "text-slate-400"}`}>
                  ({Math.min(activeConfirmedNodeLimit, activities.length)})
                </span>
              </button>
            </div>
          </div>
        </div>

        <table className="striped highlight text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
              <th className="py-3 px-4 font-bold">Activity Name</th>
              <th className="py-3 px-4 font-bold text-center">Frequency</th>
              <th className="py-3 px-4 font-bold text-center border-l border-slate-200">Rule-Based</th>
              
              {SUPPORTED_MODELS.map((model) => (
                <th key={model.id} className="py-3 px-4 font-bold text-center border-l border-slate-200">
                  {model.name.replace(" (Latest)", "")}
                </th>
              ))}
              
              <th className="py-3 px-4 font-bold text-center border-l border-slate-200">Spread</th>
              <th className="py-3 px-4 font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedActivities.map((act) => {
              // get rule-based assessment
              const ruleAsm = assessments.find(
                (a) => a.activityId === act.id && a.type === "RULE_BASED"
              );
              
              // get LLM assessments
              const modelAssessments: { [modelId: string]: any } = {};
              const activeScores: number[] = [];
              
              SUPPORTED_MODELS.forEach((model) => {
                let asm = null;
                if (matrixTypeFilter === "LLM_SINGLE_SHOT") {
                  asm = assessments.find((a) => a.activityId === act.id && a.type === "LLM_SINGLE_SHOT" && a.model === model.id);
                } else if (matrixTypeFilter === "LLM_AGENTIC") {
                  asm = assessments.find((a) => a.activityId === act.id && a.type === "LLM_AGENTIC" && a.model === model.id);
                } else {
                  asm = assessments.find((a) => a.activityId === act.id && a.type === "LLM_AGENTIC" && a.model === model.id)
                    || assessments.find((a) => a.activityId === act.id && a.type === "LLM_SINGLE_SHOT" && a.model === model.id);
                }
                modelAssessments[model.id] = asm;
                if (asm) {
                  activeScores.push(asm.score);
                }
              });

              // calculate min/max spread
              const spread = activeScores.length > 1 
                ? Math.max(...activeScores) - Math.min(...activeScores)
                : null;

              const getScoreColor = (score: number | null) => {
                if (score === null) return "text-slate-400 font-normal";
                if (score >= 70) return "text-white bg-teal-500 font-bold";
                if (score >= 35) return "text-white bg-orange-500 font-bold";
                return "text-white bg-pink-500 font-bold";
              };

              return (
                <tr 
                  key={act.id} 
                  onClick={() => onFocusNode?.(act)}
                  className="hover:bg-slate-100/70 cursor-pointer transition-colors border-b border-slate-100 group"
                >
                  <td className="py-3 px-4 font-semibold text-slate-800 group-hover:text-teal-700 max-w-[200px] truncate transition-colors" title={act.name}>
                    {act.name}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-600">
                    {act.frequency.toLocaleString()}x
                  </td>
                  
                  {/* rule-based score */}
                  <td className="py-3 px-4 text-center border-l border-slate-200 font-bold bg-slate-50/5">
                    {ruleAsm ? (
                      <span className={`inline-block px-2 py-0.75 rounded-sm text-[10px] min-w-[36px] text-center ${getScoreColor(ruleAsm.score)}`}>
                        {ruleAsm.score}%
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>

                  {/* LLM model scores */}
                  {SUPPORTED_MODELS.map((model) => {
                    const asm = modelAssessments[model.id];
                    const score = asm ? asm.score : null;
                    return (
                      <td key={model.id} className="py-3 px-4 text-center border-l border-slate-200">
                        {score !== null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span 
                              title={`[${asm.type === "LLM_AGENTIC" ? "Agentic Loop" : "Single-Shot"}] Latency: ${asm.latencyMs !== null && asm.latencyMs !== undefined ? `${(asm.latencyMs / 1000).toFixed(2)}s` : "n/a"} | Cost: ${formatCost(asm.costUsd, asm.model)}`}
                              className={`inline-block px-2 py-0.75 rounded-sm text-[10px] min-w-[36px] text-center cursor-help transition-transform hover:scale-105 duration-100 ${getScoreColor(score)}`}
                            >
                              {score}%
                            </span>
                            {asm.type === "LLM_AGENTIC" && (
                              <span className="text-[7px] font-bold text-purple-700 bg-purple-100 px-1 py-0.2 rounded uppercase">
                                Agentic
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* spread (agreement measure) */}
                  <td className="py-3 px-4 text-center border-l border-slate-200 font-bold bg-slate-50/5">
                    {spread !== null ? (
                      <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[9px] min-w-[30px] text-center ${
                        spread > 25
                          ? "bg-pink-100 text-pink-850 border border-pink-200 font-extrabold"
                          : spread > 10
                          ? "bg-orange-100 text-orange-850 border border-orange-200 font-bold"
                          : "bg-teal-100 text-teal-850 border border-teal-200"
                      }`} title={spread > 25 ? "High disagreement between AI models" : undefined}>
                        ±{spread}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>

                  {/* actions */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAndCompare(act.name, activeScores.length);
                      }}
                      className="btn-small waves-effect waves-light teal darken-1 border-0 cursor-pointer text-[10px] font-semibold uppercase tracking-wider"
                      style={{ height: "26px", lineHeight: "26px", fontSize: "10px", padding: "0 10px" }}
                    >
                      Compare
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
