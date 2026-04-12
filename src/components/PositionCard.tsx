"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPosition, calculatePositionHealth, BinPosition } from "@/lib/dlmm";
import { TOKEN_COLORS } from "@/lib/constants";
import PositionHealth from "./PositionHealth";
import { useAutoCloseContext } from "./AutoCloseMonitor";
import { usePnLCurrency, deriveSolPrice } from "./PnLCurrencyProvider";
import TokenLogo from "./TokenLogo";

interface PositionCardProps {
  position: UserPosition;
}

/** Compact bin distribution chart for the position card */
function MiniBinChart({
  bins,
  activeBinId,
  lowerBinId,
  upperBinId,
}: {
  bins: BinPosition[];
  activeBinId: number;
  lowerBinId: number;
  upperBinId: number;
}) {
  if (!bins || bins.length === 0) {
    // Fallback to simple range bar
    return (
      <div className="w-full h-2 rounded-full bg-white/5" />
    );
  }

  const maxAmountX = Math.max(...bins.map((b) => parseFloat(b.amountX) || 0), 0.0001);
  const maxAmountY = Math.max(...bins.map((b) => parseFloat(b.amountY) || 0), 0.0001);
  const totalBins = upperBinId - lowerBinId + 1;
  const activeBinInRange = activeBinId >= lowerBinId && activeBinId <= upperBinId;

  return (
    <div className="relative w-full h-8 flex items-end gap-px overflow-hidden">
      {bins.map((bin) => {
        const amountX = parseFloat(bin.amountX) || 0;
        const amountY = parseFloat(bin.amountY) || 0;
        const heightX = (amountX / maxAmountX) * 100;
        const heightY = (amountY / maxAmountY) * 100;
        const totalHeight = Math.max(heightX, heightY, 4);
        const isActive = bin.binId === activeBinId;
        const hasLiquidity = amountX > 0 || amountY > 0;

        return (
          <div
            key={bin.binId}
            className="flex-1 flex flex-col justify-end"
            style={{ height: "100%", minWidth: "1px" }}
          >
            <div
              className={`w-full rounded-t-sm transition-opacity ${
                isActive
                  ? "ring-1 ring-yellow-400/60"
                  : hasLiquidity
                  ? "opacity-80"
                  : "opacity-30"
              }`}
              style={{
                height: `${totalHeight}%`,
                minHeight: hasLiquidity ? "2px" : "1px",
              }}
            >
              {amountY >= amountX ? (
                <div className="w-full h-full bg-gradient-to-t from-teal-600/80 to-teal-400/80" />
              ) : (
                <div className="w-full h-full bg-gradient-to-t from-violet-600/80 to-violet-400/80" />
              )}
            </div>
          </div>
        );
      })}
      {/* Active bin indicator line */}
      {activeBinInRange && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/80 pointer-events-none"
          style={{
            left: `${((activeBinId - lowerBinId) / totalBins) * 100}%`,
          }}
        />
      )}
    </div>
  );
}

