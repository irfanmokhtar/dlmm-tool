"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import TokenLogo from "@/components/TokenLogo";
import { formatCompactDecimal } from "@/lib/format";
import { UserPosition } from "@/lib/dlmm";

interface PositionOverviewProps {
  position: UserPosition;
}

function formatUsd(value?: string) {
  if (!value || Number.isNaN(Number(value))) return "—";
  const amount = Number(value);
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatPercent(value?: string) {
  if (!value || Number.isNaN(Number(value))) return "—";
  const amount = Number(value);
  return `${amount > 0 ? "+" : ""}${amount.toFixed(2)}%`;
}

export default function PositionOverview({ position }: PositionOverviewProps) {
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
              <p className="text-xs text-muted-foreground uppercase tracking-[0.18em] mb-1">
                Position PnL
              </p>
              <p className={`text-2xl font-bold ${pnlClass}`}>
                {formatUsd(position.pnlUsd)}
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