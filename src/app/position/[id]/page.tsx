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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <span className="text-xl font-bold text-white">
              {position.tokenX.symbol.slice(0, 1)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {position.poolName}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              {position.publicKey.toBase58()}
            </p>
          </div>
        </div>
        <PositionHealth score={health.score} status={health.status} />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Price */}
        <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Active Price</p>
            <p className="text-2xl font-mono font-bold bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
              {parseFloat(position.activeBinPrice).toFixed(6)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {position.tokenY.symbol} per {position.tokenX.symbol}
            </p>
          </CardContent>
        </Card>

        {/* Token Balances */}
        <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">Token Balances</p>
            <div className="flex justify-between items-center">
              <Badge
                variant="outline"
                className="bg-violet-500/10 text-violet-400 border-violet-500/20"
              >
                {position.tokenX.symbol}
              </Badge>
              <span className="font-mono font-semibold text-sm">
                {parseFloat(position.positionData.totalXAmount).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 4 }
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge
                variant="outline"
                className="bg-teal-500/10 text-teal-400 border-teal-500/20"
              >
                {position.tokenY.symbol}
              </Badge>
              <span className="font-mono font-semibold text-sm">
                {parseFloat(position.positionData.totalYAmount).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 2 }
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Bin Range */}
        <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">Bin Range</p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Lower</span>
              <span className="font-mono font-semibold text-sm">
                {position.positionData.lowerBinId}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Upper</span>
              <span className="font-mono font-semibold text-sm">
                {position.positionData.upperBinId}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Active</span>
              <span className="font-mono font-semibold text-sm text-teal-400">
                {position.activeBinId}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bin Distribution Chart */}
      <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Bin Distribution
          </h3>
          <BinChart
            bins={position.positionData.positionBinData}
            activeBinId={position.activeBinId}
            tokenXSymbol={position.tokenX.symbol}
            tokenYSymbol={position.tokenY.symbol}
          />
        </CardContent>
      </Card>

      {/* Fees & Actions */}
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
                    <span className="text-sm text-emerald-400">
                      {position.tokenX.symbol} Fees
                    </span>
                    <span className="font-mono text-sm font-semibold text-emerald-400">
                      {parseFloat(position.positionData.feeX).toFixed(6)}
                    </span>
                  </div>
                )}
                {parseFloat(position.positionData.feeY) > 0 && (
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <span className="text-sm text-emerald-400">
                      {position.tokenY.symbol} Fees
                    </span>
                    <span className="font-mono text-sm font-semibold text-emerald-400">
                      {parseFloat(position.positionData.feeY).toFixed(6)}
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
      </div>

      {/* Monitoring Logs */}
      <AutoCloseLogs positionId={positionId} />
    </div>
  );
}
