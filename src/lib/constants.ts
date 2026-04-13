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
export const DEFAULT_MIN_VOLUME_24H = 10_000;
export const DEFAULT_MAX_BIN_STEP = 100;
export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_SORT_BY = "volume_24h:desc";

// Well-known token mint addresses
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT = "Es9vMFrzaCERmJrwFz2Hj8q9z2gNcXkk5sW7a9Z4oWku";

// Default swap slippage in basis points (200 = 2%)
export const DEFAULT_SWAP_SLIPPAGE_BPS = 200;

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
