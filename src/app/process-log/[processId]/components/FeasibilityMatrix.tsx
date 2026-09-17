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
  const [matrixContextFilter, setMatrixContextFilter] = useState<"ALL" | "INDEPENDENT" | "RULE_CONTEXT">("ALL");
  const [scoreDisplayMode, setScoreDisplayMode] = useState<"BOTH" | "RAW" | "HYBRID">("BOTH");

  const displayedActivities = useMemo(() => {
    if (matrixScope === "visible") {
      const sorted = [...activities].sort((a, b) => b.frequency - a.frequency);
      return sorted.slice(0, Math.min(activeConfirmedNodeLimit, sorted.length));
    }
    return activities;
  }, [activities, matrixScope, activeConfirmedNodeLimit]);

  const stats = useMemo(() => {
    let ruleCount = 0;
    let singleShotIndepCount = 0;
    let agenticIndepCount = 0;
    let hybridCount = 0;
    let ruleContextCount = 0;
    let totalLlmCostUsd = 0;

    assessments.forEach((a) => {
      if (a.type === "RULE_BASED") {
        ruleCount++;
      } else if (a.type === "LLM_SINGLE_SHOT" || a.type === "LLM_AGENTIC") {
        if (a.costUsd) totalLlmCostUsd += a.costUsd;
        const hasRuleContext = (a.rawResponse as any)?.includeRuleBaseline !== false;
        if (hasRuleContext) {
          ruleContextCount++;
        } else {
          hybridCount++;
          if (a.type === "LLM_SINGLE_SHOT") {
            singleShotIndepCount++;
          } else if (a.type === "LLM_AGENTIC") {
            agenticIndepCount++;
          }
        }
      }
    });

    return {
      ruleCount,
      singleShotIndepCount,
      agenticIndepCount,
      hybridCount,
      ruleContextCount,
      totalLlmCostUsd,
    };
  }, [assessments]);

  return (
    <div className="space-y-6 font-sans">
      <div className="card bg-white z-depth-1 border border-slate-200 rounded-sm p-4 flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500 flex items-center gap-1">
              Feasibility Scoring Matrix
            </span>
            <p className="text-xs text-slate-500 font-light mt-0.5">
              Compare automation scores across rule-based baselines, independent single-shot/agentic LLM evaluations, 70/30 hybrid ensembles, and rule-context informed runs.
            </p>
          </div>
          {stats.totalLlmCostUsd > 0 && (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded font-medium">
              Total LLM Cost: <span className="text-slate-900 font-bold ml-1">{formatCost(stats.totalLlmCostUsd, null)}</span>
            </div>
          )}
        </div>
        
        {/* Category KPI summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-slate-100 pt-3">
          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rule Baseline</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-extrabold text-slate-800">{stats.ruleCount}</span>
              <span className="text-[9px] font-semibold text-slate-400">Heuristic</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded flex flex-col justify-between">
            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Single-Shot (Indep)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-extrabold text-teal-900">{stats.singleShotIndepCount}</span>
              <span className="text-[9px] font-semibold text-slate-400">Direct LLM</span>
            </div>
          </div>

          <div className="bg-purple-50/50 border border-purple-200 p-2.5 rounded flex flex-col justify-between">
            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Agentic (Indep)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-extrabold text-purple-900">{stats.agenticIndepCount}</span>
              <span className="text-[9px] font-semibold text-purple-500">Multi-Turn</span>
            </div>
          </div>

          <div className="bg-blue-50/50 border border-blue-200 p-2.5 rounded flex flex-col justify-between">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">70/30 Hybrid Ensemble</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-extrabold text-blue-950">{stats.hybridCount}</span>
              <span className="text-[9px] font-semibold text-blue-600">Rule + LLM</span>
            </div>
          </div>

          <div className="bg-red-50/60 border border-red-200 p-2.5 rounded flex flex-col justify-between">
            <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider">Rule Context Informed</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-extrabold text-red-900">{stats.ruleContextCount}</span>
              <span className="text-[9px] font-semibold text-red-600">Context Badge</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-sm bg-white z-depth-1">
        {/* Dual-Axis Table Header Filter Strip */}
        <div className={`bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex ${isExpanded ? "flex-row items-center justify-between" : "flex-col items-start"} gap-3 flex-wrap`}>
          <div className="flex items-center gap-4 flex-wrap max-w-full">
            {/* Strategy Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Strategy:</span>
              <div className="flex bg-slate-200/80 p-0.5 rounded border border-slate-300/70 gap-0.5 text-[11px] font-medium select-none">
                <button
                  type="button"
                  onClick={() => setMatrixTypeFilter("ALL")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                    matrixTypeFilter === "ALL"
                      ? "bg-white text-teal-800 font-bold shadow-2xs"
                      : "bg-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
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

            {/* Context Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Context:</span>
              <div className="flex bg-slate-200/80 p-0.5 rounded border border-slate-300/70 gap-0.5 text-[11px] font-medium select-none">
                <button
                  type="button"
                  onClick={() => setMatrixContextFilter("ALL")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                    matrixContextFilter === "ALL"
                      ? "bg-white text-teal-800 font-bold shadow-2xs"
                      : "bg-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Contexts
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixContextFilter("INDEPENDENT")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                    matrixContextFilter === "INDEPENDENT"
                      ? "bg-white text-slate-800 font-bold shadow-2xs"
                      : "bg-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Independent
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixContextFilter("RULE_CONTEXT")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                    matrixContextFilter === "RULE_CONTEXT"
                      ? "bg-red-600 text-white font-bold shadow-2xs"
                      : "bg-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Rule Context
                </button>
              </div>
            </div>

            {/* Score View Mode */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">View:</span>
              <div className="flex bg-slate-200/80 p-0.5 rounded border border-slate-300/70 gap-0.5 text-[11px] font-medium select-none">
                <button
                  type="button"
                  onClick={() => setScoreDisplayMode("BOTH")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                    scoreDisplayMode === "BOTH"
                      ? "bg-blue-600 text-white font-bold shadow-2xs"
                      : "bg-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Both
                </button>
                <button
                  type="button"
                  onClick={() => setScoreDisplayMode("RAW")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                    scoreDisplayMode === "RAW"
                      ? "bg-white text-slate-800 font-bold shadow-2xs"
                      : "bg-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Raw LLM
                </button>
                <button
                  type="button"
                  onClick={() => setScoreDisplayMode("HYBRID")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer border-0 ${
                    scoreDisplayMode === "HYBRID"
                      ? "bg-blue-600 text-white font-bold shadow-2xs"
                      : "bg-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  70/30 Hybrid
                </button>
              </div>
            </div>
          </div>

          {/* Right: Activity Scope Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap max-w-full ml-auto">
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
              const ruleScore = ruleAsm ? ruleAsm.score : null;
              
              // get LLM assessments matching dual-axis filters
              const modelAssessments: { [modelId: string]: any } = {};
              const activeScores: number[] = [];
              
              SUPPORTED_MODELS.forEach((model) => {
                const candidates = assessments.filter((a) => {
                  if (a.activityId !== act.id || a.model !== model.id) return false;
                  if (a.type !== "LLM_SINGLE_SHOT" && a.type !== "LLM_AGENTIC") return false;
                  
                  if (matrixTypeFilter !== "ALL" && a.type !== matrixTypeFilter) return false;
                  
                  const isRuleContext = (a.rawResponse as any)?.includeRuleBaseline !== false;
                  if (matrixContextFilter === "INDEPENDENT" && isRuleContext) return false;
                  if (matrixContextFilter === "RULE_CONTEXT" && !isRuleContext) return false;
                  
                  return true;
                });

                // Pick Independent evaluation first (preferring Agentic over Single-Shot if strategy filter is ALL), then fall back to Rule Context
                const asm = 
                  candidates.find((a) => (a.rawResponse as any)?.includeRuleBaseline === false && a.type === "LLM_AGENTIC") ||
                  candidates.find((a) => (a.rawResponse as any)?.includeRuleBaseline === false) ||
                  candidates.find((a) => a.type === "LLM_AGENTIC") ||
                  candidates[0] ||
                  null;

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
                    {ruleScore !== null ? (
                      <span className={`inline-block px-2 py-0.75 rounded-sm text-[10px] min-w-[36px] text-center ${getScoreColor(ruleScore)}`}>
                        {ruleScore}%
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>

                  {/* LLM model scores */}
                  {SUPPORTED_MODELS.map((model) => {
                    const asm = modelAssessments[model.id];
                    const rawScore = asm ? asm.score : null;
                    const isRuleContext = asm ? (asm.rawResponse as any)?.includeRuleBaseline !== false : false;
                    
                    const modelHybridScore = (asm && !isRuleContext)
                      ? (asm.hybridScore !== null && asm.hybridScore !== undefined 
                          ? asm.hybridScore 
                          : (ruleScore !== null ? Math.round(0.70 * ruleScore + 0.30 * rawScore) : null))
                      : null;

                    const displayedScore = scoreDisplayMode === "HYBRID" 
                      ? (modelHybridScore !== null ? modelHybridScore : rawScore)
                      : rawScore;

                    return (
                      <td key={model.id} className="py-3 px-4 text-center border-l border-slate-200">
                        {displayedScore !== null && asm ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span 
                              title={`[${asm.type === "LLM_AGENTIC" ? "Agentic Loop" : "Single-Shot"} | ${isRuleContext ? "Rule Context Informed" : "Independent"}] Raw LLM: ${rawScore}% | Hybrid (70/30): ${modelHybridScore !== null ? `${modelHybridScore}%` : "n/a"} | Latency: ${asm.latencyMs !== null && asm.latencyMs !== undefined ? `${(asm.latencyMs / 1000).toFixed(2)}s` : "n/a"} | Cost: ${formatCost(asm.costUsd, asm.model)}`}
                              className={`inline-block px-2 py-0.75 rounded-sm text-[10px] min-w-[36px] text-center cursor-help transition-transform hover:scale-105 duration-100 ${getScoreColor(displayedScore)}`}
                            >
                              {displayedScore}%
                            </span>
                            <div className="flex items-center gap-0.5 flex-wrap justify-center mt-0.5">
                              {asm.type === "LLM_AGENTIC" ? (
                                <span className="text-[7px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1 py-0.2 rounded uppercase">
                                  Agentic
                                </span>
                              ) : (
                                <span className="text-[7px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded uppercase">
                                  Single
                                </span>
                              )}
                              
                              {isRuleContext ? (
                                <span className="text-[7px] font-bold text-red-700 bg-red-100 border border-red-200 px-1 py-0.2 rounded uppercase">
                                  Rule Context
                                </span>
                              ) : (
                                <>
                                  {scoreDisplayMode === "HYBRID" ? (
                                    <span className="text-[7px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1 py-0.2 rounded uppercase" title={`Raw LLM: ${rawScore}%`}>
                                      70/30 Hybrid
                                    </span>
                                  ) : scoreDisplayMode === "BOTH" ? (
                                    <>
                                      <span className="text-[7px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded uppercase">
                                        Independent
                                      </span>
                                      {modelHybridScore !== null && (
                                        <span className="text-[7px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1 py-0.2 rounded uppercase" title={`70/30 Hybrid: ${modelHybridScore}%`}>
                                          Hybrid: {modelHybridScore}%
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-[7px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded uppercase">
                                      Independent
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
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
