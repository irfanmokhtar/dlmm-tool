"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MeteoraPool, MeteoraPoolResponse, ScoredPool, PoolFilters } from "@/lib/types/pool";
import { DEFAULT_FILTERS, DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { rankPools, filtersToApiParam, sortToApiParam } from "@/lib/screener";

// ─── Global Fees Enrichment ──────────────────────────────────────

async function enrichGlobalFees(
  poolData: MeteoraPool[],
  scored: ScoredPool[],
  setPools: (pools: ScoredPool[]) => void,
) {
  // Collect unique base token mints
  const mints = [...new Set(poolData.map((p) => p.token_x.address).filter(Boolean))];
  if (mints.length === 0) return;

  try {
    const res = await fetch(`/api/token-info?mints=${mints.join(",")}`);
    if (!res.ok) return;

    const feeData: { mint: string; global_fees_sol: number | null }[] = await res.json();
    const feeMap = new Map(feeData.map((d) => [d.mint, d.global_fees_sol]));

    // Merge global_fees_sol into scored pools
    const enriched = scored.map((pool) => ({
      ...pool,
      token_x: {
        ...pool.token_x,
        global_fees_sol: feeMap.get(pool.token_x.address) ?? pool.token_x.global_fees_sol ?? null,
      },
    }));

    setPools(enriched);
  } catch (err) {
    // Non-critical — global fees are optional enrichment
    console.warn("[usePoolScreener] Global fees enrichment failed:", err);
  }
}

const DEFAULT_REFRESH_INTERVAL = 10 * 60_000; // 10 minutes

const REFRESH_OPTIONS = [
  { label: "1m", value: 60_000 },
  { label: "2m", value: 120_000 },
  { label: "5m", value: 300_000 },
  { label: "10m", value: 600_000 },
  { label: "15m", value: 900_000 },
  { label: "30m", value: 1_800_000 },
  { label: "Off", value: 0 },
];

interface UsePoolScreenerReturn {
  pools: ScoredPool[];
  rawPools: MeteoraPool[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  filters: PoolFilters;
  setFilters: (filters: PoolFilters) => void;
  updateFilter: <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => void;
  refetch: () => void;
  refreshInterval: number;
  setRefreshInterval: (ms: number) => void;
  refreshOptions: typeof REFRESH_OPTIONS;
}

export function usePoolScreener(): UsePoolScreenerReturn {
  const [rawPools, setRawPools] = useState<MeteoraPool[]>([]);
  const [pools, setPools] = useState<ScoredPool[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filterBy = filtersToApiParam(filters);
      const sortBy = sortToApiParam(filters.sortBy);

      const params = new URLSearchParams({
        page_size: String(DEFAULT_PAGE_SIZE),
        page: "1",
        timeframe: filters.volumeWindow,
        category: filters.category,
        sort_by: sortBy,
        filter_by: filterBy,
      });

      if (filters.query) params.set("query", filters.query);

      const url = `/api/pools/discover?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data: MeteoraPoolResponse = await response.json();
      const poolData = data.data ?? [];

      setRawPools(poolData);
      setTotalCount(data.total ?? poolData.length);

      const scored = rankPools(poolData, filters);
      setPools(scored);

      // Enrich with global fees from Jupiter Data API (non-blocking)
      enrichGlobalFees(poolData, scored, setPools);
    } catch (err) {
      console.error("[usePoolScreener] Failed to fetch pools:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch pools");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced fetch when filters change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPools(), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, refreshKey, fetchPools]);

  // Auto-refresh at configured interval
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(() => setRefreshKey((k) => k + 1), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const updateFilter = useCallback(
    <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { pools, rawPools, totalCount, loading, error, filters, setFilters, updateFilter, refetch, refreshInterval, setRefreshInterval, refreshOptions: REFRESH_OPTIONS };
}