/**
 * Pool scoring and ranking engine.
 *
 * Scores pools on a 0-100 scale using a weighted composite of:
 *   - 24h volume (30%) — logarithmic scaling, min threshold $10k
 *   - APR (25%) — direct scaling, capped at 500%
 *   - TVL (20%) — sweet-spot bell curve (penalize too low & too high)
 *   - Fee rate (15%) — higher = more fee income
 *   - Bin step (10%) — smaller = tighter spreads (inverted)
 *
 * Bonus modifiers:
 *   +5 if pool has farm rewards (has_farm)
 *   +5 if both tokens are verified (is_verified)
 */

import type { MeteoraPool, ScoredPool, ScoreBreakdown, PoolFilters, PoolSort } from "@/lib/types/pool";
import { DEFAULT_MIN_TVL, DEFAULT_MIN_VOLUME_24H, DEFAULT_MAX_BIN_STEP } from "@/lib/constants";

// ---------- Scoring weights ----------
const WEIGHTS = {
  volume: 0.30,
  apr: 0.25,
  tvl: 0.20,
  feeRate: 0.15,
  binStep: 0.10,
} as const;

// ---------- Individual dimension scorers (0-100 each) ----------

/** Logarithmic volume score: min threshold $10k, saturates around $10M */
function scoreVolume(volume24h: number): number {
  if (volume24h < DEFAULT_MIN_VOLUME_24H) return 0;
  // log scale: $10k → ~23, $100k → ~46, $1M → ~69, $10M → ~92, $100M → 100
  const score = (Math.log10(volume24h) - 4) * 25; // log10(10000) = 4
  return Math.min(100, Math.max(0, score));
}

/** APR score: direct scaling, capped at 500% */
function scoreApr(apr: number): number {
  if (apr <= 0) return 0;
  // 0% → 0, 100% → 20, 200% → 40, 500% → 100
  return Math.min(100, (apr / 500) * 100);
}

/** TVL score: bell curve — sweet spot around $100k-$1M */
function scoreTvl(tvl: number): number {
  if (tvl < DEFAULT_MIN_TVL) return 0;
  // Peak at $500k TVL, penalize very low and very high
  // Using a log-normal-ish curve
  const logTvl = Math.log10(tvl);
  // Peak at log10(500000) ≈ 5.7
  const peak = 5.7;
  const spread = 1.5;
  const rawScore = 100 * Math.exp(-0.5 * Math.pow((logTvl - peak) / spread, 2));
  return Math.min(100, Math.max(0, rawScore));
}

/** Fee rate score: higher = more fee income per swap */
function scoreFeeRate(baseFeePct: number): number {
  if (baseFeePct <= 0) return 0;
  // 0% → 0, 0.5% → 50, 1% → 100
  return Math.min(100, (baseFeePct / 1) * 100);
}

/** Bin step score: smaller = tighter spreads (inverted) */
function scoreBinStep(binStep: number): number {
  if (binStep <= 0) return 0;
  // 1 → 100, 10 → 90, 50 → 50, 100 → 0
  return Math.min(100, Math.max(0, 100 - binStep));
}

// ---------- Composite scoring ----------

/**
 * Score a single pool on a 0-100 scale.
 * Returns the pool with score and breakdown attached.
 */
export function scorePool(pool: MeteoraPool): ScoredPool {
  const volume24h = pool.volume?.["24h"] ?? 0;
  const apr = pool.apr ?? 0;
  const tvl = pool.tvl ?? 0;
  const baseFeePct = pool.pool_config?.base_fee_pct ?? 0;
  const binStep = pool.pool_config?.bin_step ?? 0;

  const volumeScore = scoreVolume(volume24h);
  const aprScore = scoreApr(apr);
  const tvlScore = scoreTvl(tvl);
  const feeRateScore = scoreFeeRate(baseFeePct);
  const binStepScore = scoreBinStep(binStep);

  // Weighted composite
  const composite =
    volumeScore * WEIGHTS.volume +
    aprScore * WEIGHTS.apr +
    tvlScore * WEIGHTS.tvl +
    feeRateScore * WEIGHTS.feeRate +
    binStepScore * WEIGHTS.binStep;

  // Bonus modifiers
  let bonus = 0;
  if (pool.has_farm) bonus += 5;
  if (pool.token_x?.is_verified && pool.token_y?.is_verified) bonus += 5;

  const score = Math.min(100, Math.max(0, composite + bonus));

  const scoreBreakdown: ScoreBreakdown = {
    volume: Math.round(volumeScore),
    apr: Math.round(aprScore),
    tvl: Math.round(tvlScore),
    feeRate: Math.round(feeRateScore),
    binStep: Math.round(binStepScore),
    bonus,
  };

  return {
    ...pool,
    score: Math.round(score * 10) / 10, // one decimal
    scoreBreakdown,
  };
}

