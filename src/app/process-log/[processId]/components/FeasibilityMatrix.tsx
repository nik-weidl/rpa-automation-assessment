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

  const displayedActivities = useMemo(() => {
    if (matrixScope === "visible") {
      const sorted = [...activities].sort((a, b) => b.frequency - a.frequency);
      return sorted.slice(0, Math.min(activeConfirmedNodeLimit, sorted.length));
    }
    return activities;
  }, [activities, matrixScope, activeConfirmedNodeLimit]);

  const totalLlmCostUsd = assessments
    ? assessments
        .filter((a) => a.type === "LLM_SINGLE_SHOT" && a.costUsd !== null && a.costUsd !== undefined)
        .reduce((sum, a) => sum + (a.costUsd || 0), 0)
    : 0;

  return (
    <div className="space-y-6 font-sans">
      <div className="card bg-white z-depth-1 border border-slate-200 rounded-sm p-4 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500 flex items-center gap-1 block">
              Feasibility Scoring Matrix
            </span>
            <p className="text-xs text-slate-500 font-light mt-0.5">
              Compare automation scores across rule-based criteria and all evaluated AI models side-by-side.
            </p>
          </div>

          {/* Vertical Stack Segmented Scope Selector */}
          <div className="relative flex flex-col bg-slate-200/70 p-1 rounded-md border border-slate-300/60 shrink-0 select-none min-w-[180px]">
            {/* Smooth vertical sliding white pill background */}
            <div
              className="absolute left-1 right-1 rounded bg-white shadow-xs border border-slate-200/80 transition-all duration-300 ease-out"
              style={{
                height: "calc(50% - 6px)",
                top: matrixScope === "all" ? "4px" : "calc(50% + 2px)",
              }}
            />

            <button
              type="button"
              onClick={() => setMatrixScope("all")}
              className={`relative z-10 py-1.5 px-3 text-xs font-medium cursor-pointer border-0 bg-transparent transition-colors duration-200 flex items-center justify-between gap-3 focus:outline-none ${
                matrixScope === "all"
                  ? "text-teal-800 font-bold"
                  : "text-slate-600 hover:text-slate-800"
              }`}
              style={{ backgroundColor: "transparent" }}
            >
              <span>All Activities</span>
              <span className={`text-[10px] font-mono ${matrixScope === "all" ? "text-teal-600 font-semibold" : "text-slate-400"}`}>
                ({activities.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMatrixScope("visible")}
              className={`relative z-10 py-1.5 px-3 text-xs font-medium cursor-pointer border-0 bg-transparent transition-colors duration-200 flex items-center justify-between gap-3 focus:outline-none ${
                matrixScope === "visible"
                  ? "text-teal-800 font-bold"
                  : "text-slate-600 hover:text-slate-800"
              }`}
              style={{ backgroundColor: "transparent" }}
            >
              <span>Visible Only</span>
              <span className={`text-[10px] font-mono ${matrixScope === "visible" ? "text-teal-600 font-semibold" : "text-slate-400"}`}>
                ({Math.min(activeConfirmedNodeLimit, activities.length)})
              </span>
            </button>
          </div>
        </div>
        
        {/* model summary stats - row below, side by side */}
        <div className="flex flex-row flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500 font-semibold">
          <div>Displayed Steps: <span className="text-slate-800 font-bold ml-1">{displayedActivities.length} / {activities.length}</span></div>
          <div>AI Models Stored: <span className="text-slate-800 font-bold ml-1">
            {new Set(assessments.filter(a => a.type === "LLM_SINGLE_SHOT").map(a => a.model)).size}
          </span></div>
          {totalLlmCostUsd > 0 && (
            <div>Total LLM Cost: <span className="text-slate-800 font-bold ml-1">{formatCost(totalLlmCostUsd, null)}</span></div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-sm bg-white z-depth-1">
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
                const asm = assessments.find(
                  (a) => a.activityId === act.id && a.type === "LLM_SINGLE_SHOT" && a.model === model.id
                );
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
                          <span 
                            title={`Latency: ${asm.latencyMs !== null && asm.latencyMs !== undefined ? `${(asm.latencyMs / 1000).toFixed(2)}s` : "n/a"} | Cost: ${formatCost(asm.costUsd, asm.model)}`}
                            className={`inline-block px-2 py-0.75 rounded-sm text-[10px] min-w-[36px] text-center cursor-help transition-transform hover:scale-105 duration-100 ${getScoreColor(score)}`}
                          >
                            {score}%
                          </span>
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
