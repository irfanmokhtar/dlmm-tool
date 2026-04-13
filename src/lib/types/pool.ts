/**
 * TypeScript types matching the Meteora Data API response shape.
 * API docs: https://docs.meteora.ag/api-reference/dlmm/pools/pools
 * Base URL: https://dlmm.datapi.meteora.ag
 */

/** Time-windowed metrics (volume, fees, fee_tvl_ratio, etc.) */
export type TimeWindow = "5m" | "30m" | "1h" | "2h" | "4h" | "12h" | "24h";

export type TimeWindowedMetrics = Record<TimeWindow, number>;

/** Token metadata embedded in pool response */
export interface PoolToken {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  price: number;
  is_verified: boolean;
  market_cap: number;
  holders: number;
  total_supply: number;
  freeze_authority_disabled: boolean;
}

/** Pool configuration parameters */
export interface PoolConfig {
  base_fee_pct: number;
  bin_step: number;
  max_fee_pct: number;
  protocol_fee_pct: number;
}

/** Cumulative metrics since pool creation */
export interface CumulativeMetrics {
  protocol_fee: number;
  trade_fee: number;
  volume: number;
}

/**
 * Full pool object from the Meteora Data API.
 * GET /pools → data[]
 * GET /pools/{address}
 */
export interface MeteoraPool {
  address: string;
  name: string;
  tvl: number;
  current_price: number;
  dynamic_fee_pct: number;
  apr: number;
  apy: number;
  farm_apr: number;
  farm_apy: number;
  has_farm: boolean;
  is_blacklisted: boolean;
  created_at: number;
  reserve_x: string;
  reserve_y: string;
  reward_mint_x: string;
  reward_mint_y: string;
  token_x_amount: number;
  token_y_amount: number;
  tags: string[];
  launchpad: string | null;
  pool_config: PoolConfig;
  token_x: PoolToken;
  token_y: PoolToken;
  volume: TimeWindowedMetrics;
  fees: TimeWindowedMetrics;
  protocol_fees: TimeWindowedMetrics;
  fee_tvl_ratio: TimeWindowedMetrics;
  cumulative_metrics: CumulativeMetrics;
}

/** Paginated response from GET /pools */
export interface MeteoraPoolResponse {
  current_page: number;
  page_size: number;
  pages: number;
  total: number;
  data: MeteoraPool[];
}

// ---------- Client-side types ----------

/** Score breakdown for a pool */
export interface ScoreBreakdown {
  volume: number;
  apr: number;
  tvl: number;
  feeRate: number;
  binStep: number;
  bonus: number;
}

/** A pool with its computed score */
export type ScoredPool = MeteoraPool & {
  score: number;
  scoreBreakdown: ScoreBreakdown;
};

/** Client-side filter state */
export interface PoolFilters {
  minTvl: number | null;
  minVolume24h: number | null;
  maxBinStep: number | null;
  search: string;
}

/** Sort options */
export type PoolSortField =
  | "score"
  | "volume_24h"
  | "tvl"
  | "apr"
  | "fee_pct"
  | "fee_tvl_ratio_24h"
  | "bin_step";

export type SortDirection = "asc" | "desc";

export interface PoolSort {
  field: PoolSortField;
  direction: SortDirection;
}