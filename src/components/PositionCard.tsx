"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { UserPosition, calculatePositionHealth } from "@/lib/dlmm";
import { TOKEN_COLORS } from "@/lib/constants";
import PositionHealth from "./PositionHealth";

interface PositionCardProps {
  position: UserPosition;
}

export default function PositionCard({ position }: PositionCardProps) {
  const health = calculatePositionHealth(
    position.activeBinId,
    position.positionData.lowerBinId,
    position.positionData.upperBinId
  );

  const colorX = TOKEN_COLORS[position.tokenX.symbol] || "#6366f1";
  const colorY = TOKEN_COLORS[position.tokenY.symbol] || "#06b6d4";

  return (
    <Link href={`/position/${position.publicKey.toBase58()}`}>
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 cursor-pointer group shadow-lg hover:shadow-xl overflow-hidden relative">
        <CardContent className="p-5">
          {/* Header: Token pair + Health */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Token pair icons */}
              <div className="flex -space-x-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md z-10 ring-2 ring-black/30"
                  style={{ backgroundColor: colorX }}
                >
                  {position.tokenX.symbol.slice(0, 2)}
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md ring-2 ring-black/30"
                  style={{ backgroundColor: colorY }}
                >
                  {position.tokenY.symbol.slice(0, 2)}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground group-hover:text-teal-400 transition-colors">
                  {position.poolName}
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {position.publicKey.toBase58().slice(0, 8)}...
                </p>
              </div>
            </div>
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

          {/* Range */}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Bin {position.positionData.lowerBinId}</span>
              <span>Bin {position.positionData.upperBinId}</span>
            </div>
            {/* Range visualization */}
            <div className="w-full h-1.5 rounded-full bg-white/5 relative overflow-hidden">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-teal-500/50 to-cyan-500/50"
                style={{ left: "0%", width: "100%" }}
              />
              {/* Active bin indicator */}
              {health.status !== "out-of-range" && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-teal-400 shadow-lg shadow-teal-400/50 border border-white/30"
                  style={{
                    left: `${
                      ((position.activeBinId -
                        position.positionData.lowerBinId) /
                        (position.positionData.upperBinId -
                          position.positionData.lowerBinId)) *
                      100
                    }%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              )}
            </div>
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
