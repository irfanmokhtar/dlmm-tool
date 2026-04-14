import { PublicKey } from "@solana/web3.js";

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.ankr.com/solana";

// Popular DLMM pool addresses on mainnet
export const KNOWN_POOLS: { address: string; name: string; tokenX: string; tokenY: string }[] = [
  {
    address: "FoSDw2L5DmTuQTFe55rBvDg6C7Gs2yp4GpZT4QRNWkWf",
    name: "SOL-USDC",
    tokenX: "SOL",
    tokenY: "USDC",
  },
  {
    address: "DhMqep5JuTrm5mLRFEk4e1VFKSSw2Qf2rVHmN3G5sXRD",
    name: "SOL-USDT",
    tokenX: "SOL",
    tokenY: "USDT",
  },
];

// Meteora DLMM API (legacy)
export const DLMM_API_BASE = "https://dlmm-api.meteora.ag";

// Meteora Data API (new — pools, token metadata, OHLCV, etc.)
export const DLMM_DATA_API_BASE = "https://dlmm.datapi.meteora.ag";

// Pool screening defaults
export const DEFAULT_MIN_TVL = 1_000;
export const DEFAULT_MIN_VOLUME = 10_000;
export const DEFAULT_MAX_BIN_STEP = 100;
export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_SORT_BY = "volume_24h:desc";

// Meteora Pool Discovery API (screening — richer data, server-side filters)
export const POOL_DISCOVERY_API_BASE = "https://pool-discovery-api.datapi.meteora.ag";

// Jupiter Data API (token audit, holders, fees)
export const JUPITER_DATA_API_BASE = "https://datapi.jup.ag/v1";

// Token screening defaults (Meridian-style)
export const DEFAULT_MIN_ORGANIC_SCORE = 60;
export const DEFAULT_MIN_HOLDERS = 100;
export const DEFAULT_MIN_FEE_TVL_RATIO = 0.01;
export const DEFAULT_MIN_FEE_ACTIVE_TVL_RATIO = 0.05;
export const DEFAULT_MIN_MARKET_CAP = 100_000;
export const DEFAULT_MAX_MARKET_CAP = 10_000_000;
export const DEFAULT_VOLUME_WINDOW: import("./types/pool").TimeWindow = "24h";
export const DEFAULT_POOL_SORT_BY: import("./types/pool").PoolSortField = "score";
export const DEFAULT_CATEGORY = "trending";

// Default pool filters (Meridian-style screening)
export const DEFAULT_FILTERS: import("./types/pool").PoolFilters = {
  query: "",
  minTvl: DEFAULT_MIN_TVL,
  minVolume: DEFAULT_MIN_VOLUME,
  minOrganicScore: DEFAULT_MIN_ORGANIC_SCORE,
  minHolders: DEFAULT_MIN_HOLDERS,
  maxBinStep: DEFAULT_MAX_BIN_STEP,
  minFeeTvlRatio: DEFAULT_MIN_FEE_TVL_RATIO,
  minMarketCap: DEFAULT_MIN_MARKET_CAP,
  maxMarketCap: DEFAULT_MAX_MARKET_CAP,
  volumeWindow: DEFAULT_VOLUME_WINDOW,
  sortBy: DEFAULT_POOL_SORT_BY,
  category: DEFAULT_CATEGORY,
};

// Token metadata for display
export const TOKEN_ICONS: Record<string, string> = {
  SOL: "◎",
  USDC: "$",
  USDT: "₮",
  JUP: "♃",
  JTO: "⬡",
  BONK: "🐕",
};

export const TOKEN_COLORS: Record<string, string> = {
  SOL: "#9945FF",
  USDC: "#2775CA",
  USDT: "#26A17B",
  JUP: "#FF7043",
  JTO: "#E040FB",
  BONK: "#F9A825",
};

// DLMM Program ID
export const DLMM_PROGRAM_ID = new PublicKey(
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"
);
