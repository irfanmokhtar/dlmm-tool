"use client";

import React from "react";
import { usePoolScreener } from "@/hooks/usePoolScreener";
import PoolFiltersBar from "@/components/PoolFilters";
import PoolCard from "@/components/PoolCard";
import PoolStatsBar from "@/components/PoolStatsBar";
import SkeletonCard from "@/components/SkeletonCard";

export default function PoolsPage() {
  const { pools, totalCount, loading, error, filters, updateFilter, refetch } = usePoolScreener();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pool Screener</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Discover and screen DLMM pools with risk assessment
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-foreground hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Stats Bar */}
      <PoolStatsBar pools={pools} totalCount={totalCount} loading={loading} />

      {/* Filters */}
      <div className="rounded-xl bg-card border border-white/5 p-4">
        <PoolFiltersBar
          filters={filters}
          onUpdate={updateFilter}
          totalCount={totalCount}
          filteredCount={pools.length}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && pools.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && pools.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <span className="text-2xl">🔍</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No pools found</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Try adjusting your filters — the current criteria may be too restrictive.
            Consider lowering the minimum organic score, holders, or fee/TVL ratio.
          </p>
        </div>
      )}

      {/* Pool Cards Grid */}
      {!loading && pools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map((pool) => (
            <PoolCard key={pool.pool_address} pool={pool} volumeWindow={filters.volumeWindow} />
          ))}
        </div>
      )}

      {/* Loading more indicator */}
      {loading && pools.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
            Updating pools...
          </div>
        </div>
      )}
    </div>
  );
}