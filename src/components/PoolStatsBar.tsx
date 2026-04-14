"use client";

import React from "react";
import type { ScoredPool } from "@/lib/types/pool";

interface PoolStatsBarProps {
  pools: ScoredPool[];
  totalCount: number;
  loading: boolean;
}

export default function PoolStatsBar({ pools, totalCount, loading }: PoolStatsBarProps) {
  if (loading || pools.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg bg-card border border-white/5 p-3 animate-pulse">
            <div className="h-3 w-16 bg-white/10 rounded mb-2" />
            <div className="h-5 w-20 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const avgOrganic = pools.reduce((sum, p) => sum + (p.token_x.organic_score ?? 0), 0) / pools.length;
  const avgFeeTvl = pools.reduce((sum, p) => sum + (p.fee_active_tvl_ratio ?? 0), 0) / pools.length;
  const avgScore = pools.reduce((sum, p) => sum + p.score, 0) / pools.length;
  const totalTvl = pools.reduce((sum, p) => sum + (p.active_tvl ?? p.tvl ?? 0), 0);

  const stats = [
    { label: "Screened", value: pools.length.toLocaleString(), subvalue: `of ${totalCount.toLocaleString()} total` },
    { label: "Avg Score", value: avgScore.toFixed(1), subvalue: avgScore >= 70 ? "Good" : avgScore >= 40 ? "Fair" : "Poor" },
    { label: "Avg Organic", value: avgOrganic.toFixed(0), subvalue: avgOrganic >= 70 ? "High" : avgOrganic >= 50 ? "Medium" : "Low" },
    { label: "Total TVL", value: totalTvl >= 1_000_000 ? `$${(totalTvl / 1_000_000).toFixed(1)}M` : `$${(totalTvl / 1_000).toFixed(0)}K`, subvalue: `Avg fee/TVL: ${avgFeeTvl.toFixed(4)}` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-card border border-white/5 p-3">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="text-lg font-bold text-foreground">{stat.value}</p>
          <p className="text-[10px] text-muted-foreground">{stat.subvalue}</p>
        </div>
      ))}
    </div>
  );
}