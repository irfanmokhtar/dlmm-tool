"use client";

import { usePoolScreener } from "@/hooks/usePoolScreener";
import PoolFilters from "@/components/PoolFilters";
import PoolStatsBar from "@/components/PoolStatsBar";
import PoolCard from "@/components/PoolCard";
import { RefreshCw, AlertCircle, Loader2 } from "lucide-react";

export default function PoolsPage() {
  const {
    pools,
    loading,
    error,
    refetch,
    totalPools,
    filters,
    setFilters,
    sort,
    setSort,
    logoMap,
  } = usePoolScreener();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pool Discovery</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Find and score Meteora DLMM pools by TVL, volume, APR, and more
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <PoolFilters
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
      />

      {/* Stats */}
      <PoolStatsBar pools={pools} totalPools={totalPools} loading={loading} />

      {/* Error State */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && pools.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/10" />
                  <div className="w-7 h-7 rounded-full bg-white/10 -ml-2" />
                  <div className="w-24 h-4 bg-white/10 rounded" />
                </div>
                <div className="w-10 h-5 bg-white/10 rounded" />
              </div>
              <div className="flex gap-1">
                <div className="w-14 h-5 bg-white/10 rounded" />
                <div className="w-12 h-5 bg-white/10 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-3 bg-white/10 rounded" />
                <div className="h-3 bg-white/10 rounded" />
                <div className="h-3 bg-white/10 rounded" />
                <div className="h-3 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pool Grid */}
      {!loading || pools.length > 0 ? (
        pools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map((pool) => (
              <PoolCard key={pool.address} pool={pool} logoMap={logoMap} />
            ))}
          </div>
        ) : (
          !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">
                No pools found
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Try adjusting your filters or search query to discover more pools.
              </p>
            </div>
          )
        )
      ) : null}

      {/* Loading overlay when refreshing with existing data */}
      {loading && pools.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Refreshing pools...</span>
        </div>
      )}

    </div>
  );
}