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

// Meteora DLMM API
export const DLMM_API_BASE = "https://dlmm-api.meteora.ag";

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
