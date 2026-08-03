import { MetricTooltip } from "@/components/ui/MetricTooltip";

interface PerformanceDashboardProps {
  activeDurationType: "average" | "median";
  setActiveDurationType: (type: "average" | "median") => void;
  top10Durations: { name: string; averageDuration: number; medianDuration: number }[];
  maxDurationInTop10: number;
  formatDuration: (ms: number) => string;
  top10Entropy: { name: string; predecessorEntropy: number; successorEntropy: number }[];
  maxEntropyValue: number;
  isExpanded?: boolean;
}

export default function PerformanceDashboard({
  activeDurationType,
  setActiveDurationType,
  top10Durations,
  maxDurationInTop10,
  formatDuration,
  top10Entropy,
  maxEntropyValue,
  isExpanded = false,
}: PerformanceDashboardProps) {
  return (
    <div className={`grid gap-8 ${isExpanded ? "grid-cols-2" : "grid-cols-1"} font-sans`}>
      {/* left column: execution duration per activity (toggleable) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1 block">
            {activeDurationType === "average" ? "Average Duration" : "Median Duration"}
            <MetricTooltip text="shows the execution duration for the top 10 longest-running activities." />
          </span>
          {/* average/median toggle buttons */}
          <div className="flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
            <button
              onClick={() => setActiveDurationType("average")}
              className={`px-3 py-1 text-[9px] uppercase tracking-wider font-bold rounded-sm transition-all cursor-pointer ${
                activeDurationType === "average"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Average
            </button>
            <button
              onClick={() => setActiveDurationType("median")}
              className={`px-3 py-1 text-[9px] uppercase tracking-wider font-bold rounded-sm transition-all cursor-pointer ${
                activeDurationType === "median"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Median
            </button>
          </div>
        </div>
        
        <div className="card bg-white z-depth-1 border border-slate-200 rounded-sm p-5 min-h-[250px] flex flex-col justify-between">
          {top10Durations.length > 0 ? (
            top10Durations.map((act) => {
              const durationVal = activeDurationType === "average" ? act.averageDuration : act.medianDuration;
              const percent = maxDurationInTop10 > 0 ? (durationVal / maxDurationInTop10) * 100 : 0;
              return (
                <div key={act.name} className="flex items-center text-xs gap-3">
                  <span
                    className="w-28 text-slate-655 font-medium truncate"
                    title={act.name}
                  >
                    {act.name}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-xs overflow-hidden relative">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full bg-green-500 rounded-xs transition-all duration-500"
                    />
                  </div>
                  <span className="w-16 text-right font-bold text-slate-700">
                    {formatDuration(durationVal)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 font-light">
              No duration data found
            </div>
          )}
        </div>
      </div>

      {/* right column: branching complexity (incoming vs outgoing) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1 block">
            Branching Complexity (Entropy)
            <MetricTooltip text="predecessor and successor path entropy. lower values mean higher predictability (ideal for RPA)." />
          </span>
          {/* legend for entropy types */}
          <div className="flex gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-cyan-600">
              <span className="w-2.5 h-2.5 bg-cyan-500 rounded-xs" />
              In
            </span>
            <span className="flex items-center gap-1 text-purple-650">
              <span className="w-2.5 h-2.5 bg-purple-500 rounded-xs" />
              Out
            </span>
          </div>
        </div>

        <div className="card bg-white z-depth-1 border border-slate-200 rounded-sm p-5 min-h-[250px] flex flex-col justify-between">
          {top10Entropy.length > 0 ? (
            top10Entropy.map((act) => {
              const predPercent = maxEntropyValue > 0 ? (act.predecessorEntropy / maxEntropyValue) * 100 : 0;
              const succPercent = maxEntropyValue > 0 ? (act.successorEntropy / maxEntropyValue) * 100 : 0;
              return (
                <div key={act.name} className="flex items-start text-xs gap-3">
                  <span
                    className="w-28 text-slate-655 font-medium truncate pt-0.5"
                    title={act.name}
                  >
                    {act.name}
                  </span>
                  
                  {/* stacked predecessor and successor bars */}
                  <div className="flex-1 space-y-1.5 pt-0.5">
                    {/* predecessor bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-xs overflow-hidden relative">
                        <div
                          style={{ width: `${predPercent}%` }}
                          className="h-full bg-cyan-500 rounded-xs transition-all duration-500"
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-[10px] text-slate-450 font-bold">
                        {act.predecessorEntropy.toFixed(2)}
                      </span>
                    </div>
                    
                    {/* successor bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-xs overflow-hidden relative">
                        <div
                          style={{ width: `${succPercent}%` }}
                          className="h-full bg-purple-500 rounded-xs transition-all duration-500"
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-[10px] text-slate-450 font-bold">
                        {act.successorEntropy.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 font-light">
              No entropy data found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
