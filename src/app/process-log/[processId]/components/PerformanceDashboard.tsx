import { MetricTooltip } from "@/components/ui/MetricTooltip";

interface PerformanceDashboardProps {
  activeDurationType: "average" | "median";
  setActiveDurationType: (type: "average" | "median") => void;
  top10Durations: { name: string; averageDuration: number; medianDuration: number }[];
  maxDurationInTop10: number;
  formatDuration: (ms: number) => string;
  top10Entropy: { name: string; predecessorEntropy: number; successorEntropy: number }[];
  maxEntropyValue: number;
}

export default function PerformanceDashboard({
  activeDurationType,
  setActiveDurationType,
  top10Durations,
  maxDurationInTop10,
  formatDuration,
  top10Entropy,
  maxEntropyValue,
}: PerformanceDashboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* left column: execution duration per activity (toggleable) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
            {activeDurationType === "average" ? "Average Duration" : "Median Duration"}
            <MetricTooltip text="shows the execution duration for the top 10 longest-running activities." />
          </h4>
          {/* average/median toggle buttons */}
          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              onClick={() => setActiveDurationType("average")}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                activeDurationType === "average"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Average
            </button>
            <button
              onClick={() => setActiveDurationType("median")}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                activeDurationType === "median"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Median
            </button>
          </div>
        </div>
        
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] flex flex-col justify-between">
          {top10Durations.length > 0 ? (
            top10Durations.map((act) => {
              const durationVal = activeDurationType === "average" ? act.averageDuration : act.medianDuration;
              const percent = maxDurationInTop10 > 0 ? (durationVal / maxDurationInTop10) * 100 : 0;
              return (
                <div key={act.name} className="flex items-center text-xs gap-3">
                  <span
                    className="w-28 text-slate-600 font-medium truncate"
                    title={act.name}
                  >
                    {act.name}
                  </span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative group">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 group-hover:brightness-110"
                    />
                  </div>
                  <span className="w-16 text-right font-semibold text-slate-700">
                    {formatDuration(durationVal)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              No duration data found
            </div>
          )}
        </div>
      </div>

      {/* right column: branching complexity (incoming vs outgoing) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
            Branching Complexity (Entropy)
            <MetricTooltip text="predecessor and successor path entropy. lower values mean higher predictability (ideal for RPA)." />
          </h4>
          {/* legend for entropy types */}
          <div className="flex gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-blue-600">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
              In
            </span>
            <span className="flex items-center gap-1 text-purple-600">
              <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm" />
              Out
            </span>
          </div>
        </div>

        <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] flex flex-col justify-between">
          {top10Entropy.length > 0 ? (
            top10Entropy.map((act) => {
              const predPercent = maxEntropyValue > 0 ? (act.predecessorEntropy / maxEntropyValue) * 100 : 0;
              const succPercent = maxEntropyValue > 0 ? (act.successorEntropy / maxEntropyValue) * 100 : 0;
              return (
                <div key={act.name} className="flex items-start text-xs gap-3">
                  <span
                    className="w-28 text-slate-600 font-medium truncate pt-0.5"
                    title={act.name}
                  >
                    {act.name}
                  </span>
                  
                  {/* stacked predecessor and successor bars */}
                  <div className="flex-1 space-y-1.5 pt-0.5">
                    {/* predecessor bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative group">
                        <div
                          style={{ width: `${predPercent}%` }}
                          className="h-full bg-blue-500 rounded-full transition-all duration-500 group-hover:brightness-115"
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-[10px] text-slate-500 font-medium">
                        {act.predecessorEntropy.toFixed(2)}
                      </span>
                    </div>
                    
                    {/* successor bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative group">
                        <div
                          style={{ width: `${succPercent}%` }}
                          className="h-full bg-purple-500 rounded-full transition-all duration-500 group-hover:brightness-115"
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-[10px] text-slate-500 font-medium">
                        {act.successorEntropy.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              No entropy data found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
