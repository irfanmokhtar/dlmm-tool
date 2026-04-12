"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { calculatePositionHealth } from "@/lib/dlmm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import BinChart from "@/components/BinChart";
import PositionHealth from "@/components/PositionHealth";
import AutoCloseToggle from "@/components/AutoCloseToggle";
import AutoCloseLogs from "@/components/AutoCloseLogs";
import { useAutoCloseContext } from "@/components/AutoCloseMonitor";
import { usePositionData } from "@/components/PositionProvider";
import TokenLogo from "@/components/TokenLogo";
import PositionOverview from "@/components/PositionOverview";
import { formatCompactDecimal } from "@/lib/format";
import RefreshSettings from "@/components/RefreshSettings";
import { logger } from "@/lib/logger";


export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const { positions, loading, error: dataError } = usePositionData();

  const positionId = params.id as string;
  const autoClose = useAutoCloseContext();

  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const position = useMemo(
    () => positions.find((p) => p.publicKey.toBase58() === positionId),
    [positions, positionId]
  );

  const handleWithdrawAll = async () => {
    if (!position) return;

    setWithdrawing(true);
    setWithdrawError(null);
    setWithdrawSuccess(false);

    const binCount = position.positionData.upperBinId - position.positionData.lowerBinId + 1;
    console.info(
      `[Withdraw] Initiating close position:\n` +
      `  Position: ${position.publicKey.toBase58()}\n` +
      `  Pool: ${position.poolAddress}\n` +
      `  Bin Range: ${position.positionData.lowerBinId} → ${position.positionData.upperBinId} (${binCount} bins)\n` +
      `  Multi-tx expected: ${binCount > 70 ? "YES" : "NO"}\n` +
      `  Sending to /api/auto-close for server-side signing...`
    );

    try {
      const response = await fetch("/api/auto-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: position.publicKey.toBase58(),
          poolAddress: position.poolAddress,
          lowerBinId: position.positionData.lowerBinId,
          upperBinId: position.positionData.upperBinId,
        }),
      });

      const result = await response.json();

      if (!response.ok && !result.partialSuccess) {
        console.error(`[Withdraw] ❌ Close failed: ${result.error}`);
        throw new Error(result.error || "Failed to close position");
      }

      if (result.partialSuccess) {
        console.warn(
          `[Withdraw] ⚠️ Partial close:\n` +
          `  Confirmed: ${result.confirmedSignatures?.length || 0}/${result.totalChunks || "?"} transactions\n` +
          `  Confirmed signatures:\n` +
          (result.confirmedSignatures || []).map((s: string) => `    • ${s} (https://solscan.io/tx/${s})`).join("\n") +
          `\n  Error: ${result.error || "Unknown"}`
        );
        setWithdrawError(
          result.error || `Partial close: ${result.confirmedSignatures?.length || 0} of ${result.totalChunks || "?"} transactions confirmed. Position may need manual retry.`
        );
        setWithdrawing(false);
        return;
      }

      console.info(
        `[Withdraw] ✅ Position closed successfully:\n` +
        `  Transactions: ${result.totalChunks}\n` +
        `  Signatures:\n` +
        (result.signatures || []).map((s: string) => `    • ${s} (https://solscan.io/tx/${s})`).join("\n")
      );
      setWithdrawSuccess(true);

      // Refresh positions after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      console.error("[Withdraw] ❌ Error:", err);
      setWithdrawError(err instanceof Error ? err.message : "Failed to withdraw liquidity");
    } finally {
      setWithdrawing(false);
    }
  };

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

      <PositionOverview position={position} />

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
                <span className="text-zinc-600">({position.positionData.upperBinId - position.positionData.lowerBinId + 1} bins)</span>
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
              onClick={handleWithdrawAll}
              disabled={withdrawing || withdrawSuccess}
            >
              {withdrawing
                ? "Signing Transaction..."
                : withdrawSuccess
                ? "✓ Position Closed — Redirecting..."
                : "Withdraw All Liquidity"}
            </Button>
            {withdrawError && (
              <p className="text-xs text-rose-400 mt-1">{withdrawError}</p>
            )}
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
