import { memo } from "react";
import { Info } from "lucide-react";

interface MetricTooltipProps {
  text: string;
  align?: "center" | "right";
  position?: "top" | "bottom";
}

export const MetricTooltip = memo(({
  text,
  align = "center",
  position = "top"
}: MetricTooltipProps) => {
  return (
    <span className="group relative cursor-default inline-flex items-center text-slate-400 hover:text-slate-600 transition-colors">
      <Info className="w-3.5 h-3.5 ml-1" />
      <span className={`absolute mb-1.5 hidden group-hover:block w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-lg z-30 font-normal normal-case leading-normal text-left break-words ${
        position === "bottom"
          ? "top-full mt-1.5 bottom-auto mb-0"
          : "bottom-full mb-1.5 top-auto mt-0"
      } ${
        align === "right"
          ? "right-0 translate-x-[15%] left-auto"
          : "left-1/2 -translate-x-1/2"
      }`}>
        {text}
        {/* tiny arrow tooltip indicator */}
        <span className={`absolute border-4 border-transparent ${
          position === "bottom"
            ? "bottom-full border-b-slate-900 border-t-transparent top-auto"
            : "top-full border-t-slate-900 border-b-transparent bottom-auto"
        } ${
          align === "right"
            ? "right-[36px] left-auto"
            : "left-1/2 -translate-x-1/2"
        }`} />
      </span>
    </span>
  );
});
MetricTooltip.displayName = "MetricTooltip";
