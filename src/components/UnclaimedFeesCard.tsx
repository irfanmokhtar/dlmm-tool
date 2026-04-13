"use client";

import { useMemo, useEffect, useState } from "react";
import { UserPosition } from "@/lib/dlmm";
import TokenLogo from "@/components/TokenLogo";
import { Card, CardContent } from "@/components/ui/card";

interface UnclaimedFeesCardProps {
  positions: UserPosition[];
  loading?: boolean;
}

interface FeeEntry {
  symbol: string;
  mint: string;
  logoURI?: string;
  amount: number;
  usdValue: number;
  isSol: boolean;
}

function formatUsd(value: number): string {
  if (value < 0.01) return "<$0.01";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export default function UnclaimedFeesCard({ positions, loading }: UnclaimedFeesCardProps) {
  // Fallback prices from Jupiter API (for tokens missing tokenXPrice/tokenYPrice)
  const [apiPrices, setApiPrices] = useState<Record<string, number>>({});

  // Collect mints that need price lookup
  const mintsNeedingPrice = useMemo(() => {
    const mints = new Set<string>();
    for (const pos of positions) {
      const feeX = parseFloat(pos.positionData.feeX || "0");
      const feeY = parseFloat(pos.positionData.feeY || "0");
      if (feeX > 0 && !pos.tokenXPrice) mints.add(pos.tokenX.mint);
      if (feeY > 0 && !pos.tokenYPrice) mints.add(pos.tokenY.mint);
    }
    return Array.from(mints);
  }, [positions]);

  // Fetch missing prices from Jupiter API
  useEffect(() => {
    if (mintsNeedingPrice.length === 0) return;
    let cancelled = false;
    fetch(`/api/token-prices?ids=${mintsNeedingPrice.join(",")}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.prices) setApiPrices(data.prices);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mintsNeedingPrice]);

  const fees = useMemo(() => {
    const feeMap = new Map<string, FeeEntry>();

    for (const pos of positions) {
      const feeX = parseFloat(pos.positionData.feeX || "0");
      const feeY = parseFloat(pos.positionData.feeY || "0");
      if (feeX <= 0 && feeY <= 0) continue;

      // Use position price first, then fallback to API price
      const priceX = pos.tokenXPrice
        ? parseFloat(pos.tokenXPrice)
        : (apiPrices[pos.tokenX.mint] || 0);
      const priceY = pos.tokenYPrice
        ? parseFloat(pos.tokenYPrice)
        : (apiPrices[pos.tokenY.mint] || 0);

      // Token X
      if (feeX > 0) {
        const key = pos.tokenX.mint;
        const existing = feeMap.get(key);
        const usdVal = feeX * priceX;
        const isSol = pos.tokenX.symbol === "SOL" || pos.tokenX.symbol === "WSOL";
        if (existing) {
          existing.amount += feeX;
          existing.usdValue += usdVal;
        } else {
          feeMap.set(key, {
            symbol: pos.tokenX.symbol,
            mint: pos.tokenX.mint,
            logoURI: pos.tokenX.logoURI,
            amount: feeX,
            usdValue: usdVal,
            isSol,
          });
        }
      }

      // Token Y
      if (feeY > 0) {
        const key = pos.tokenY.mint;
        const existing = feeMap.get(key);
        const usdVal = feeY * priceY;
        const isSol = pos.tokenY.symbol === "SOL" || pos.tokenY.symbol === "WSOL";
        if (existing) {
          existing.amount += feeY;
          existing.usdValue += usdVal;
        } else {
          feeMap.set(key, {
            symbol: pos.tokenY.symbol,
            mint: pos.tokenY.mint,
            logoURI: pos.tokenY.logoURI,
            amount: feeY,
            usdValue: usdVal,
            isSol,
          });
        }
      }
    }

    // Sort: SOL first, then by USD value descending
    return Array.from(feeMap.values()).sort((a, b) => {
      if (a.isSol && !b.isSol) return -1;
      if (!a.isSol && b.isSol) return 1;
      return b.usdValue - a.usdValue;
    });
  }, [positions, apiPrices]);

  const totalUsd = useMemo(() => fees.reduce((sum, f) => sum + f.usdValue, 0), [fees]);
  const hasFees = fees.length > 0;

  if (loading) {
    return (
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-[0.15em]">
            Unclaimed Fees
          </p>
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-zinc-700 animate-pulse" />
                  <div className="h-3 w-12 animate-pulse rounded bg-zinc-700" />
                </div>
                <div className="h-3 w-20 animate-pulse rounded bg-zinc-700" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm overflow-hidden relative group">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-[0.15em]">
          Unclaimed Fees
        </p>

        {!hasFees ? (
          <p className="text-sm text-zinc-500">No unclaimed fees</p>
        ) : (
          <>
            {/* Total in USD */}
            <p className="text-xl font-bold font-mono text-amber-400 mb-3">
              {formatUsd(totalUsd)}
            </p>

            {/* Per-token breakdown */}
            <div className="space-y-2">
              {fees.map((fee) => (
                <div key={fee.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TokenLogo
                      src={fee.logoURI}
                      symbol={fee.symbol}
                      className="w-4 h-4 text-[9px]"
                      backgroundColor={fee.isSol ? "#9945FF" : "#14b8a6"}
                    />
                    <span className="text-xs text-zinc-400">{fee.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-300">
                      {fee.amount < 0.0001
                        ? "<0.0001"
                        : fee.amount >= 1
                          ? fee.amount.toFixed(2)
                          : fee.amount.toFixed(4)
                      }
                    </span>
                    {fee.usdValue > 0.01 && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {formatUsd(fee.usdValue)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
      {/* Gradient line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-amber-400 to-orange-400 opacity-20 group-hover:opacity-40 transition-opacity" />
    </Card>
  );
}