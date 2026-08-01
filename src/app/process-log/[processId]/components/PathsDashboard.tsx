import { MetricTooltip } from "@/components/ui/MetricTooltip";

interface PathsDashboardProps {
  top10Transitions: { id: string; source: string; target: string; count: number }[];
  maxTransitionCount: number;
  pathDonutData: { name: string; frequency: number; percentage: number }[];
  totalPathCases: number;
  hoveredPathSlice: number | null;
  setHoveredPathSlice: (index: number | null) => void;
  activeTransitionType: "start" | "end";
  setActiveTransitionType: (type: "start" | "end") => void;
  isExpanded?: boolean;
}

const sliceColors = [
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
];

export default function PathsDashboard({
  top10Transitions,
  maxTransitionCount,
  pathDonutData,
  totalPathCases,
  hoveredPathSlice,
  setHoveredPathSlice,
  activeTransitionType,
  setActiveTransitionType,
  isExpanded = false,
}: PathsDashboardProps) {
  return (
    <div className={`grid gap-8 ${isExpanded ? "grid-cols-2" : "grid-cols-1"}`}>
      {/* left column: top 10 transitions bar chart */}
      <div className="space-y-4">
        <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
          Top 10 Sequence Transitions
          <MetricTooltip text="shows the most frequent transitions between consecutive activities." />
        </h4>
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] flex flex-col justify-between">
          {top10Transitions.length > 0 ? (
            top10Transitions.map((trans) => {
              const percent = maxTransitionCount > 0 ? (trans.count / maxTransitionCount) * 100 : 0;
              return (
                <div key={trans.id} className="flex items-center text-xs gap-3">
                  <span
                    className="w-36 text-slate-600 font-medium truncate flex items-center gap-1"
                    title={`${trans.source} → ${trans.target}`}
                  >
                    <span className="truncate max-w-[64px]">{trans.source}</span>
                    <span className="text-slate-400 text-[10px]">→</span>
                    <span className="truncate max-w-[64px]">{trans.target}</span>
                  </span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative group">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500 group-hover:brightness-110"
                    />
                  </div>
                  <span className="w-12 text-right font-semibold text-slate-700">
                    {trans.count.toLocaleString()}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              No transitions found
            </div>
          )}
        </div>
      </div>

      {/* right column: toggleable start and end step donut chart */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
            Start & End Step Distribution
            <MetricTooltip text="distribution of activities that initiate or terminate cases." />
          </h4>
          {/* start/end step toggle buttons */}
          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              onClick={() => {
                setActiveTransitionType("start");
                setHoveredPathSlice(null);
              }}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                activeTransitionType === "start"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Start Steps
            </button>
            <button
              onClick={() => {
                setActiveTransitionType("end");
                setHoveredPathSlice(null);
              }}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                activeTransitionType === "end"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              End Steps
            </button>
          </div>
        </div>

        <div className={`grid gap-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] items-center ${isExpanded ? "grid-cols-2" : "grid-cols-1"}`}>
          {/* circular path donut */}
          <div className="relative flex justify-center items-center h-44">
            <svg width="160" height="160" viewBox="0 0 160 160">
              {/* base circle backdrop */}
              <circle
                cx="80"
                cy="80"
                r="50"
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth="12"
              />
              {(() => {
                let accumulatedPercent = 0;
                // pre-calculate segment rotation angles in sequence first
                const preparedSlices = pathDonutData.map((slice, index) => {
                  const circumference = 314.16;
                  const strokeDasharray = `${(slice.percentage / 100) * circumference} ${circumference}`;
                  const rotationAngle = -90 + (accumulatedPercent / 100) * 360;
                  accumulatedPercent += slice.percentage;
                  return {
                    ...slice,
                    index,
                    strokeDasharray,
                    rotationAngle,
                  };
                });

                // sort rendering circles to draw hovered slice last (on top)
                const sortedForRender = [...preparedSlices].sort((a, b) => {
                  if (a.index === hoveredPathSlice) return 1;
                  if (b.index === hoveredPathSlice) return -1;
                  return 0;
                });

                return sortedForRender.map((slice) => {
                  const color = sliceColors[slice.index % sliceColors.length];
                  const isHovered = hoveredPathSlice === slice.index;

                  return (
                    <circle
                      key={slice.name}
                      cx="80"
                      cy="80"
                      r="50"
                      fill="transparent"
                      stroke={color}
                      strokeWidth={isHovered ? "16" : "12"}
                      style={{
                        strokeDasharray: slice.strokeDasharray,
                        strokeDashoffset: 0,
                      }}
                      transform={`rotate(${slice.rotationAngle} 80 80)`}
                      className="transition-[stroke-width] duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredPathSlice(slice.index)}
                      onMouseLeave={() => setHoveredPathSlice(null)}
                    />
                  );
                });
              })()}
            </svg>
            
            {/* display hovered step name and absolute frequency inside circle */}
            <div className="absolute flex flex-col justify-center items-center pointer-events-none w-24 text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-full">
                {hoveredPathSlice !== null ? pathDonutData[hoveredPathSlice].name : "Total Cases"}
              </span>
              <strong className="text-base font-extrabold text-slate-800 mt-0.5">
                {hoveredPathSlice !== null 
                  ? pathDonutData[hoveredPathSlice].frequency.toLocaleString()
                  : totalPathCases.toLocaleString()}
              </strong>
            </div>
          </div>

          {/* path legend list */}
          <div className="space-y-1.5 justify-center flex flex-col">
            {pathDonutData.length > 0 ? (
              pathDonutData.map((slice, index) => {
                const color = sliceColors[index % sliceColors.length];
                const isHovered = hoveredPathSlice === index;
                return (
                  <div
                    key={slice.name}
                    className={`flex items-center text-xs justify-between p-1 rounded transition-colors duration-150 ${
                      isHovered ? "bg-white shadow-sm border border-slate-100" : "border border-transparent"
                    }`}
                    onMouseEnter={() => setHoveredPathSlice(index)}
                    onMouseLeave={() => setHoveredPathSlice(null)}
                  >
                    <div className="flex items-center gap-2 truncate pr-1">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-slate-600 font-medium truncate" title={slice.name}>
                        {slice.name}
                      </span>
                    </div>
                    <span className="text-slate-700 font-semibold flex-shrink-0">
                      {slice.percentage.toFixed(1)}%
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-slate-400 italic">No start/end data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
