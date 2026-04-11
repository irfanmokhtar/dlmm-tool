"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import TokenLogo from "@/components/TokenLogo";
import { formatCompactDecimal } from "@/lib/format";
import { UserPosition } from "@/lib/dlmm";
import { usePnLCurrency, deriveSolPrice } from "@/components/PnLCurrencyProvider";

interface PositionOverviewProps {
  position: UserPosition;
}

function formatPercent(value?: string) {
  if (!value || Number.isNaN(Number(value))) return "—";
  const amount = Number(value);
  return `${amount > 0 ? "+" : ""}${amount.toFixed(2)}%`;
}

export default function PositionOverview({ position }: PositionOverviewProps) {
  const { currency, toggleCurrency, formatValue } = usePnLCurrency();
  const solPrice = deriveSolPrice(position);
  const positive = Number(position.pnlUsd) >= 0;
  const pnlClass = positive ? "text-emerald-400" : "text-rose-400";

  const hasFees =
    parseFloat(position.positionData.feeX) > 0 ||
    parseFloat(position.positionData.feeY) > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* PnL Card */}
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
        <CardContent className="p-5">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-[0.18em]">
                  Position PnL
                </p>
                <button
                  onClick={(e) => { e.preventDefault(); toggleCurrency(); }}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
                  title={`Switch to ${currency === "USD" ? "SOL" : "USD"}`}
                >
                  {currency === "USD" ? "$ USD" : "◎ SOL"}
                </button>
              </div>
              <p className={`text-2xl font-bold ${pnlClass}`}>
                {currency === "USD"
                  ? formatValue(position.pnlUsd)
                  : solPrice
                    ? (Number(position.pnlUsd) >= 0 ? "+" : "") + "◎" + Math.abs(Number(position.pnlUsd) / solPrice).toFixed(4)
                    : "—"
                }
              </p>
              <p className={`text-sm font-semibold ${pnlClass}`}>
                {formatPercent(position.pnlPercent)}
              </p>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Fees Card */}
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
        <CardContent className="p-5">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.18em] mb-3">
                Unclaimed Fees
              </p>
              {hasFees ? (
                <div className="space-y-3">
                  {parseFloat(position.positionData.feeX) > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TokenLogo
                          src={position.tokenX.logoURI}
                          symbol={position.tokenX.symbol}
                          className="w-4 h-4 text-xs"
                          backgroundColor="#8b5cf6"
                        />
                        <span className="text-sm text-emerald-400">
                          {position.tokenX.symbol}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-emerald-400">
                        {formatCompactDecimal(position.positionData.feeX)}
                      </span>
                    </div>
                  )}
                  {parseFloat(position.positionData.feeY) > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TokenLogo
                          src={position.tokenY.logoURI}
                          symbol={position.tokenY.symbol}
                          className="w-4 h-4 text-xs"
                          backgroundColor="#14b8a6"
                        />
                        <span className="text-sm text-emerald-400">
                          {position.tokenY.symbol}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-emerald-400">
                        {formatCompactDecimal(position.positionData.feeY)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No unclaimed fees
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balances Card */}
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
        <CardContent className="p-5">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.18em] mb-3">
                Token Balances
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TokenLogo
                      src={position.tokenX.logoURI}
                      symbol={position.tokenX.symbol}
                      className="w-5 h-5 text-xs"
                      backgroundColor="#8b5cf6"
                    />
                    <span className="text-sm font-medium">{position.tokenX.symbol}</span>
                  </div>
                  <span className="font-mono font-semibold text-sm">
                    {formatCompactDecimal(position.positionData.totalXAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TokenLogo
                      src={position.tokenY.logoURI}
                      symbol={position.tokenY.symbol}
                      className="w-5 h-5 text-xs"
                      backgroundColor="#14b8a6"
                    />
                    <span className="text-sm font-medium">{position.tokenY.symbol}</span>
                  </div>
                  <span className="font-mono font-semibold text-sm">
                    {formatCompactDecimal(position.positionData.totalYAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}