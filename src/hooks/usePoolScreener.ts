"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MeteoraPool, MeteoraPoolResponse, ScoredPool, PoolFilters } from "@/lib/types/pool";
import { DEFAULT_FILTERS, DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { rankPools, filtersToApiParam, sortToApiParam } from "@/lib/screener";

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
}

export function usePoolScreener(): UsePoolScreenerReturn {
  const [rawPools, setRawPools] = useState<MeteoraPool[]>([]);
  const [pools, setPools] = useState<ScoredPool[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS);
  const [refreshKey, setRefreshKey] = useState(0);
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

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const updateFilter = useCallback(
    <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { pools, rawPools, totalCount, loading, error, filters, setFilters, updateFilter, refetch };
}