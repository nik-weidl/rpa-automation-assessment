import { MetricTooltip } from "@/components/ui/MetricTooltip";

interface FrequencyDashboardProps {
  top10Activities: { name: string; frequency: number }[];
  maxFrequencyInTop10: number;
  donutData: { name: string; frequency: number; percentage: number }[];
  totalEvents: number;
  hoveredSlice: number | null;
  setHoveredSlice: (index: number | null) => void;
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

export default function FrequencyDashboard({
  top10Activities,
  maxFrequencyInTop10,
  donutData,
  totalEvents,
  hoveredSlice,
  setHoveredSlice,
  isExpanded = false,
}: FrequencyDashboardProps) {
  return (
    <div className={`grid gap-8 ${isExpanded ? "grid-cols-2" : "grid-cols-1"}`}>
      {/* left column: horizontal bar chart */}
      <div className="space-y-4">
        <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
          Top 10 Most Frequent Activities
          <MetricTooltip text="Frequency of execution for the top 10 most active process steps." />
        </h4>
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] flex flex-col justify-between">
          {top10Activities.map((act) => {
            const percent = maxFrequencyInTop10 > 0 ? (act.frequency / maxFrequencyInTop10) * 100 : 0;
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
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 group-hover:brightness-110"
                  />
                </div>
                <span className="w-12 text-right font-semibold text-slate-700">
                  {act.frequency.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* right column: donut chart */}
      <div className="space-y-4">
        <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
          Activity Volume Share
          <MetricTooltip text="Relative percentage share of total event volume by activity." />
        </h4>
        <div className={`grid gap-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100 min-h-[250px] items-center ${isExpanded ? "grid-cols-2" : "grid-cols-1"}`}>
          {/* circular donut */}
          <div className="relative flex justify-center items-center h-44">
            <svg width="160" height="160" viewBox="0 0 160 160">
              {/* base circle */}
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
                // compute rotation angles in original order first to preserve positions
                const preparedSlices = donutData.map((slice, index) => {
                  const circumference = 314.16;
                  const strokeDasharray = `${(slice.percentage / 100) * circumference} ${circumference}`;
                  // calculate rotation angle so each segment starts exactly where the previous ended
                  const rotationAngle = -90 + (accumulatedPercent / 100) * 360;
                  accumulatedPercent += slice.percentage;
                  return {
                    ...slice,
                    index,
                    strokeDasharray,
                    rotationAngle,
                  };
                });

                // sort so that the hovered slice is rendered last (on top of others)
                const sortedForRender = [...preparedSlices].sort((a, b) => {
                  if (a.index === hoveredSlice) return 1;
                  if (b.index === hoveredSlice) return -1;
                  return 0;
                });

                return sortedForRender.map((slice) => {
                  const color = sliceColors[slice.index % sliceColors.length];
                  const isHovered = hoveredSlice === slice.index;

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
                      onMouseEnter={() => setHoveredSlice(slice.index)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  );
                });
              })()}
            </svg>
            
            {/* center info overlay */}
            <div className="absolute flex flex-col justify-center items-center pointer-events-none w-24 text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-full">
                {hoveredSlice !== null ? donutData[hoveredSlice].name : "Total Events"}
              </span>
              <strong className="text-base font-extrabold text-slate-800 mt-0.5">
                {hoveredSlice !== null 
                  ? donutData[hoveredSlice].frequency.toLocaleString()
                  : totalEvents.toLocaleString()}
              </strong>
            </div>
          </div>

          {/* legend list */}
          <div className="space-y-1.5 justify-center flex flex-col">
            {donutData.map((slice, index) => {
              const color = sliceColors[index % sliceColors.length];
              const isHovered = hoveredSlice === index;
              return (
                <div
                  key={slice.name}
                  className={`flex items-center text-xs justify-between p-1 rounded transition-colors duration-150 ${
                    isHovered ? "bg-white shadow-sm border border-slate-100" : "border border-transparent"
                  }`}
                  onMouseEnter={() => setHoveredSlice(index)}
                  onMouseLeave={() => setHoveredSlice(null)}
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
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
