"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { calculatePositionHealth, UserPosition } from "@/lib/dlmm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import BinChart from "@/components/BinChart";
import PositionHealth from "@/components/PositionHealth";
import AutoCloseToggle from "@/components/AutoCloseToggle";
import AutoCloseLogs from "@/components/AutoCloseLogs";
import { useAutoCloseContext } from "@/components/AutoCloseMonitor";
import { usePositionData } from "@/components/PositionProvider";
import TokenLogo from "@/components/TokenLogo";
import { formatCompactDecimal } from "@/lib/format";
import RefreshSettings from "@/components/RefreshSettings";


export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { positions, loading, error: dataError } = usePositionData();

  const positionId = params.id as string;
  const autoClose = useAutoCloseContext();

  const position = useMemo(
    () => positions.find((p) => p.publicKey.toBase58() === positionId),
    [positions, positionId]
  );

  const error = dataError || (!loading && !position ? "Position not found" : null);

  if (!publicKey) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please connect your wallet.</p>
      </div>
    );
  }

  if (loading && !position) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-64 h-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 col-span-2" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-rose-400">{error || "Position not found"}</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          ← Back to Dashboard
        </Button>
      </div>
    );
  }

  const health = calculatePositionHealth(
    position.activeBinId,
    position.positionData.lowerBinId,
    position.positionData.upperBinId
  );

  const hasFees =
    parseFloat(position.positionData.feeX) > 0 ||
    parseFloat(position.positionData.feeY) > 0;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/")}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {/* Overlapping pair logo */}
          <div className="relative w-12 h-12 rounded-full">
            <TokenLogo
              src={position.tokenX.logoURI}
              symbol={position.tokenX.symbol}
              className="absolute left-0 w-8 h-8 z-10 text-xs"
              backgroundColor="#8b5cf6"
            />
            <TokenLogo
              src={position.tokenY.logoURI}
              symbol={position.tokenY.symbol}
              className="absolute right-0 w-8 h-8 z-20 text-xs"
              backgroundColor="#14b8a6"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {position.poolName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <a
                href={`https://app.meteora.ag/dlmm/${position.poolAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1"
              >
                Meteora
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <span className="text-muted-foreground/30">•</span>
              <a
                href={`https://gmgn.ai/sol/token/${position.tokenX.mint}_${position.tokenY.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
              >
                GMGN
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <RefreshSettings />
          <PositionHealth score={health.score} status={health.status} />
        </div>
      </div>


      {/* Fees & Token Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fees */}
        <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Unclaimed Fees & Rewards
            </h3>
            {hasFees ? (
              <div className="space-y-3">
                {parseFloat(position.positionData.feeX) > 0 && (
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <TokenLogo
                        src={position.tokenX.logoURI}
                        symbol={position.tokenX.symbol}
                        className="w-4 h-4 text-xs"
                        backgroundColor="#8b5cf6"
                      />
                      <span className="text-sm text-emerald-400">
                        {position.tokenX.symbol} Fees
                      </span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-emerald-400">
                      {formatCompactDecimal(position.positionData.feeX)}
                    </span>
                  </div>
                )}
                {parseFloat(position.positionData.feeY) > 0 && (
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <TokenLogo
                        src={position.tokenY.logoURI}
                        symbol={position.tokenY.symbol}
                        className="w-4 h-4 text-xs"
                        backgroundColor="#14b8a6"
                      />
                      <span className="text-sm text-emerald-400">
                        {position.tokenY.symbol} Fees
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
                No unclaimed fees at this time.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Token Balances */}
        <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">Token Balances</p>
            <div className="flex justify-between items-center">
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
            <div className="flex justify-between items-center">
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
          </CardContent>
        </Card>
      </div>

      {/* Bin Distribution Chart */}
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Bin Distribution
            </h3>
            <div className="text-xs text-muted-foreground flex items-center gap-4">
              <div>
                <span className="text-zinc-500">Active Price:</span>{" "}
                <span className="font-mono text-teal-400">{formatCompactDecimal(position.activeBinPrice)}</span>{" "}
                <span className="text-zinc-500">({position.tokenY.symbol}/{position.tokenX.symbol})</span>
              </div>
              <Separator orientation="vertical" className="h-4 bg-white/10" />
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">Range:</span>
                <span className="font-mono text-xs">
                  <span className="text-violet-400">{position.positionData.lowerBinId}</span>
                  <span className="text-zinc-600 mx-1">→</span>
                  <span className="text-teal-400">{position.positionData.upperBinId}</span>
                </span>
              </div>
            </div>
          </div>
          <BinChart
            bins={position.positionData.positionBinData}
            activeBinId={position.activeBinId}
            tokenXSymbol={position.tokenX.symbol}
            tokenYSymbol={position.tokenY.symbol}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Actions
          </h3>
          <div className="space-y-3">
            {/* Auto-Close Toggle */}
            <AutoCloseToggle
              positionId={positionId}
              poolAddress={position.poolAddress}
              lowerBinId={position.positionData.lowerBinId}
              upperBinId={position.positionData.upperBinId}
              isEnabled={autoClose.isAutoCloseEnabled(positionId)}
              status={autoClose.getStatus(positionId)}
              error={autoClose.getError(positionId)}
              onEnable={autoClose.enableAutoClose}
              onDisable={autoClose.disableAutoClose}
            />

            <Separator className="bg-white/5" />

            <Button
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-500/10"
              disabled={!hasFees}
            >
              Claim All Fees
            </Button>
            <Button
              variant="outline"
              className="w-full border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
            >
              Withdraw All Liquidity
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Actions execute on-chain transactions. You'll be asked to sign
            with your wallet.
          </p>
        </CardContent>
      </Card>

      {/* Monitoring Logs */}
      <AutoCloseLogs positionId={positionId} />
    </div>
  );
}
