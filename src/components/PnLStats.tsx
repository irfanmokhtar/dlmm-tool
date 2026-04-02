"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PnLData {
  pnlUsd: number;
  pnlSol: number;
  pnlPercentage: number;
  costBasisUsd: number;
  currentValueUsd: number;
  hodlValueUsd: number;
  divergenceLossUsd: number;
}

interface PnLStatsProps {
  positionAddress: string;
  userWallet: string;
  poolAddress: string;
}

export default function PnLStats({ positionAddress, userWallet, poolAddress }: PnLStatsProps) {
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPnL = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pnl?position=${positionAddress}&user=${userWallet}&pool=${poolAddress}`);
      if (!res.ok) throw new Error("Failed to fetch PnL");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnL();
  }, [positionAddress, userWallet, poolAddress]);

  if (loading) {
    return (
      <Card className="p-6 bg-white/5 border-white/10 animate-pulse">
        <div className="h-4 w-24 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-12 bg-white/10 rounded" />
          <div className="h-12 bg-white/10 rounded" />
          <div className="h-12 bg-white/10 rounded" />
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6 bg-white/5 border-white/10">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{error || "No PnL data available"}</p>
          <button onClick={fetchPnL} className="text-teal-400 hover:text-teal-300">
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </Card>
    );
  }

  const isProfit = (data.pnlUsd || 0) >= 0;
  const isILNegative = (data.divergenceLossUsd || 0) < 0;

  return (
    <Card className="p-6 bg-white/5 border-white/10 overflow-hidden relative">
      {/* Background Decor */}
      <div className={cn(
        "absolute -right-4 -top-4 w-24 h-24 blur-3xl opacity-20 rounded-full",
        isProfit ? "bg-emerald-500" : "bg-rose-500"
      )} />

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          Position Performance
          <button onClick={fetchPnL} className="hover:rotate-180 transition-transform duration-500">
            <RefreshCcw className="w-3 h-3 text-muted-foreground" />
          </button>
        </h3>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
          isProfit ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          )}>
          {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isProfit ? "+" : ""}{(data.pnlPercentage || 0).toFixed(2)}%
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Net PnL (USD)</p>
          <p className={cn("text-2xl font-bold font-mono tracking-tight", isProfit ? "text-emerald-400" : "text-rose-400")}>
            {isProfit ? "+" : ""}${(data.pnlUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Total profit/loss including yield</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Net PnL (SOL)</p>
          <p className={cn("text-2xl font-bold font-mono tracking-tight", isProfit ? "text-emerald-400" : "text-rose-400")}>
            {isProfit ? "+" : ""}{(data.pnlSol || 0).toFixed(4)} SOL
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Denominated in SOL at current price</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Cost Basis</p>
          <p className="text-2xl font-bold text-foreground font-mono tracking-tight">
            ${(data.costBasisUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Total USD value at time of deposit</p>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Curr. Value</p>
          <p className="text-sm font-bold font-mono tracking-tight text-foreground">${(data.currentValueUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">HODL Value</p>
          <p className="text-sm font-bold font-mono tracking-tight text-teal-400">${(data.hodlValueUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Divergence Loss (IL)</p>
          <p className={cn("text-sm font-bold font-mono tracking-tight", isILNegative ? "text-rose-400" : "text-emerald-400")}>
            {isILNegative ? "" : "+"}${(data.divergenceLossUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Price Source</p>
          <p className="text-sm font-bold font-mono tracking-tight text-teal-600 uppercase">Birdeye / Jup</p>
        </div>
      </div>
    </Card>
  );
}
