// ─── Time Window ─────────────────────────────────────────────────
export type TimeWindow = "5m" | "30m" | "1h" | "4h" | "24h";

// ─── Sort ────────────────────────────────────────────────────────
export type PoolSortField =
  | "score"
  | "volume_5m"
  | "volume_30m"
  | "volume_1h"
  | "volume_4h"
  | "volume_24h"
  | "fee_tvl_ratio"
  | "tvl"
  | "organic_score";

// ─── Token Data (from Meteora Pool Discovery API) ────────────────
export interface MeteoraPoolToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  icon?: string;
  is_verified: boolean;
  holders: number;
  freeze_authority_disabled: boolean;
  mint_authority_disabled: boolean;
  has_freeze_authority: boolean;
  has_mint_authority: boolean;
  total_supply: number;
  price: number;
  market_cap: number;
  fdv: number;
  created_at: number;
  tags: string[];
  warnings: { type: string; message: string; severity: string }[];
  organic_score: number;
  organic_score_label: string;
  token_program: string;
  top_holders_pct: number;
  dev_balance_pct: number;
  global_fees_sol: number | null;
  launchpad?: string;
}

// ─── Pool Data (from Meteora Pool Discovery API) ────────────────
export interface MeteoraPool {
  pool_address: string;
  name: string;
  token_x: MeteoraPoolToken;
  token_y: MeteoraPoolToken;
  pool_type: string;
  fee_pct: number;
  pool_created_at: number;
  is_blacklisted: boolean;
  dlmm_params: { bin_step: number };
  base_token_holders: number;
  base_token_holders_change_pct: number;
  base_token_market_cap_change_pct: number;
  tvl: number;
  tvl_change_pct: number;
  active_tvl: number;
  active_tvl_change_pct: number;
  fee_active_tvl_ratio: number;
  fee_active_tvl_ratio_change_pct: number;
  volume_active_tvl_ratio: number;
  volume_tvl_ratio: number;
  volume: number;
  volume_change_pct: number;
  avg_volume: number;
  fee: number;
  fee_change_pct: number;
  avg_fee: number;
  fee_tvl_ratio: number;
  fee_tvl_ratio_change_pct: number;
  swap_count: number;
  swap_count_change_pct: number;
  unique_lps: number;
  unique_traders: number;
  net_deposits: number;
  total_deposits: number;
  total_withdraws: number;
  total_lps: number;
  open_positions: number;
  active_positions: number;
  active_positions_pct: number;
  positions_created: number;
  has_farm: boolean;
  dynamic_fee_pct: number;
  pool_price: number;
  pool_price_change_pct: number;
  max_price: number;
  min_price: number;
  volatility: number;
  correlation: number;
  price_trend: number[];
  apr: number;
  apy: number;
  farm_apr: number;
  farm_apy: number;
  tags: string[];
}

// ─── API Response ────────────────────────────────────────────────
export interface MeteoraPoolResponse {
  total: number;
  pages: number;
  current_page: number;
  page_size: number;
  data: MeteoraPool[];
}

// ─── Filters ─────────────────────────────────────────────────────
export interface PoolFilters {
  query?: string;
  minTvl: number | null;
  minVolume: number | null;
  minOrganicScore: number | null;
  minHolders: number | null;
  maxBinStep: number | null;
  minFeeTvlRatio: number | null;
  minMarketCap: number | null;
  maxMarketCap: number | null;
  volumeWindow: TimeWindow;
  sortBy: PoolSortField;
  category: "trending" | "top" | "new";
}

// ─── Scoring ─────────────────────────────────────────────────────
export interface ScoreBreakdown {
  volume: number;
  feeTvlRatio: number;
  tvl: number;
  organicScore: number;
  holderScore: number;
  bonuses: string[];
  penalties: string[];
}

export interface ScoredPool extends MeteoraPool {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  riskFlags: RiskFlags;
}

// ─── Risk Flags ──────────────────────────────────────────────────
export interface RiskFlags {
  isBlacklisted: boolean;
  hasWarnings: boolean;
  lowOrganicScore: boolean;
  lowHolders: boolean;
  highTopHolders: boolean;
  lowFees: boolean;
  hasFreezeAuthority: boolean;
  hasMintAuthority: boolean;
  notVerified: boolean;
}