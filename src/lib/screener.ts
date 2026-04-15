import type { MeteoraPool, ScoredPool, ScoreBreakdown, RiskFlags, PoolFilters, PoolSortField, TimeWindow } from "./types/pool";
import {
  DEFAULT_MIN_ORGANIC_SCORE,
  DEFAULT_MIN_HOLDERS,
  DEFAULT_MIN_FEE_TVL_RATIO,
  DEFAULT_MIN_FEE_ACTIVE_TVL_RATIO,
  DEFAULT_MAX_BIN_STEP,
} from "./constants";

// ─── Risk Flags (Meridian-style screening) ────────────────────────

export function getRiskFlags(pool: MeteoraPool): RiskFlags {
  const baseToken = pool.token_x;
  return {
    isBlacklisted: pool.is_blacklisted,
    hasWarnings: (baseToken.warnings?.length ?? 0) > 0,
    lowOrganicScore: (baseToken.organic_score ?? 0) < 60,
    lowHolders: (pool.base_token_holders ?? 0) < 200,
    highTopHolders: (baseToken.top_holders_pct ?? 0) > 60,
    lowFees: (pool.fee_active_tvl_ratio ?? 0) < 0.05,
    hasFreezeAuthority: baseToken.has_freeze_authority ?? false,
    hasMintAuthority: baseToken.has_mint_authority ?? false,
    notVerified: !baseToken.is_verified,
  };
}

// ─── Scoring ─────────────────────────────────────────────────────

function logScale(value: number, base = 10): number {
  return value > 0 ? Math.log(value) / Math.log(base) : 0;
}

export function scorePool(pool: MeteoraPool, volumeWindow: TimeWindow = "24h"): {
  score: number;
  breakdown: ScoreBreakdown;
} {
  const riskFlags = getRiskFlags(pool);

  const volume = pool.volume ?? 0;
  const feeTvlRatio = pool.fee_active_tvl_ratio ?? 0;
  const tvl = pool.active_tvl ?? pool.tvl ?? 0;
  const organicScore = pool.token_x.organic_score ?? 0;
  const holders = pool.base_token_holders ?? 0;

  // Normalize each dimension to 0-1 range
  const volumeNorm = logScale(volume, 1000);
  const feeTvlNorm = Math.min(feeTvlRatio / 0.5, 1);
  const tvlNorm = logScale(tvl, 10000);
  const organicNorm = organicScore / 100;
  const holderNorm = logScale(holders, 100);

  // Weighted composite score (0-100 base)
  const rawScore =
    volumeNorm * 30 +   // Volume: 30%
    feeTvlNorm * 25 +   // Fee/TVL ratio: 25%
    tvlNorm * 20 +      // TVL: 20%
    organicNorm * 15 +  // Organic score: 15%
    holderNorm * 10;    // Holders: 10%

  let score = rawScore;

  // Bonuses
  const bonuses: string[] = [];
  if (pool.has_farm) { score += 5; bonuses.push("farm +5"); }
  if (pool.token_x.is_verified) { score += 5; bonuses.push("verified +5"); }
  if (feeTvlRatio > 0.15) { score += 3; bonuses.push("high fee/TVL +3"); }

  // Penalties
  const penalties: string[] = [];
  if (riskFlags.isBlacklisted) { score -= 10; penalties.push("blacklisted -10"); }
  if (riskFlags.hasWarnings) {
    const wc = pool.token_x.warnings?.length ?? 0;
    const p = Math.min(wc * 5, 15);
    score -= p; penalties.push(`${wc} warning(s) -${p}`);
  }
  if (riskFlags.lowOrganicScore) { score -= 5; penalties.push("low organic -5"); }
  if (riskFlags.highTopHolders) { score -= 5; penalties.push("concentrated holders -5"); }
  if (riskFlags.hasFreezeAuthority) { score -= 3; penalties.push("freeze auth -3"); }
  if (riskFlags.hasMintAuthority) { score -= 3; penalties.push("mint auth -3"); }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    breakdown: {
      volume: volumeNorm,
      feeTvlRatio: feeTvlNorm,
      tvl: tvlNorm,
      organicScore: organicNorm,
      holderScore: holderNorm,
      bonuses,
      penalties,
    },
  };
}

// ─── Client-side Filtering ────────────────────────────────────────

