"use client";

import { usePositionData } from "./PositionProvider";

const INTERVALS = [
  { label: "15s", value: 15_000 },
  { label: "30s", value: 30_000 },
  { label: "1m", value: 60_000 },
  { label: "2m", value: 120_000 },
  { label: "5m", value: 300_000 },
];

export default function RefreshSettings() {
  const { refreshInterval, updateRefreshInterval } = usePositionData();

  return (
    <div className="flex items-center gap-2 px-3 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        Refresh
      </span>
      <select
        value={refreshInterval}
        onChange={(e) => updateRefreshInterval(Number(e.target.value))}
        className="bg-transparent text-[10px] font-bold text-teal-400 focus:outline-none cursor-pointer appearance-none pr-1"
      >
        {INTERVALS.map((int) => (
          <option key={int.value} value={int.value} className="bg-[#0d0e12] text-white">
            {int.label}
          </option>
        ))}
      </select>
      {/* Custom Chevron icon */}
      <svg
        className="w-2.5 h-2.5 text-muted-foreground pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  );
}
