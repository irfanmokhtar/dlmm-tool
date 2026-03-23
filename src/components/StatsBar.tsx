"use client";

import { UserPosition, calculatePositionHealth } from "@/lib/dlmm";
import { Card, CardContent } from "@/components/ui/card";

interface StatsBarProps {
  positions: UserPosition[];
  loading: boolean;
}

export default function StatsBar({ positions, loading }: StatsBarProps) {
  const totalPositions = positions.length;
  const inRangeCount = positions.filter((p) => {
    const health = calculatePositionHealth(
      p.activeBinId,
      p.positionData.lowerBinId,
      p.positionData.upperBinId
    );
    return health.status !== "out-of-range";
  }).length;
  const outOfRangeCount = totalPositions - inRangeCount;

  // Sum up unclaimed fees (simplified — in real app you'd convert to USD)
  const totalFeeX = positions.reduce(
    (sum, p) => sum + parseFloat(p.positionData.feeX || "0"),
    0
  );
  const totalFeeY = positions.reduce(
    (sum, p) => sum + parseFloat(p.positionData.feeY || "0"),
    0
  );

  const stats = [
    {
      label: "Active Positions",
      value: loading ? "—" : totalPositions.toString(),
      accent: "from-teal-400 to-cyan-400",
      glow: "shadow-teal-500/10",
    },
    {
      label: "In Range",
      value: loading ? "—" : inRangeCount.toString(),
      accent: "from-emerald-400 to-green-400",
      glow: "shadow-emerald-500/10",
    },
    {
      label: "Out of Range",
      value: loading ? "—" : outOfRangeCount.toString(),
      accent: "from-rose-400 to-red-400",
      glow: "shadow-rose-500/10",
    },
    {
      label: "Unclaimed Fees",
      value: loading
        ? "—"
        : totalFeeX > 0 || totalFeeY > 0
        ? `${totalFeeX > 0 ? totalFeeX.toFixed(4) : ""} ${
            totalFeeY > 0 ? `/ ${totalFeeY.toFixed(2)}` : ""
          }`
        : "0",
      accent: "from-amber-400 to-orange-400",
      glow: "shadow-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`bg-white/[0.03] border-white/[0.06] backdrop-blur-sm shadow-lg ${stat.glow} overflow-hidden relative group`}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p
              className={`text-2xl font-bold font-mono bg-gradient-to-r ${stat.accent} bg-clip-text text-transparent`}
            >
              {stat.value}
            </p>
          </CardContent>
          {/* Subtle gradient line at bottom */}
          <div
            className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r ${stat.accent} opacity-20 group-hover:opacity-40 transition-opacity`}
          />
        </Card>
      ))}
    </div>
  );
}
