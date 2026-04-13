"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type {
  MeteoraPool,
  MeteoraPoolResponse,
  ScoredPool,
  PoolFilters,
  PoolSort,
} from "@/lib/types/pool";
import { rankPools, sortToApiParam, filtersToApiParam } from "@/lib/screener";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { logger } from "@/lib/logger";

const POLL_INTERVAL = 60_000; // 60 seconds
const DEBOUNCE_MS = 300;

interface UsePoolScreenerReturn {
  pools: ScoredPool[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  totalPools: number;
  filters: PoolFilters;
  setFilters: React.Dispatch<React.SetStateAction<PoolFilters>>;
  sort: PoolSort;
  setSort: React.Dispatch<React.SetStateAction<PoolSort>>;
  /** Map of mint address → logo URI, resolved from Jupiter token metadata */
  logoMap: Record<string, string>;
}

const DEFAULT_FILTERS: PoolFilters = {
  minTvl: null,
  minVolume24h: null,
  maxBinStep: null,
  search: "",
};

const DEFAULT_SORT: PoolSort = {
  field: "volume_24h",
  direction: "desc",
};

export function usePoolScreener(): UsePoolScreenerReturn {
  const [rawPools, setRawPools] = useState<MeteoraPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPools, setTotalPools] = useState(0);
  const [logoMap, setLogoMap] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<PoolSort>(DEFAULT_SORT);

  // Debounced search value
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, DEBOUNCE_MS);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters.search]);

  const fetchPools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("page_size", String(DEFAULT_PAGE_SIZE));
      params.set("sort_by", sortToApiParam(sort));
      params.set("filter_by", filtersToApiParam(filters));
      if (debouncedSearch) {
        params.set("query", debouncedSearch);
      }

      const response = await fetch(`/api/pools/discover?${params.toString()}`);

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API error ${response.status}: ${errBody}`);
      }

      const data: MeteoraPoolResponse = await response.json();

      setRawPools(data.data ?? []);
      setTotalPools(data.total ?? 0);

      // Resolve token logos via Jupiter metadata proxy (same as Dashboard)
      resolveLogos(data.data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch pools";
      logger.error("[usePoolScreener]", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sort, filters.minTvl, filters.minVolume24h, filters.maxBinStep, debouncedSearch]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchPools();

    const interval = setInterval(() => {
      fetchPools();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchPools]);

  const refetch = useCallback(() => {
    fetchPools();
  }, [fetchPools]);

  // Resolve token logos from Jupiter metadata proxy
  const resolveLogos = useCallback(async (pools: MeteoraPool[]) => {
    // Collect unique mint addresses that we don't already have logos for
    const mints = new Set<string>();
    for (const pool of pools) {
      if (pool.token_x?.address && !logoMap[pool.token_x.address]) {
        mints.add(pool.token_x.address);
      }
      if (pool.token_y?.address && !logoMap[pool.token_y.address]) {
        mints.add(pool.token_y.address);
      }
    }

    if (mints.size === 0) return;

    try {
      const res = await fetch(`/api/token-metadata?mints=${Array.from(mints).join(",")}`);
      if (res.ok) {
        const tokens = await res.json();
        if (Array.isArray(tokens)) {
          const newLogos: Record<string, string> = {};
          tokens.forEach((t: { id?: string; address?: string; icon?: string; logoURI?: string }) => {
            const mint = t.id || t.address;
            const logo = t.icon || t.logoURI;
            if (mint && logo) {
              newLogos[mint] = logo;
            }
          });
          if (Object.keys(newLogos).length > 0) {
            setLogoMap((prev) => ({ ...prev, ...newLogos }));
          }
        }
      }
    } catch (err) {
      logger.warn("[usePoolScreener] Logo resolution failed:", err);
    }
  }, [logoMap]);

  // Apply client-side scoring and sorting on top of server-side results
  const scoredPools = useMemo(() => {
    // For "score" sort, we need client-side scoring since the API doesn't know about our score
    // For other sorts, the API already sorted, but we still score for display
    const clientFilters: PoolFilters = {
      ...filters,
      search: "", // search is already handled server-side
    };
    return rankPools(rawPools, clientFilters, sort);
  }, [rawPools, filters, sort]);

  return {
    pools: scoredPools,
    loading,
    error,
    refetch,
    totalPools,
    filters,
    setFilters,
    sort,
    setSort,
    logoMap,
  };
}