export function filterPools(pools: MeteoraPool[], filters: PoolFilters): MeteoraPool[] {
  return pools.filter((pool) => {
    if (filters.minTvl !== null && (pool.active_tvl ?? pool.tvl ?? 0) < filters.minTvl) return false;
    if (filters.minVolume !== null && (pool.volume ?? 0) < filters.minVolume) return false;
    if (filters.minOrganicScore !== null && (pool.token_x.organic_score ?? 0) < filters.minOrganicScore) return false;
    if (filters.minHolders !== null && (pool.base_token_holders ?? 0) < filters.minHolders) return false;
    if (filters.maxBinStep !== null && (pool.dlmm_params?.bin_step ?? 0) > filters.maxBinStep) return false;
    if (filters.minFeeTvlRatio !== null && (pool.fee_active_tvl_ratio ?? 0) < filters.minFeeTvlRatio) return false;  if (filters.minMarketCap !== null && (pool.token_x.market_cap ?? 0) < filters.minMarketCap) return false;
  if (filters.maxMarketCap !== null && (pool.token_x.market_cap ?? 0) > filters.maxMarketCap) return false;    if (pool.is_blacklisted) return false;
    return true;
  });
}

// ─── Ranking ─────────────────────────────────────────────────────

export function rankPools(pools: MeteoraPool[], filters: PoolFilters): ScoredPool[] {
  const filtered = filterPools(pools, filters);

  const scored = filtered.map((pool) => {
    const { score, breakdown } = scorePool(pool, filters.volumeWindow);
    const riskFlags = getRiskFlags(pool);
    return { ...pool, score, scoreBreakdown: breakdown, riskFlags };
  });

  const sorted = [...scored].sort((a, b) => {
    if (filters.sortBy === "score") return b.score - a.score;

    let cmp = 0;
    switch (filters.sortBy) {
      case "volume_5m":
      case "volume_30m":
      case "volume_1h":
      case "volume_4h":
      case "volume_24h":
        cmp = (b.volume ?? 0) - (a.volume ?? 0);
        break;
      case "fee_tvl_ratio":
        cmp = (b.fee_active_tvl_ratio ?? 0) - (a.fee_active_tvl_ratio ?? 0);
        break;
      case "tvl":
        cmp = ((b.active_tvl ?? b.tvl ?? 0) - (a.active_tvl ?? a.tvl ?? 0));
        break;
      case "organic_score":
        cmp = (b.token_x.organic_score ?? 0) - (a.token_x.organic_score ?? 0);
        break;
    }
    return cmp !== 0 ? cmp : b.score - a.score;
  });

  return sorted;
}

// ─── API Param Builders ───────────────────────────────────────────

export function filtersToApiParam(filters: PoolFilters): string {
  const parts: string[] = ["pool_type=dlmm"];

  // Hard filters (always applied server-side for safety — same as Meridian)
  parts.push("base_token_has_critical_warnings=false");
  parts.push("base_token_has_high_single_ownership=false");
  parts.push("quote_token_organic_score>=60");

  // User-configurable filters
  if (filters.minOrganicScore !== null) parts.push(`base_token_organic_score>=${filters.minOrganicScore}`);
  if (filters.minHolders !== null) parts.push(`base_token_holders>=${filters.minHolders}`);
  if (filters.minTvl !== null) parts.push(`tvl>=${filters.minTvl}`);
  if (filters.minVolume !== null) parts.push(`volume>=${filters.minVolume}`);
  if (filters.maxBinStep !== null) parts.push(`dlmm_bin_step<=${filters.maxBinStep}`);
  if (filters.minFeeTvlRatio !== null) parts.push(`fee_active_tvl_ratio>=${filters.minFeeTvlRatio}`);
  if (filters.minMarketCap !== null) parts.push(`base_token_market_cap>=${filters.minMarketCap}`);
  if (filters.maxMarketCap !== null) parts.push(`base_token_market_cap<=${filters.maxMarketCap}`);

  return parts.join("&&");
}

export function sortToApiParam(sortBy: PoolSortField): string {
  switch (sortBy) {
    case "volume_5m":
    case "volume_30m":
    case "volume_1h":
    case "volume_4h":
    case "volume_24h":
      return "volume:desc";
    case "fee_tvl_ratio":
      return "fee_active_tvl_ratio:desc";
    case "tvl":
      return "tvl:desc";
    case "organic_score":
      return "base_token_organic_score:desc";
    case "score":
    default:
      return "volume:desc";
  }
}

// ─── Formatting Helpers ──────────────────────────────────────────

export function formatUSD(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

export function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 40) return "bg-amber-500/10 border-amber-500/30";
  return "bg-red-500/10 border-red-500/30";
}

export function getOrganicLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "High", color: "text-emerald-400" };
  if (score >= 60) return { label: "Medium", color: "text-amber-400" };
  if (score >= 40) return { label: "Low", color: "text-orange-400" };
  return { label: "Very Low", color: "text-red-400" };
}