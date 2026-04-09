"use client";

import { BinPosition } from "@/lib/dlmm";
import { formatCompactDecimal } from "@/lib/format";

interface BinChartProps {
  bins: BinPosition[];
  activeBinId: number;
  tokenXSymbol: string;
  tokenYSymbol: string;
}

export default function BinChart({
  bins,
  activeBinId,
  tokenXSymbol,
  tokenYSymbol,
}: BinChartProps) {
  if (!bins || bins.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No bin data available
      </div>
    );
  }

  // Calculate max amounts for scaling - scale X and Y independently
  // so both token types are visible even when one dominates
  const maxAmountX = Math.max(
    ...bins.map((b) => parseFloat(b.amountX) || 0),
    0.0001
  );
  const maxAmountY = Math.max(
    ...bins.map((b) => parseFloat(b.amountY) || 0),
    0.0001
  );

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-violet-500 to-purple-400" />
          <span>{tokenXSymbol}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-teal-500 to-cyan-400" />
          <span>{tokenYSymbol}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-4 border-l-2 border-dashed border-yellow-400" />
          <span>Active Bin</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end gap-[2px] h-48 px-2">
        {bins.map((bin) => {
          const amountX = parseFloat(bin.amountX) || 0;
          const amountY = parseFloat(bin.amountY) || 0;
          // Scale each token independently so both are visible
          const heightX = (amountX / maxAmountX) * 100;
          const heightY = (amountY / maxAmountY) * 100;
          const isActive = bin.binId === activeBinId;
          // Total height is the max of the two, not the sum
          const totalHeight = Math.max(heightX, heightY, 2);

          return (
            <div
              key={bin.binId}
              className="flex-1 flex flex-col justify-end items-center group relative min-w-[3px]"
              style={{ height: "100%" }}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-zinc-900/95 border border-white/20 rounded-lg px-3 py-2 text-xs whitespace-nowrap backdrop-blur-sm shadow-xl">
                  <p className="text-zinc-400 mb-1">
                    Bin #{bin.binId}
                    {isActive && (
                      <span className="ml-1 text-yellow-400">★ Active</span>
                    )}
                  </p>
                  <p className="text-white mb-0.5">
                    {tokenXSymbol}:{" "}
                    <span className="font-mono text-violet-400">{formatCompactDecimal(amountX)}</span>
                  </p>
                  <p className="text-white mb-0.5">
                    {tokenYSymbol}:{" "}
                    <span className="font-mono text-teal-400">{formatCompactDecimal(amountY)}</span>
                  </p>
                  <p className="text-zinc-400 mt-1">
                    Price: <span className="font-mono text-white">{formatCompactDecimal(bin.price)}</span>
                  </p>
                </div>
              </div>

              {/* Bar */}
              <div
                className={`w-full rounded-t-sm transition-all duration-200 relative overflow-hidden ${
                  isActive
                    ? "ring-1 ring-yellow-400/60 shadow-lg shadow-yellow-400/20"
                    : "group-hover:opacity-80"
                }`}
                style={{ height: `${totalHeight}%`, minHeight: "2px" }}
              >
                {/* Determine which token dominates - show that color */}
                {amountY >= amountX ? (
                  /* USDC dominates - show teal */
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-teal-600 to-teal-400"
                  />
                ) : (
                  /* SOL dominates - show purple */
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-violet-600 to-violet-400"
                  />
                )}
                {/* Show small portion of other token if both exist */}
                {amountX > 0 && amountY > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                      height: `${Math.min((amountY / (amountX + amountY)) * 100, 30)}%`,
                    }}
                  >
                    {amountY >= amountX ? (
                      /* USDC dominates, show small purple at bottom */
                      <div className="absolute inset-0 bg-gradient-to-t from-violet-600 to-violet-400 opacity-50" />
                    ) : (
                      /* SOL dominates, show small teal at bottom */
                      <div className="absolute inset-0 bg-gradient-to-t from-teal-600 to-teal-400 opacity-50" />
                    )}
                  </div>
                )}
              </div>

              {/* Active bin marker */}
              {isActive && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                  <div className="w-1 h-1 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-2">
        <span>{formatCompactDecimal(bins[0]?.price || "0")}</span>
        <span>
          {formatCompactDecimal(bins[Math.floor(bins.length / 2)]?.price || "0")}
        </span>
        <span>{formatCompactDecimal(bins[bins.length - 1]?.price || "0")}</span>
      </div>
    </div>
  );
}
