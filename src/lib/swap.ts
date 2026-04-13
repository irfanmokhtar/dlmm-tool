/**
 * Swap utilities for closing positions and swapping tokens to the quote token.
 *
 * Two paths:
 * 1. **Meteora Zap SDK** (`zapOutThroughDlmm`) — atomic close+swap in one transaction (primary)
 * 2. **Jupiter Swap API v2** (`/order` + `/execute`) — two-step: close first, then swap (fallback)
 *
 * The orchestrator `swapAfterClose()` tries Zap first, falls back to Jupiter.
 */

import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Zap, getJupiterQuote, getJupiterSwapInstruction, getTokenProgramFromMint } from "@meteora-ag/zap-sdk";
import BN from "bn.js";
import { logger } from "./logger";
import { SOL_MINT, SwapConfig, SwapResult, DEFAULT_SWAP_CONFIG } from "./types/swap";

// ---------- Constants ----------

const JUPITER_SWAP_API_BASE = "https://api.jup.ag/swap/v2";
const JUPITER_LITE_API_BASE = "https://lite-api.jup.ag";

// ---------- Helper: Resolve output mint ----------

/**
 * Resolve the output mint based on swap config and pool tokens.
 * If config.outputMint is "auto", returns tokenYMint (the quote token).
 * Otherwise returns the specified mint.
 */
export function resolveOutputMint(
  swapConfig: SwapConfig,
  tokenXMint: string,
  tokenYMint: string
): string {
  if (swapConfig.outputMint === "auto") {
    return tokenYMint;
  }
  return swapConfig.outputMint;
}

/**
 * Determine which input mint to swap FROM.
 * If output mint is tokenY, we swap tokenX → tokenY.
 * If output mint is tokenX, we swap tokenY → tokenX.
 * If output mint is neither (e.g., SOL or USDC), we need to swap both tokens.
 * Returns an array of { mint, isNativeSOL } for tokens that need swapping.
 */
export function getTokensToSwap(
  outputMint: string,
  tokenXMint: string,
  tokenYMint: string
): Array<{ mint: string; isNativeSOL: boolean }> {
  const tokens: Array<{ mint: string; isNativeSOL: boolean }> = [];

  // If output is tokenY, only need to swap tokenX
  if (outputMint === tokenYMint) {
    if (tokenXMint !== tokenYMint) {
      tokens.push({ mint: tokenXMint, isNativeSOL: tokenXMint === SOL_MINT });
    }
    return tokens;
  }

  // If output is tokenX, only need to swap tokenY
  if (outputMint === tokenXMint) {
    if (tokenYMint !== tokenXMint) {
      tokens.push({ mint: tokenYMint, isNativeSOL: tokenYMint === SOL_MINT });
    }
    return tokens;
  }

  // Output is neither token — swap both
  if (tokenXMint !== outputMint) {
    tokens.push({ mint: tokenXMint, isNativeSOL: tokenXMint === SOL_MINT });
  }
  if (tokenYMint !== outputMint) {
    tokens.push({ mint: tokenYMint, isNativeSOL: tokenYMint === SOL_MINT });
  }
  return tokens;
}

// ---------- Path 1: Meteora Zap SDK (atomic close+swap) ----------

/**
 * Attempt a zap-out through DLMM using the Meteora Zap SDK.
 * This performs an atomic close+swap in a single transaction.
 *
 * NOTE: The Zap SDK's `zapOutThroughDlmm` swaps the position's tokens
 * to a single output token. It requires the position to still be open
 * (it handles the removal internally).
 *
 * For our use case, since we've already closed the position separately,
 * we use the Jupiter fallback path instead. The Zap path is kept for
 * future use when we want atomic close+swap.
 */