export default function PositionCard({ position }: PositionCardProps) {
  const health = calculatePositionHealth(
    position.activeBinId,
    position.positionData.lowerBinId,
    position.positionData.upperBinId
  );

  const colorX = TOKEN_COLORS[position.tokenX.symbol] || "#6366f1";
  const colorY = TOKEN_COLORS[position.tokenY.symbol] || "#06b6d4";
  const autoClose = useAutoCloseContext();
  const isAutoCloseOn = autoClose.isAutoCloseEnabled(position.publicKey.toBase58());
  const { currency, toggleCurrency } = usePnLCurrency();
  const solPrice = deriveSolPrice(position);

  const pnlDisplayValue = (() => {
    if (position.pnlUsd == null) return null;
    const usd = Number(position.pnlUsd);
    if (currency === "USD") {
      return (usd >= 0 ? "+" : "") + usd.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });
    }
    if (!solPrice) return null;
    const sol = usd / solPrice;
    return `${usd >= 0 ? "+" : ""}◎${Math.abs(sol).toFixed(4)}`;
  })();

  return (
    <Link href={`/position/${position.publicKey.toBase58()}`}>
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 cursor-pointer group shadow-lg hover:shadow-xl overflow-hidden relative">
        <CardContent className="p-5">
          {/* Header: Token pair name, Icons, and PnL */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                <TokenLogo
                  src={position.tokenX.logoURI}
                  symbol={position.tokenX.symbol}
                  className="w-8 h-8 z-10"
                  backgroundColor={colorX}
                />
                <TokenLogo
                  src={position.tokenY.logoURI}
                  symbol={position.tokenY.symbol}
                  className="w-8 h-8"
                  backgroundColor={colorY}
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base text-foreground leading-tight truncate">
                  {position.poolName}
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono truncate opacity-60">
                  {position.publicKey.toBase58().slice(0, 12)}...
                </p>
              </div>
            </div>
            {pnlDisplayValue != null && position.pnlPercent != null && (
              <div className="text-right shrink-0">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCurrency(); }}
                  className={`text-sm font-mono font-semibold ${
                    Number(position.pnlUsd) >= 0 ? "text-emerald-400" : "text-rose-400"
                  } hover:opacity-80 transition-opacity`}
                  title={`Switch to ${currency === "USD" ? "SOL" : "USD"}`}
                >
                  {pnlDisplayValue}
                </button>
                <p className={`text-[10px] font-mono font-medium ${
                  Number(position.pnlPercent) >= 0 ? "text-emerald-400/70" : "text-rose-400/70"
                }`}>
                  {Number(position.pnlPercent) >= 0 ? "+" : ""}
                  {Number(position.pnlPercent).toFixed(2)}%
                </p>
              </div>
            )}
          </div>

          {/* Status Row: AutoClose + Health */}
          <div className="flex items-center gap-2 mb-4">
            {isAutoCloseOn && (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] px-1.5 py-0 h-5 font-bold uppercase tracking-wider gap-1 hover:bg-amber-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                </span>
                Auto
              </Badge>
            )}
            <PositionHealth score={health.score} status={health.status} />
          </div>


          {/* Active Price */}
          <div className="mb-4 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <p className="text-[10px] text-muted-foreground mb-0.5">
              Active Price
            </p>
            <p className="text-sm font-mono font-semibold text-foreground">
              {parseFloat(position.activeBinPrice).toFixed(4)}
              <span className="text-muted-foreground ml-1 text-xs">
                {position.tokenY.symbol}/{position.tokenX.symbol}
              </span>
            </p>
          </div>

          {/* Token Balances */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">
                {position.tokenX.symbol}
              </p>
              <p className="text-sm font-mono font-medium text-foreground">
                {parseFloat(position.positionData.totalXAmount).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 4 }
                )}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">
                {position.tokenY.symbol}
              </p>
              <p className="text-sm font-mono font-medium text-foreground">
                {parseFloat(position.positionData.totalYAmount).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 2 }
                )}
              </p>
            </div>
          </div>

          {/* Bin Distribution */}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Bin {position.positionData.lowerBinId}</span>
              <span>Bin {position.positionData.upperBinId}</span>
            </div>
            <MiniBinChart
              bins={position.positionData.positionBinData}
              activeBinId={position.activeBinId}
              lowerBinId={position.positionData.lowerBinId}
              upperBinId={position.positionData.upperBinId}
            />
          </div>

          {/* Unclaimed Fees */}
          {(parseFloat(position.positionData.feeX) > 0 ||
            parseFloat(position.positionData.feeY) > 0) && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[10px] text-emerald-400 font-medium">
                Unclaimed Fees
              </p>
              <p className="text-xs font-mono text-emerald-400">
                {parseFloat(position.positionData.feeX) > 0 &&
                  `${parseFloat(position.positionData.feeX).toFixed(4)} ${position.tokenX.symbol}`}
                {parseFloat(position.positionData.feeX) > 0 &&
                  parseFloat(position.positionData.feeY) > 0 &&
                  " + "}
                {parseFloat(position.positionData.feeY) > 0 &&
                  `${parseFloat(position.positionData.feeY).toFixed(2)} ${position.tokenY.symbol}`}
              </p>
            </div>
          )}
        </CardContent>

        {/* Hover glow effect */}
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${colorX}08, transparent 40%)`,
          }}
        />
      </Card>
    </Link>
  );
}
