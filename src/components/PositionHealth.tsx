"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PositionHealthProps {
  score: number;
  status: "healthy" | "warning" | "critical" | "out-of-range";
}

const STATUS_CONFIG = {
  healthy: {
    label: "In Range",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    barColor: "from-emerald-500 to-green-400",
    description: "Active price is well within your bin range.",
  },
  warning: {
    label: "Near Edge",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    barColor: "from-amber-500 to-yellow-400",
    description: "Active price is approaching the edge of your range.",
  },
  critical: {
    label: "At Edge",
    color: "bg-rose-500/15 text-rose-400 border-rose-500/20",
    barColor: "from-rose-500 to-red-400",
    description: "Active price is at the edge. Risk of falling out of range.",
  },
  "out-of-range": {
    label: "Out of Range",
    color: "bg-gray-500/15 text-gray-400 border-gray-500/20",
    barColor: "from-gray-500 to-gray-400",
    description: "Active price has moved outside your range. Not earning fees.",
  },
};

export default function PositionHealth({
  score,
  status,
}: PositionHealthProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`${config.color} text-[10px] font-semibold cursor-help`}
          >
            {config.label}
          </Badge>
          {/* Mini health bar */}
          <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${config.barColor} transition-all duration-500`}
              style={{ width: `${Math.max(score, 5)}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-zinc-900/95 border-white/20 backdrop-blur-sm text-white"
      >
        <p className="text-xs">
          <span className="font-semibold text-emerald-400">Health: {score}%</span> —{" "}
          {config.description}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
