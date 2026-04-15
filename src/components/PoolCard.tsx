"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { ScoredPool, TimeWindow } from "@/lib/types/pool";
import { formatUSD, formatScore, getScoreColor, getScoreBgColor, getOrganicLabel } from "@/lib/screener";
import TokenLogo from "./TokenLogo";

interface PoolCardProps {
  pool: ScoredPool;
  volumeWindow: TimeWindow;
}

function RiskBadge({ label, variant = "warning" }: { label: string; variant?: "danger" | "warning" | "info" | "success" }) {
  const colors = {
    danger: "bg-red-500/10 text-red-400 border-red-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  };
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border", colors[variant])}>
      {label}
    </span>
  );
}

export default function PoolCard({ pool, volumeWindow }: PoolCardProps) {
  const baseToken = pool.token_x;
  const quoteToken = pool.token_y;
  const riskFlags = pool.riskFlags;
  const organic = getOrganicLabel(baseToken.organic_score ?? 0);

  const volume = pool.volume ?? 0;
  const tvl = pool.active_tvl ?? pool.tvl ?? 0;
  const feeTvlRatio = pool.fee_active_tvl_ratio ?? 0;
  const globalFeesSol = baseToken.global_fees_sol;
  const holders = pool.base_token_holders ?? 0;
  const topHoldersPct = baseToken.top_holders_pct ?? 0;
  const binStep = pool.dlmm_params?.bin_step ?? 0;
  const feePct = pool.fee_pct ?? 0;

  // Risk flag badges
  const riskBadges: { label: string; variant: "danger" | "warning" | "info" | "success" }[] = [];
  if (riskFlags.isBlacklisted) riskBadges.push({ label: "Blacklisted", variant: "danger" });
  if (riskFlags.hasWarnings) riskBadges.push({ label: "Warnings", variant: "warning" });
  if (riskFlags.lowOrganicScore) riskBadges.push({ label: "Low Organic", variant: "warning" });
  if (riskFlags.lowHolders) riskBadges.push({ label: "Low Holders", variant: "warning" });
  if (riskFlags.highTopHolders) riskBadges.push({ label: "Concentrated", variant: "warning" });
  if (riskFlags.lowFees) riskBadges.push({ label: "Low Fees", variant: "warning" });
  if (riskFlags.hasFreezeAuthority) riskBadges.push({ label: "Freeze Auth", variant: "danger" });
  if (riskFlags.hasMintAuthority) riskBadges.push({ label: "Mint Auth", variant: "danger" });
  if (baseToken.is_verified) riskBadges.push({ label: "Verified", variant: "success" });
  if (pool.has_farm) riskBadges.push({ label: "Farm", variant: "success" });

  return (
    <div className="group relative rounded-xl bg-card border border-white/10 p-4 hover:border-teal-500/30 hover:bg-card/80 transition-all duration-200">
      {/* Header: Score + Token Pair */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg border text-sm font-bold", getScoreBgColor(pool.score))}>
          <span className={getScoreColor(pool.score)}>{formatScore(pool.score)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              <TokenLogo src={baseToken.icon} symbol={baseToken.symbol} className="w-6 h-6" backgroundColor={baseToken.is_verified ? "#22c55e" : undefined} />
              <TokenLogo src={quoteToken.icon} symbol={quoteToken.symbol} className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground truncate">{pool.name}</h3>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-xs font-medium", organic.color)}>
              Organic: {baseToken.organic_score?.toFixed(0) ?? "—"} ({organic.label})
            </span>
            {baseToken.launchpad && (
              <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{baseToken.launchpad}</span>
            )}
          </div>
        </div>
      </div>

      {/* Risk Badges Row */}
      {riskBadges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {riskBadges.map((badge) => <RiskBadge key={badge.label} label={badge.label} variant={badge.variant} />)}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs mb-3">
        <div>
          <span className="text-muted-foreground">TVL</span>
          <p className="font-medium text-foreground">{formatUSD(tvl)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Vol {volumeWindow}</span>
          <p className="font-medium text-foreground">{formatUSD(volume)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Fee/TVL</span>
          <p className="font-medium text-foreground">{feeTvlRatio.toFixed(4)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Global Fees</span>
          <p className={cn("font-medium", globalFeesSol != null && globalFeesSol < 30 ? "text-red-400" : "text-foreground")}>
            {globalFeesSol != null ? `${globalFeesSol.toFixed(2)} SOL` : "—"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Mcap</span>
          <p className="font-medium text-foreground">{formatUSD(baseToken.market_cap ?? 0)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Holders</span>
          <p className="font-medium text-foreground">{holders.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Top 10</span>
          <p className={cn("font-medium", topHoldersPct > 60 ? "text-red-400" : topHoldersPct > 40 ? "text-amber-400" : "text-foreground")}>
            {topHoldersPct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span>Bin Step: {binStep}</span>
          <span>Fee: {feePct}%</span>
          {pool.dynamic_fee_pct > 0 && <span>Dynamic: {pool.dynamic_fee_pct.toFixed(4)}%</span>}
        </div>
        <span>{pool.active_positions ?? 0} positions</span>
      </div>
    </div>
  );
}