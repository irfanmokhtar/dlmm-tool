"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ScoredPool } from "@/lib/types/pool";

interface PoolStatsBarProps {
  pools: ScoredPool[];
  totalPools: number;
  loading: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

export default function PoolStatsBar({ pools, totalPools, loading }: PoolStatsBarProps) {
  const avgApr = pools.length > 0
    ? pools.reduce((sum, p) => sum + (p.apr ?? 0), 0) / pools.length
    : 0;

  const totalTvl = pools.reduce((sum, p) => sum + (p.tvl ?? 0), 0);

  const stats = [
    {
      label: "Pools Found",
      value: loading ? "—" : totalPools.toLocaleString(),
      accent: "from-teal-400 to-cyan-400",
      glow: "shadow-teal-500/10",
    },
    {
      label: "Avg APR",
      value: loading ? "—" : `${avgApr.toFixed(1)}%`,
      accent: "from-emerald-400 to-green-400",
      glow: "shadow-emerald-500/10",
    },
    {
      label: "Total TVL",
      value: loading ? "—" : formatNumber(totalTvl),
      accent: "from-violet-400 to-purple-400",
      glow: "shadow-violet-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`bg-white/[0.03] border-white/[0.06] backdrop-blur-sm shadow-lg ${stat.glow} overflow-hidden relative group`}
        >
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-0.5">{stat.label}</p>
            <p
              className={`text-lg font-bold bg-gradient-to-r ${stat.accent} bg-clip-text text-transparent`}
            >
              {stat.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}