// ---------- Filtering & ranking ----------

/**
 * Apply client-side filters to a list of pools.
 * Note: Most filtering should be done server-side via the API's
 * filter_by param for efficiency. This is for additional client-side filters.
 */
export function filterPools(
  pools: MeteoraPool[],
  filters: PoolFilters
): MeteoraPool[] {
  let result = pools;

  if (filters.minTvl !== null && filters.minTvl !== undefined) {
    result = result.filter((p) => p.tvl >= filters.minTvl!);
  }

  if (filters.minVolume24h !== null && filters.minVolume24h !== undefined) {
    result = result.filter(
      (p) => (p.volume?.["24h"] ?? 0) >= filters.minVolume24h!
    );
  }

  if (filters.maxBinStep !== null && filters.maxBinStep !== undefined) {
    result = result.filter(
      (p) => p.pool_config.bin_step <= filters.maxBinStep!
    );
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.token_x?.symbol?.toLowerCase().includes(q) ||
        p.token_y?.symbol?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.token_x?.address?.toLowerCase().includes(q) ||
        p.token_y?.address?.toLowerCase().includes(q)
    );
  }

  return result;
}

/**
 * Score, filter, and sort pools for display.
 * Returns scored pools sorted by the specified sort field.
 */
export function rankPools(
  pools: MeteoraPool[],
  filters: PoolFilters,
  sort: PoolSort
): ScoredPool[] {
  // Apply client-side filters
  const filtered = filterPools(pools, filters);

  // Score all pools
  const scored = filtered.map(scorePool);

  // Sort
  const sorted = [...scored].sort((a, b) => {
    let comparison = 0;

    switch (sort.field) {
      case "score":
        comparison = a.score - b.score;
        break;
      case "volume_24h":
        comparison = (a.volume?.["24h"] ?? 0) - (b.volume?.["24h"] ?? 0);
        break;
      case "tvl":
        comparison = a.tvl - b.tvl;
        break;
      case "apr":
        comparison = a.apr - b.apr;
        break;
      case "fee_pct":
        comparison =
          (a.pool_config?.base_fee_pct ?? 0) -
          (b.pool_config?.base_fee_pct ?? 0);
        break;
      case "fee_tvl_ratio_24h":
        comparison =
          (a.fee_tvl_ratio?.["24h"] ?? 0) -
          (b.fee_tvl_ratio?.["24h"] ?? 0);
        break;
      case "bin_step":
        comparison =
          (a.pool_config?.bin_step ?? 0) - (b.pool_config?.bin_step ?? 0);
        break;
    }

    return sort.direction === "desc" ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Build the API `sort_by` parameter from a PoolSort object.
 * Maps client-side sort fields to API field names.
 */
export function sortToApiParam(sort: PoolSort): string {
  const fieldMap: Record<string, string> = {
    volume_24h: "volume_24h",
    tvl: "tvl",
    apr: "apr",
    fee_pct: "fee_pct",
    fee_tvl_ratio_24h: "fee_tvl_ratio_24h",
    bin_step: "bin_step",
    score: "volume_24h", // score is client-side, default to volume for API
  };

  const apiField = fieldMap[sort.field] ?? "volume_24h";
  return `${apiField}:${sort.direction}`;
}

/**
 * Build the API `filter_by` parameter from PoolFilters.
 * Combines client filter state with mandatory blacklist exclusion.
 */
export function filtersToApiParam(filters: PoolFilters): string {
  const conditions: string[] = ["is_blacklisted=false"];

  if (filters.minTvl !== null && filters.minTvl !== undefined) {
    conditions.push(`tvl>=${filters.minTvl}`);
  }

  if (filters.minVolume24h !== null && filters.minVolume24h !== undefined) {
    conditions.push(`volume_24h>=${filters.minVolume24h}`);
  }

  return conditions.join(" && ");
}