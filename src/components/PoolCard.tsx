"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScoredPool } from "@/lib/types/pool";
import TokenLogo from "@/components/TokenLogo";
import { TOKEN_COLORS } from "@/lib/constants";
import { formatCompactDecimal } from "@/lib/format";
import { TrendingUp, Droplets, BarChart3, Percent } from "lucide-react";
import { useState } from "react";

interface PoolCardProps {
  pool: ScoredPool;
  logoMap?: Record<string, string>;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.001) return `$${num.toFixed(4)}`;
  return `$${num.toExponential(2)}`;
}

function formatPercent(num: number): string {
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}K%`;
  return `${num.toFixed(2)}%`;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

function getScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 40) return "bg-amber-500/10 border-amber-500/20";
  return "bg-rose-500/10 border-rose-500/20";
}

export default function PoolCard({ pool, logoMap }: PoolCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(pool.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: no clipboard API
    }
  };

  const symbolX = pool.token_x?.symbol || "???";
  const symbolY = pool.token_y?.symbol || "???";
  const colorX = TOKEN_COLORS[symbolX] || "#6366f1";
  const colorY = TOKEN_COLORS[symbolY] || "#6366f1";
  // Resolve logos from Jupiter metadata (same source as Dashboard)
  const logoX = (pool.token_x?.address && logoMap?.[pool.token_x.address]) || undefined;
  const logoY = (pool.token_y?.address && logoMap?.[pool.token_y.address]) || undefined;

  const volume24h = pool.volume?.["24h"] ?? 0;
  const feeRate = pool.pool_config?.base_fee_pct ?? 0;
  const binStep = pool.pool_config?.bin_step ?? 0;
  const apr = pool.apr ?? 0;
  const tvl = pool.tvl ?? 0;

  return (
    <Card
      className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-200 cursor-pointer group"
      onClick={handleCopyAddress}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: Token pair + Score */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Token logos */}
            <div className="relative flex shrink-0">
              <TokenLogo
                src={logoX}
                symbol={symbolX}
                className="w-7 h-7"
                backgroundColor={colorX}
              />
              <div className="-ml-2">
                <TokenLogo
                  src={logoY}
                  symbol={symbolY}
                  className="w-7 h-7"
                  backgroundColor={colorY}
                />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {pool.name || `${symbolX}-${symbolY}`}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                {symbolX} / {symbolY}
                {pool.has_farm && " 🌾"}
              </p>
            </div>
          </div>

          {/* Score badge */}
          <div
            className={`shrink-0 px-2 py-0.5 rounded-md border text-xs font-bold ${getScoreBg(pool.score)}`}
          >
            <span className={getScoreColor(pool.score)}>{pool.score}</span>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1">
          {pool.token_x?.is_verified && pool.token_y?.is_verified && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-emerald-500/30 text-emerald-400">
              ✓ Verified
            </Badge>
          )}
          {pool.has_farm && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-500/30 text-amber-400">
              🌾 Farm
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-white/10 text-muted-foreground">
            Bin {binStep}
          </Badge>
          {pool.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-white/10 text-muted-foreground">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Droplets className="size-3" /> TVL
            </span>
            <span className="font-medium text-foreground">{formatNumber(tvl)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <BarChart3 className="size-3" /> Vol 24h
            </span>
            <span className="font-medium text-foreground">{formatNumber(volume24h)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3" /> APR
            </span>
            <span className="font-medium text-emerald-400">{formatPercent(apr)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Percent className="size-3" /> Fee
            </span>
            <span className="font-medium text-foreground">{feeRate.toFixed(2)}%</span>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-white/[0.04]">
          <span>Price</span>
          <span className="font-mono">
            {pool.current_price != null ? formatCompactDecimal(pool.current_price, 6) : "—"}
          </span>
        </div>

        {/* Copy feedback */}
        <div className="text-[10px] text-center text-muted-foreground/50 group-hover:text-muted-foreground/80 transition-colors">
          {copied ? "✓ Copied address" : "Click to copy address"}
        </div>
      </CardContent>
    </Card>
  );
}