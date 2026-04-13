import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { closePositionWithRetry } from "@/lib/dlmm";
import { swapAfterClose } from "@/lib/swap";
import { logger } from "@/lib/logger";
import type { SwapConfig, SwapResult } from "@/lib/types/swap";
import { DEFAULT_SWAP_CONFIG } from "@/lib/types/swap";
import bs58 from "bs58";

/**
 * POST /api/auto-close
 * 
 * Server-side handler that signs and sends close-position transactions
 * using the private key stored in env. This keeps the key server-only.
 *
 * For positions spanning >70 bins, the Meteora SDK returns multiple transactions.
 * This handler uses atomic sending (one blockhash for all txs, send all, then confirm all)
 * with retry logic for failed chunks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      positionId,
      poolAddress,
      lowerBinId,
      upperBinId,
      closeReason,
      swapConfig: rawSwapConfig,
      tokenXMint,
      tokenYMint,
      tokenXDecimals,
      tokenYDecimals,
    } = body;

    // Validate inputs
    if (!positionId || !poolAddress || lowerBinId == null || upperBinId == null) {
      return NextResponse.json(
        { error: "Missing required fields: positionId, poolAddress, lowerBinId, upperBinId" },
        { status: 400 }
      );
    }

    // Parse swap config (optional — defaults to enabled with auto-detect)
    const swapConfig: SwapConfig = rawSwapConfig
      ? { ...DEFAULT_SWAP_CONFIG, ...rawSwapConfig }
      : { ...DEFAULT_SWAP_CONFIG };

    // Determine if swap should be attempted
    const shouldSwap = swapConfig.enabled && tokenXMint && tokenYMint;

    // Load private key from env (server-only, NOT prefixed with NEXT_PUBLIC_)
    const privateKeyStr = process.env.AUTO_CLOSE_PRIVATE_KEY;
    if (!privateKeyStr) {
      return NextResponse.json(
        { error: "AUTO_CLOSE_PRIVATE_KEY not configured in .env.local" },
        { status: 500 }
      );
    }

    // Load RPC URL
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.ankr.com/solana";

    // Create keypair from private key
    let keypair: Keypair;
    try {
      // Support both base58 and JSON array formats
      if (privateKeyStr.startsWith("[")) {
        const secretKey = Uint8Array.from(JSON.parse(privateKeyStr));
        keypair = Keypair.fromSecretKey(secretKey);
      } else {
        const secretKey = bs58.decode(privateKeyStr);
        keypair = Keypair.fromSecretKey(secretKey);
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid AUTO_CLOSE_PRIVATE_KEY format. Use base58 or JSON array." },
        { status: 500 }
      );
    }

    const connection = new Connection(rpcUrl, "confirmed");

    const binCount = upperBinId - lowerBinId + 1;
    console.info(
      `[Auto-Close] Initiating close:\n` +
      `  Position: ${positionId}\n` +
      `  Pool: ${poolAddress}\n` +
      `  Wallet: ${keypair.publicKey.toBase58()}\n` +
      `  Bin Range: ${lowerBinId} → ${upperBinId} (${binCount} bins)\n` +
      `  Multi-tx expected: ${binCount > 70 ? "YES" : "NO"} (${Math.ceil(binCount / 70)} chunk${Math.ceil(binCount / 70) > 1 ? "s" : ""})\n` +
      `  Reason: ${closeReason || "Manual trigger"}`
    );

    // Use atomic transaction sending with retry logic
    const result = await closePositionWithRetry(
      connection,
      keypair,
      poolAddress,
      new PublicKey(positionId),
      lowerBinId,
      upperBinId
    );

    if (result.success) {
      console.info(
        `[Auto-Close] ✅ Position closed successfully:\n` +
        `  Position: ${positionId}\n` +
        `  Reason: ${closeReason || "Manual trigger"}\n` +
        `  Transactions: ${result.totalChunks}\n` +
        `  Signatures:\n` +
        result.confirmedSignatures.map((s) => `    • ${s} (https://solscan.io/tx/${s})`).join("\n")
      );

      // --- Swap after close ---
      let swapResults: SwapResult[] | undefined;
      if (shouldSwap) {
        console.info(
          `[Auto-Close] 🔄 Starting swap-after-close:\n` +
          `  tokenX: ${tokenXMint}\n` +
          `  tokenY: ${tokenYMint}\n` +
          `  outputMint: ${swapConfig.outputMint}\n` +
          `  slippageBps: ${swapConfig.slippageBps}`
        );
        try {
          swapResults = await swapAfterClose(
            connection,
            keypair,
            tokenXMint,
            tokenYMint,
            tokenXDecimals ?? 9,
            tokenYDecimals ?? 6,
            swapConfig,
            process.env.JUPITER_API_KEY
          );

          const successfulSwaps = swapResults.filter((r) => r.success && r.method !== "skipped");
          const skippedSwaps = swapResults.filter((r) => r.method === "skipped");
          const failedSwaps = swapResults.filter((r) => !r.success);

          if (successfulSwaps.length > 0) {
            console.info(
              `[Auto-Close] ✅ Swap-after-close successful:\n` +
              successfulSwaps.map((r) =>
                `    • ${r.inputMint} → ${r.outputMint} via ${r.method}: ${r.signatures?.map((s) => `https://solscan.io/tx/${s}`).join(", ") || "no sig"}`
              ).join("\n")
            );
          }
          if (skippedSwaps.length > 0) {
            console.info(
              `[Auto-Close] ⏭️ Skipped dust swaps:\n` +
              skippedSwaps.map((r) => `    • ${r.inputMint}: ${r.error || "dust amount"}`).join("\n")
            );
          }
          if (failedSwaps.length > 0) {
            console.warn(
              `[Auto-Close] ⚠️ Some swaps failed (close still succeeded):\n` +
              failedSwaps.map((r) => `    • ${r.inputMint} → ${r.outputMint}: ${r.error}`).join("\n")
            );
          }
        } catch (swapErr) {
          // Swap failure is non-fatal — position is already closed
          console.warn(
            `[Auto-Close] ⚠️ Swap-after-close failed (close still succeeded):`,
            swapErr
          );
          swapResults = [{
            success: false,
            inputMint: tokenXMint,
            outputMint: swapConfig.outputMint === "auto" ? tokenYMint : swapConfig.outputMint,
            method: "jupiter",
            error: swapErr instanceof Error ? swapErr.message : String(swapErr),
          }];
        }
      }

      return NextResponse.json({
        success: true,
        signatures: result.confirmedSignatures,
        totalChunks: result.totalChunks,
        closeReason: closeReason || "Manual trigger",
        message: `Position ${positionId} closed successfully (${result.totalChunks} transaction${result.totalChunks > 1 ? "s" : ""})`,
        swapResults,
      });
    }

    if (result.partialSuccess) {
      console.warn(
        `[Auto-Close] ⚠️ Partial close for ${positionId}:\n` +
        `  Confirmed: ${result.confirmedSignatures.length}/${result.totalChunks} transactions\n` +
        `  Failed chunks: ${result.failedChunks}\n` +
        `  Confirmed signatures:\n` +
        result.confirmedSignatures.map((s) => `    • ${s} (https://solscan.io/tx/${s})`).join("\n") +
        `\n  Error: ${result.error || "Unknown"}`
      );
      return NextResponse.json(
        {
          success: false,
          partialSuccess: true,
          confirmedSignatures: result.confirmedSignatures,
          failedChunks: result.failedChunks,
          totalChunks: result.totalChunks,
          error: result.error || `Partial close: ${result.confirmedSignatures.length} of ${result.totalChunks} transactions confirmed`,
        },
        { status: 207 } // 207 Multi-Status
      );
    }

    // Complete failure
    console.error(
      `[Auto-Close] ❌ Failed to close position ${positionId}:\n` +
      `  Total chunks: ${result.totalChunks}\n` +
      `  Confirmed: ${result.confirmedSignatures.length}\n` +
      `  Error: ${result.error || "Failed to close position after retries"}`
    );
    return NextResponse.json(
      {
        success: false,
        partialSuccess: false,
        confirmedSignatures: result.confirmedSignatures,
        totalChunks: result.totalChunks,
        error: result.error || "Failed to close position after retries",
      },
      { status: 500 }
    );
  } catch (err) {
    console.error(`[Auto-Close] ❌ Unexpected error:`, err);
    logger.error("[Auto-Close] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to close position" },
      { status: 500 }
    );
  }
}
