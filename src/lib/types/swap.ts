/**
 * Types for the swap-on-close feature.
 */

/** Result of a swap attempt */
export interface SwapResult {
  /** Whether the swap succeeded */
  success: boolean;
  /** Transaction signature(s) of confirmed swap transactions */
  signatures?: string[];
  /** Expected output amount (in smallest unit) */
  outAmount?: string;
  /** Input mint address */
  inputMint: string;
  /** Output mint address */
  outputMint: string;
  /** Which method was used */
  method: "zap" | "jupiter" | "skipped";
  /** Error message if swap failed */
  error?: string;
}

/** Configuration for swap-on-close */
export interface SwapConfig {
  /** Whether to swap after closing */
  enabled: boolean;
  /** Output mint address. "auto" = use pool's tokenY, or a specific mint address */
  outputMint: "auto" | string;
  /** Slippage tolerance in basis points (200 = 2%) */
  slippageBps: number;
}

/** Combined result of close + swap */
export interface CloseAndSwapResult {
  /** Close result (from closePositionWithRetry) */
  closeSuccess: boolean;
  /** Whether close was partial */
  closePartial: boolean;
  /** Close transaction signatures */
  closeSignatures: string[];
  /** Swap result (undefined if swap was not attempted) */
  swapResult?: SwapResult;
}

/** Default swap configuration */
export const DEFAULT_SWAP_CONFIG: SwapConfig = {
  enabled: true,
  outputMint: "auto",
  slippageBps: 200, // 2%
};

/** Well-known mint addresses */
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT = "Es9vMFrzaCERmJrwFz2Hj8q9z2gNcXkk5sW7a9Z4oWku";

/** Minimum USD value threshold for swap (skip dust) */
export const SWAP_DUST_THRESHOLD_USD = 0.01;