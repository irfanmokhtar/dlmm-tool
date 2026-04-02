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

  // Calculate max amounts for scaling
  const maxAmountX = Math.max(
    ...bins.map((b) => parseFloat(b.amountX) || 0),
    0.0001
  );
  const maxAmountY = Math.max(
    ...bins.map((b) => parseFloat(b.amountY) || 0),
    0.0001
  );
  const maxAmount = Math.max(maxAmountX, maxAmountY);

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
          const heightX = (amountX / maxAmount) * 100;
          const heightY = (amountY / maxAmount) * 100;
          const isActive = bin.binId === activeBinId;
          const totalHeight = Math.max(heightX + heightY, 2);

          return (
            <div
              key={bin.binId}
              className="flex-1 flex flex-col justify-end items-center group relative min-w-[3px]"
              style={{ height: "100%" }}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-black/90 border border-white/10 rounded-lg px-3 py-2 text-xs whitespace-nowrap backdrop-blur-sm shadow-xl">
                  <p className="text-muted-foreground mb-1">
                    Bin #{bin.binId}
                    {isActive && (
                      <span className="ml-1 text-yellow-400">★ Active</span>
                    )}
                  </p>
                  <p className="text-foreground">
                    {tokenXSymbol}:{" "}
                    <span className="font-mono">{formatCompactDecimal(amountX)}</span>
                  </p>
                  <p className="text-foreground">
                    {tokenYSymbol}:{" "}
                    <span className="font-mono">{formatCompactDecimal(amountY)}</span>
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Price: <span className="font-mono">{formatCompactDecimal(bin.price)}</span>
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
                {/* Y amount (bottom) */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-teal-600 to-teal-400"
                  style={{
                    height:
                      totalHeight > 0
                        ? `${(heightY / (heightX + heightY)) * 100}%`
                        : "0%",
                  }}
                />
                {/* X amount (top) */}
                <div
                  className="absolute top-0 left-0 right-0 bg-gradient-to-t from-violet-600 to-violet-400"
                  style={{
                    height:
                      totalHeight > 0
                        ? `${(heightX / (heightX + heightY)) * 100}%`
                        : "0%",
                  }}
                />
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
