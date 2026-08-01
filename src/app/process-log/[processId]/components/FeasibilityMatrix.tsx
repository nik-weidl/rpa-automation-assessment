import { Activity, Assessment } from "@/types/models";
import { SUPPORTED_MODELS } from "@/features/automation-scoring/openrouter";
import { Button } from "@/components/ui/button";

interface FeasibilityMatrixProps {
  activities: Activity[];
  assessments: Assessment[];
  onSelectAndCompare: (activityName: string, activeAssessmentsCount: number) => void;
  formatCost: (costUsd: number | null | undefined, modelId: string | null | undefined) => string;
  isExpanded?: boolean;
}

export default function FeasibilityMatrix({
  activities,
  assessments,
  onSelectAndCompare,
  formatCost,
  isExpanded = false,
}: FeasibilityMatrixProps) {
  const totalLlmCostUsd = assessments
    ? assessments
        .filter((a) => a.type === "LLM_SINGLE_SHOT" && a.costUsd !== null && a.costUsd !== undefined)
        .reduce((sum, a) => sum + (a.costUsd || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className={`flex gap-3 bg-slate-50 p-4 border border-slate-200 rounded-lg ${isExpanded ? "flex-row items-center justify-between" : "flex-col justify-start"}`}>
        <div>
          <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-500 flex items-center gap-1">
            Feasibility Scoring Matrix
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare automation scores across rule-based criteria and all evaluated AI models side-by-side.
          </p>
        </div>
        
        {/* model summary stats */}
        <div className="text-[10px] text-slate-500 font-semibold bg-white border rounded px-3 py-2 shadow-xs space-y-1">
          <div>Evaluated Steps: <span className="text-slate-800 font-bold">{activities.length}</span></div>
          <div>AI Models Stored: <span className="text-slate-800 font-bold">
            {new Set(assessments.filter(a => a.type === "LLM_SINGLE_SHOT").map(a => a.model)).size}
          </span></div>
          {totalLlmCostUsd > 0 && (
            <div>Total LLM Cost: <span className="text-slate-800 font-bold">{formatCost(totalLlmCostUsd, null)}</span></div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
              <th className="py-3 px-4 font-bold">Activity Name</th>
              <th className="py-3 px-4 font-bold text-center">Frequency</th>
              <th className="py-3 px-4 font-bold text-center border-l bg-slate-50/20">Rule-Based</th>
              
              {SUPPORTED_MODELS.map((model) => (
                <th key={model.id} className="py-3 px-4 font-bold text-center border-l">
                  {model.name.replace(" (Latest)", "")}
                </th>
              ))}
              
              <th className="py-3 px-4 font-bold text-center border-l bg-slate-50/20">Spread</th>
              <th className="py-3 px-4 font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activities.map((act) => {
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
                if (score === null) return "text-slate-400 bg-slate-50 border-slate-200";
                if (score >= 70) return "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold";
                if (score >= 35) return "text-amber-700 bg-amber-50 border-amber-200 font-bold";
                return "text-rose-700 bg-rose-50 border-rose-200 font-bold";
              };

              return (
                <tr key={act.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800 max-w-[200px] truncate" title={act.name}>
                    {act.name}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-600">
                    {act.frequency.toLocaleString()}x
                  </td>
                  
                  {/* rule-based score */}
                  <td className="py-3 px-4 text-center border-l bg-slate-50/10 font-bold">
                    {ruleAsm ? (
                      <span className={`inline-block px-2 py-1.5 rounded-md border text-[11px] min-w-[40px] text-center ${getScoreColor(ruleAsm.score)}`}>
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
                      <td key={model.id} className="py-3 px-4 text-center border-l">
                        {score !== null ? (
                          <span 
                            title={`Latency: ${asm.latencyMs !== null && asm.latencyMs !== undefined ? `${(asm.latencyMs / 1000).toFixed(2)}s` : "n/a"} | Cost: ${formatCost(asm.costUsd, asm.model)}`}
                            className={`inline-block px-2 py-1.5 rounded-md border text-[11px] min-w-[40px] text-center cursor-help transition-transform hover:scale-105 duration-100 ${getScoreColor(score)}`}
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
                  <td className="py-3 px-4 text-center border-l bg-slate-50/10 font-bold">
                    {spread !== null ? (
                      <span className={`inline-block px-2 py-0.75 rounded-md text-[10px] min-w-[32px] text-center ${
                        spread > 25
                          ? "bg-rose-100 text-rose-800 border border-rose-200 font-extrabold"
                          : spread > 10
                          ? "bg-amber-100 text-amber-800 border border-amber-200 font-bold"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`} title={spread > 25 ? "High disagreement between AI models" : undefined}>
                        ±{spread}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>

                  {/* actions */}
                  <td className="py-3 px-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectAndCompare(act.name, activeScores.length)}
                      className="text-[10px] h-6 px-2.5 font-semibold gap-1 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs"
                    >
                      Compare
                    </Button>
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