export async function zapOutDlmm(
  connection: Connection,
  keypair: Keypair,
  lbPairAddress: string,
  inputMint: string,
  outputMint: string,
  slippageBps: number = DEFAULT_SWAP_CONFIG.slippageBps,
  jupiterApiKey?: string
): Promise<SwapResult> {
  const inputMintPk = new PublicKey(inputMint);
  const outputMintPk = new PublicKey(outputMint);
  const lbPairPk = new PublicKey(lbPairAddress);

  try {
    logger.info(
      `[ZapOut] Starting DLMM zap-out:\n` +
      `  Pool: ${lbPairAddress}\n` +
      `  Input: ${inputMint}\n` +
      `  Output: ${outputMint}\n` +
      `  Slippage: ${slippageBps}bps`
    );

    // Get token programs
    const inputTokenProgram = await getTokenProgramFromMint(connection, inputMintPk);
    const outputTokenProgram = await getTokenProgramFromMint(connection, outputMintPk);

    // Initialize Zap SDK
    const zapConfig = jupiterApiKey
      ? { jupiterApiUrl: JUPITER_LITE_API_BASE, jupiterApiKey }
      : undefined;
    const zap = new Zap(connection, zapConfig);

    // Get Jupiter quote for the swap portion
    // We use a large amount as maxSwapAmount since we want to swap 100%
    const maxSwapAmount = new BN("18446744073709551615"); // u64 max — we don't know the exact amount yet

    const quoteResponse = await getJupiterQuote(
      inputMintPk,
      outputMintPk,
      maxSwapAmount,
      40, // maxAccounts
      slippageBps,
      true, // dynamicSlippage
      false, // onlyDirectRoutes
      false, // restrictIntermediateTokens
      zapConfig
    );

    if (!quoteResponse) {
      throw new Error("Failed to get Jupiter quote for zap-out");
    }

    const swapInstructionResponse = await getJupiterSwapInstruction(
      keypair.publicKey,
      quoteResponse,
      zapConfig
    );

    // Build the zap-out transaction
    const zapOutTx = await zap.zapOutThroughJupiter({
      user: keypair.publicKey,
      inputMint: inputMintPk,
      outputMint: outputMintPk,
      inputTokenProgram,
      outputTokenProgram,
      jupiterSwapResponse: swapInstructionResponse,
      maxSwapAmount: maxSwapAmount,
      percentageToZapOut: 100,
    });

    // Sign and send
    zapOutTx.feePayer = keypair.publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    zapOutTx.recentBlockhash = blockhash;
    zapOutTx.sign(keypair);

    const signature = await connection.sendRawTransaction(zapOutTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    logger.info(`[ZapOut] ✅ Zap-out successful: https://solscan.io/tx/${signature}`);

    return {
      success: true,
      signatures: [signature],
      outAmount: quoteResponse.outAmount,
      inputMint,
      outputMint,
      method: "zap",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn(`[ZapOut] ⚠️ Zap-out failed, will try Jupiter fallback: ${errorMsg}`);
    return {
      success: false,
      inputMint,
      outputMint,
      method: "zap",
      error: errorMsg,
    };
  }
}

// ---------- Path 2: Jupiter Swap API v2 (fallback) ----------

/**
 * Swap tokens using Jupiter Swap API v2 (/order + /execute).
 * This is the fallback path when Zap fails or when the position is already closed.
 *
 * Flow:
 * 1. GET /order — get quote and assembled transaction
 * 2. Sign the transaction
 * 3. POST /execute — execute with managed landing
 */
export async function jupiterSwap(
  connection: Connection,
  keypair: Keypair,
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = DEFAULT_SWAP_CONFIG.slippageBps,
  jupiterApiKey?: string
): Promise<SwapResult> {
  const apiKey = jupiterApiKey || process.env.JUPITER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      inputMint,
      outputMint,
      method: "jupiter",
      error: "JUPITER_API_KEY not configured",
    };
  }

  try {
    logger.info(
      `[JupiterSwap] Starting swap:\n` +
      `  Input: ${amount} of ${inputMint}\n` +
      `  Output: ${outputMint}\n` +
      `  Taker: ${keypair.publicKey.toBase58()}\n` +
      `  Slippage: ${slippageBps}bps`
    );

    // Step 1: Get order (quote + assembled transaction)
    const orderParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      taker: keypair.publicKey.toBase58(),
    });

    const orderResponse = await fetch(`${JUPITER_SWAP_API_BASE}/order?${orderParams.toString()}`, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      throw new Error(`Jupiter /order failed (${orderResponse.status}): ${errorText}`);
    }

    const order = await orderResponse.json();

    if (!order.transaction) {
      throw new Error(`No transaction in Jupiter order response: ${JSON.stringify(order)}`);
    }

    // Step 2: Sign the transaction
    // Jupiter v2 /order returns a versioned transaction (v0)
    const transactionBuffer = Buffer.from(order.transaction, "base64");
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    // Sign the versioned transaction
    transaction.sign([keypair]);

    const signedTxBase64 = Buffer.from(transaction.serialize()).toString("base64");

    // Step 3: Execute the signed transaction
    const executeResponse = await fetch(`${JUPITER_SWAP_API_BASE}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        signedTransaction: signedTxBase64,
        requestId: order.requestId,
      }),
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      throw new Error(`Jupiter /execute failed (${executeResponse.status}): ${errorText}`);
    }

    const result = await executeResponse.json();

    if (result.status === "Success") {
      logger.info(
        `[JupiterSwap] ✅ Swap successful:\n` +
        `  Signature: https://solscan.io/tx/${result.signature}\n` +
        `  Input amount: ${result.inputAmountResult || amount}\n` +
        `  Output amount: ${result.outputAmountResult || "unknown"}`
      );

      return {
        success: true,
        signatures: [result.signature],
        outAmount: result.outputAmountResult || order.outAmount,
        inputMint,
        outputMint,
        method: "jupiter",
      };
    } else {
      throw new Error(
        `Jupiter swap failed: status=${result.status}, code=${result.code}, signature=${result.signature || "none"}`
      );
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[JupiterSwap] ❌ Swap failed: ${errorMsg}`);
    return {
      success: false,
      inputMint,
      outputMint,
      method: "jupiter",
      error: errorMsg,
    };
  }
}

// ---------- Token balance helper ----------

/**
 * Get the token balance for a wallet's ATA for a given mint.
 * Returns the raw amount (in smallest unit) as a string, or "0" if no ATA exists.
 */
export async function getTokenBalance(
  connection: Connection,
  walletAddress: PublicKey,
  mintAddress: string
): Promise<string> {
  try {
    // For native SOL, get SOL balance
    if (mintAddress === SOL_MINT) {
      const balance = await connection.getBalance(walletAddress);
      // Subtract a small amount for rent/fees
      return Math.max(0, balance - 5000).toString();
    }

    // For SPL tokens, find the ATA and get its balance
    const { getAssociatedTokenAddress } = await import("@solana/spl-token");
    const mintPk = new PublicKey(mintAddress);
    const ata = await getAssociatedTokenAddress(mintPk, walletAddress);

    const balance = await connection.getTokenAccountBalance(ata);
    return balance.value.amount;
  } catch (err) {
    // ATA doesn't exist or other error — balance is 0
    logger.warn(`[getTokenBalance] Could not get balance for ${mintAddress}: ${err instanceof Error ? err.message : String(err)}`);
    return "0";
  }
}

// ---------- Orchestrator: Swap after close ----------

/**
 * Swap tokens after closing a position.
 *
 * This is called AFTER the position has been successfully closed.
 * It determines which tokens need to be swapped and swaps them to the target output mint.
 *
 * Strategy:
 * 1. If output mint is tokenY (auto), swap tokenX → tokenY via Jupiter
 * 2. If output mint is something else (SOL, USDC), swap both tokenX and tokenY → output mint via Jupiter
 * 3. Skip swaps for dust amounts (< $0.01 estimated value)
 *
 * Note: We use Jupiter Swap API v2 as the primary path for post-close swaps
 * because the position is already closed at this point. The Zap SDK path
 * (zapOutThroughDlmm) is for atomic close+swap and would be used in a
 * future enhancement.
 */
export async function swapAfterClose(
  connection: Connection,
  keypair: Keypair,
  tokenXMint: string,
  tokenYMint: string,
  tokenXDecimals: number,
  tokenYDecimals: number,
  swapConfig: SwapConfig,
  jupiterApiKey?: string
): Promise<SwapResult[]> {
  const outputMint = resolveOutputMint(swapConfig, tokenXMint, tokenYMint);
  const tokensToSwap = getTokensToSwap(outputMint, tokenXMint, tokenYMint);

  if (tokensToSwap.length === 0) {
    logger.info("[SwapAfterClose] No tokens to swap — output mint matches both tokens");
    return [];
  }

  // Wait a moment for token balances to update after the close
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const results: SwapResult[] = [];

  for (const token of tokensToSwap) {
    // Get current balance of this token
    const balance = await getTokenBalance(connection, keypair.publicKey, token.mint);

    if (balance === "0" || BigInt(balance) === BigInt(0)) {
      logger.info(`[SwapAfterClose] Skipping ${token.mint} — balance is 0`);
      results.push({
        success: true,
        inputMint: token.mint,
        outputMint,
        method: "skipped",
        outAmount: "0",
      });
      continue;
    }

    // Skip dust amounts (less than ~$0.01 worth)
    // For SOL, check if balance < 0.0001 SOL (roughly $0.01 at $100/SOL)
    // For SPL tokens, we can't easily estimate USD value here, so we check
    // if the raw amount is very small (less than 1 unit in smallest denomination)
    const balanceBN = BigInt(balance);
    const decimals = token.mint === tokenXMint ? tokenXDecimals : tokenYDecimals;
    const humanAmount = Number(balanceBN) / Math.pow(10, decimals);

    // Skip if less than 0.001 units (likely dust)
    if (humanAmount < 0.001) {
      logger.info(`[SwapAfterClose] Skipping ${token.mint} — dust amount: ${humanAmount}`);
      results.push({
        success: true,
        inputMint: token.mint,
        outputMint,
        method: "skipped",
        outAmount: "0",
      });
      continue;
    }

    logger.info(
      `[SwapAfterClose] Swapping ${humanAmount} units of ${token.mint} → ${outputMint}`
    );

    // Use Jupiter Swap API v2 for post-close swaps
    const result = await jupiterSwap(
      connection,
      keypair,
      token.mint,
      outputMint,
      balance,
      swapConfig.slippageBps,
      jupiterApiKey
    );

    results.push(result);
  }

  return results;
}