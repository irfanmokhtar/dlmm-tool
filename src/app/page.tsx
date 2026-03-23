"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { usePositions } from "@/hooks/usePositions";
import StatsBar from "@/components/StatsBar";
import PositionCard from "@/components/PositionCard";
import SkeletonCard from "@/components/SkeletonCard";
import WalletButton from "@/components/WalletButton";

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const { positions, loading, error, refetch } = usePositions();

  // Not connected — show hero
  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        {/* Background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-lg">
          {/* Logo */}
          <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-2xl shadow-teal-500/30">
            <span className="text-4xl font-bold text-white">M</span>
          </div>

          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            Meteora DLMM
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
              Position Manager
            </span>
          </h1>

          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            Track your concentrated liquidity positions, monitor bin health,
            claim fees, and optimize your LP strategy — all in one place.
          </p>

          <WalletButton />

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-10">
            {[
              "Position Tracking",
              "Bin Visualization",
              "Health Monitoring",
              "Fee Claims",
            ].map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-muted-foreground"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Connected — show dashboard
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your Meteora DLMM positions overview
          </p>
        </div>
        {/* Mobile wallet button */}
        <div className="md:hidden">
          <WalletButton />
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="hidden md:flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span>
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <StatsBar positions={positions} loading={loading} />

      {/* Error State */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Positions Grid */}
      {loading && positions.length === 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            Loading Positions...
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      ) : positions.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            Your Positions{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({positions.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {positions.map((position) => (
              <PositionCard
                key={position.publicKey.toBase58()}
                position={position}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <span className="text-3xl opacity-30">◈</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            No Positions Found
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            You don't have any active DLMM positions on Meteora.
            Visit{" "}
            <a
              href="https://app.meteora.ag/dlmm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 hover:underline"
            >
              app.meteora.ag
            </a>{" "}
            to create one.
          </p>
        </div>
      )}
    </div>
  );
}
