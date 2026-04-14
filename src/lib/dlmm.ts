import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import BN from "bn.js";
import { DLMM_API_BASE } from "./constants";
import { logger } from "./logger";

// ---------- Cache ----------
const dlmmCache = new Map<string, Promise<DLMM>>();
const CACHE_TTL = 30_000; // 30 seconds
const cacheTimestamps = new Map<string, number>();
const tokenMetadataCache = new Map<string, { symbol: string, logoURI: string }>();

async function getOrCreateDlmmPool(connection: Connection, poolAddress: string): Promise<DLMM> {
  const now = Date.now();
  const cached = dlmmCache.get(poolAddress);
  const timestamp = cacheTimestamps.get(poolAddress) || 0;

  if (cached && (now - timestamp < CACHE_TTL)) {
    return cached;
  }

  const promise = DLMM.create(connection, new PublicKey(poolAddress));
  dlmmCache.set(poolAddress, promise);
  cacheTimestamps.set(poolAddress, now);
  
  return promise;
}
export interface PoolInfo {
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  bin_step: number;
  base_fee_percentage: string;
  current_price: number;
  liquidity: string;
  trade_volume_24h: number;
  fees_24h: number;
  apr: number;
}

export interface BinPosition {
  binId: number;
  price: string;
  pricePerToken: string;
  amountX: string;
  amountY: string;
  amountXInActive: string;
  amountYInActive: string;
}

export interface UserPosition {
  publicKey: PublicKey;
  positionData: {
    lowerBinId: number;
    upperBinId: number;
    totalXAmount: string;
    totalYAmount: string;
    feeX: string;
    feeY: string;
    rewardOne: string;
    rewardTwo: string;
    positionBinData: BinPosition[];
  };
  poolAddress: string;
  poolName: string;
  activeBinId: number;
  activeBinPrice: string;
  tokenX: { symbol: string; mint: string; decimals: number; logoURI?: string };
  tokenY: { symbol: string; mint: string; decimals: number; logoURI?: string };
  pnlUsd?: string;
  pnlPercent?: string;
  tokenXPrice?: string;
  tokenYPrice?: string;
  poolActivePrice?: string;
  isClosed?: boolean;
}

export interface PositionPnlInfo {
  positionAddress: string;
  pnlUsd: string;
  pnlPctChange: string;
  tokenXPrice?: string;
  tokenYPrice?: string;
  poolActivePrice?: string;
  isClosed?: boolean;
}

// ---------- API Functions ----------

/**
 * Fetch token symbol via Helius DAS API using the configured RPC
 */
const symbolCache: Record<string, string> = {};

async function getTokenSymbolByMint(connection: Connection, mintAddress: string): Promise<string | undefined> {
  if (tokenMetadataCache.has(mintAddress)) return tokenMetadataCache.get(mintAddress)?.symbol;
  if (symbolCache[mintAddress]) return symbolCache[mintAddress];
  
  try {
    const response = await fetch(connection.rpcEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getAsset',
        params: { id: mintAddress }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const symbol = data?.result?.content?.metadata?.symbol;
      if (symbol) {
        symbolCache[mintAddress] = symbol;
        return symbol;
      }
    }
  } catch (err) {
    logger.warn("Failed to fetch token symbol via DAS API:", err);
  }
  return undefined;
}

/**
 * Resolve token metadata (symbols and logos) from Jupiter
 */
async function resolveTokenMetadata(mints: string[]): Promise<void> {
    const missing = mints.filter(m => !tokenMetadataCache.has(m));
    if (missing.length === 0) return;

    try {
        // Call our local proxy instead of Jupiter directly
        const url = `/api/token-metadata?mints=${missing.join(',')}`;
        const res = await fetch(url);
        
        if (res.ok) {
            const tokens = await res.json();
            if (Array.isArray(tokens)) {
                tokens.forEach(t => {
                   const mint = t.id || t.address;
                   if (mint) {
                       tokenMetadataCache.set(mint, {
                           symbol: t.symbol,
                           logoURI: t.icon || t.logoURI
                       });
                   }
                });
            }
        } else {
            logger.warn("[TokenMetadata] Proxy fetch failed:", res.status);
        }
    } catch (err) {
        logger.warn("[TokenMetadata] Metadata resolution failed:", err);
    }
}

/**
 * Fetch user's DLMM positions across all pools
 */
export async function getUserPositions(
  connection: Connection,
  walletPubKey: PublicKey
): Promise<UserPosition[]> {
  try {
    // Use the SDK to get all positions for the user
    const positions = await DLMM.getAllLbPairPositionsByUser(
      connection,
      walletPubKey
    );

    const userPositions: UserPosition[] = [];

    const activeBinCache = new Map<string, any>();

    for (const [poolAddress, positionInfo] of positions) {
      try {
        // Use cached DLMM instance for this pool
        const dlmmPool = await getOrCreateDlmmPool(
          connection,
          poolAddress
        );

        // Get active bin (cache it for this cycle if multiple positions in same pool)
        let activeBin = activeBinCache.get(poolAddress);
        if (!activeBin) {
          activeBin = await dlmmPool.getActiveBin();
          activeBinCache.set(poolAddress, activeBin);
        }

        // Get token info and resolve symbols
        const tokenX = dlmmPool.tokenX as any;
        const tokenY = dlmmPool.tokenY as any;
        
        const mintX = tokenX.publicKey.toBase58();
        const mintY = tokenY.publicKey.toBase58();
        
        // Batch resolve metadata for this pool's tokens
        await resolveTokenMetadata([mintX, mintY]);
        
        const metadataX = tokenMetadataCache.get(mintX);
        const metadataY = tokenMetadataCache.get(mintY);

        // Fetch PnL data from Meteora data API for this pool
        const pnlMap = await fetchMeteoraPositionPnl(
          poolAddress,
          walletPubKey.toBase58(),
          "all",
          1,
          100
        );

        const symbolXJup = metadataX?.symbol || await getTokenSymbolByMint(connection, mintX);
        const symbolYJup = metadataY?.symbol || await getTokenSymbolByMint(connection, mintY);
        
        let symbolX = symbolXJup || tokenX.symbol || mintX.slice(0, 4);
        let symbolY = symbolYJup || tokenY.symbol || mintY.slice(0, 4);
        let poolName = `${symbolX}-${symbolY}`;

        for (const position of positionInfo.lbPairPositionsData) {
          const posData = position.positionData;

          // Calculate total amounts from bin data
          let totalXAmount = 0;
          let totalYAmount = 0;
          let feeX = BigInt(posData.feeX?.toString() || "0");
          let feeY = BigInt(posData.feeY?.toString() || "0");

          const decimalsX = tokenX.mint?.decimals ?? 9;
          const decimalsY = tokenY.mint?.decimals ?? 6;

          if (posData.positionBinData) {
            for (const bin of posData.positionBinData as any[]) {
              // positionXAmount is the user's share in raw units (as string)
              const x = bin.positionXAmount || "0";
              const y = bin.positionYAmount || "0";
              totalXAmount += parseFloat(x.toString());
              totalYAmount += parseFloat(y.toString());
            }
          }

          const pnlData = pnlMap[position.publicKey.toBase58()];

          userPositions.push({
            publicKey: position.publicKey,
            positionData: {
              lowerBinId: posData.lowerBinId,
              upperBinId: posData.upperBinId,
              totalXAmount: (totalXAmount / Math.pow(10, decimalsX)).toFixed(decimalsX > 4 ? 4 : decimalsX),
              totalYAmount: (totalYAmount / Math.pow(10, decimalsY)).toFixed(decimalsY > 4 ? 4 : decimalsY),
              feeX: (
                Number(feeX) / Math.pow(10, decimalsX)
              ).toFixed(decimalsX > 4 ? 4 : decimalsX),
              feeY: (
                Number(feeY) / Math.pow(10, decimalsY)
              ).toFixed(decimalsY > 4 ? 4 : decimalsY),
              rewardOne: "0",
              rewardTwo: "0",
              positionBinData: (posData.positionBinData || []).map(
                (bin: any) => ({
                  binId: Number(bin.binId),
                  price: bin.pricePerToken || "0",
                  pricePerToken: bin.pricePerToken || "0",
                  amountX: (parseFloat(bin.positionXAmount || "0") / Math.pow(10, decimalsX)).toString(),
                  amountY: (parseFloat(bin.positionYAmount || "0") / Math.pow(10, decimalsY)).toString(),
                  amountXInActive: "0",
                  amountYInActive: "0",
                })
              ),
            },
            poolAddress: poolAddress,
            poolName: `${symbolX}-${symbolY}`,
            activeBinId: activeBin.binId,
            activeBinPrice: activeBin.price,
            tokenX: { 
              symbol: symbolX, 
              mint: mintX, 
              decimals: decimalsX,
              logoURI: metadataX?.logoURI
            },
            tokenY: { 
              symbol: symbolY, 
              mint: mintY, 
              decimals: decimalsY,
              logoURI: metadataY?.logoURI
            },
            pnlUsd: pnlData?.pnlUsd,
            pnlPercent: pnlData?.pnlPctChange,
            tokenXPrice: pnlData?.tokenXPrice,
            tokenYPrice: pnlData?.tokenYPrice,
            poolActivePrice: pnlData?.poolActivePrice,
            isClosed: pnlData?.isClosed,
          });
        }
      } catch (poolErr) {
        logger.error(`Error fetching pool ${poolAddress}:`, poolErr);
      }
    }

    return userPositions;
  } catch (err) {
    logger.error("Failed to fetch user positions:", err);
    throw err;
  }
}

/**
 * Calculate position health (0-100)
 * 100 = active bin is exactly in the middle of the position
 * 0 = active bin is at the edge or outside range
 */
export function calculatePositionHealth(
  activeBinId: number,
  lowerBinId: number,
  upperBinId: number
): { score: number; status: "healthy" | "warning" | "critical" | "out-of-range" } {
  if (activeBinId < lowerBinId || activeBinId > upperBinId) {
    return { score: 0, status: "out-of-range" };
  }

  const range = upperBinId - lowerBinId;
  if (range === 0) return { score: 100, status: "healthy" };

  const center = lowerBinId + range / 2;
  const distanceFromCenter = Math.abs(activeBinId - center);
  const maxDistance = range / 2;
  const score = Math.round((1 - distanceFromCenter / maxDistance) * 100);

  if (score >= 60) return { score, status: "healthy" };
  if (score >= 30) return { score, status: "warning" };
  return { score, status: "critical" };
}

export async function fetchMeteoraPositionPnl(
  poolAddress: string,
  userAddress: string,
  status: "all" | "open" | "closed" = "all",
  page = 1,
  pageSize = 100
): Promise<Record<string, PositionPnlInfo>> {
  try {
    const query = new URLSearchParams({
      poolAddress,
      user: userAddress,
      status,
      page: String(page),
      page_size: String(pageSize),
    });

    const response = await fetch(`/api/meteora-pnl?${query.toString()}`);
    if (!response.ok) {
      const errorBody = await response.text();
      logger.warn("[Meteora PnL] fetch failed", response.status, errorBody);
      return {};
    }

    const data = await response.json();
    if (!data?.positions || !Array.isArray(data.positions)) {
      return {};
    }

    const map: Record<string, PositionPnlInfo> = {};
    for (const pos of data.positions) {
      const positionAddress =
        pos.positionAddress || pos.position_address || pos.position_address;
      if (!positionAddress) continue;

      map[positionAddress] = {
        positionAddress,
        pnlUsd: String(pos.pnlUsd ?? pos.pnl_usd ?? "0"),
        pnlPctChange: String(pos.pnlPctChange ?? pos.pnl_pct_change ?? "0"),
        tokenXPrice: pos.tokenXPrice || pos.token_x_price,
        tokenYPrice: pos.tokenYPrice || pos.token_y_price,
        poolActivePrice: pos.poolActivePrice || pos.pool_active_price,
        isClosed: pos.isClosed ?? pos.is_closed,
      };
    }

    return map;
  } catch (err) {
    logger.warn("[Meteora PnL] error fetching PnL", err);
    return {};
  }
}

/**
 * Get the current active bin ID for a pool (lightweight check for monitoring)
 */
export async function getActiveBinForPool(
  connection: Connection,
  poolAddress: string
): Promise<{ binId: number; price: string } | null> {
  try {
    const dlmmPool = await getOrCreateDlmmPool(connection, poolAddress);
    const activeBin = await dlmmPool.getActiveBin();
    if (!activeBin || activeBin.binId == null) {
      return null;
    }
    return { binId: activeBin.binId, price: activeBin.price };
  } catch (err) {
    logger.warn("[getActiveBinForPool] Error fetching active bin for", poolAddress, err);
    return null;
  }
}

/**
 * Close a position by removing 100% liquidity, claiming fees, and closing the account.
 * Returns Transaction[] that need to be signed and sent by the wallet.
 * Returns empty array if the position is already closed or doesn't exist.
 */
export async function closePosition(
  connection: Connection,
  userPubKey: PublicKey,
  poolAddress: string,
  positionPubKey: PublicKey,
  lowerBinId: number,
  upperBinId: number
): Promise<Transaction[]> {
  // Pre-check: verify the position account still exists
  try {
    const accountInfo = await connection.getAccountInfo(positionPubKey);
    if (!accountInfo || accountInfo.data === null || accountInfo.lamports === 0) {
      logger.info(`[closePosition] Position ${positionPubKey.toBase58()} does not exist — already closed`);
      return [];
    }
  } catch (err) {
    logger.warn(`[closePosition] Could not verify position account:`, err);
    // Continue — the account check is best-effort
  }

  const dlmmPool = await getOrCreateDlmmPool(connection, poolAddress);

  try {
    const transactions = await dlmmPool.removeLiquidity({
      user: userPubKey,
      position: positionPubKey,
      fromBinId: lowerBinId,
      toBinId: upperBinId,
      bps: new BN(10000), // 100%
      shouldClaimAndClose: true,
    });

    return transactions;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // If the error indicates the position is already closed, return empty array
    if (
      errMsg.includes("data") && errMsg.includes("null") ||
      errMsg.includes("Account does not exist") ||
      errMsg.includes("0x1") ||
      errMsg.includes("already closed") ||
      errMsg.includes("Invalid account")
    ) {
      logger.info(`[closePosition] Position ${positionPubKey.toBase58()} appears already closed: ${errMsg}`);
      return [];
    }
    throw err; // Re-throw unexpected errors
  }
}

/**
 * Claim swap fees for a position.
 * Returns Transaction[] that need to be signed and sent by the wallet.
 */
export async function claimSwapFee(
  connection: Connection,
  userPubKey: PublicKey,
  poolAddress: string,
  positionPubKey: PublicKey
): Promise<Transaction[]> {
  const dlmmPool = await getOrCreateDlmmPool(connection, poolAddress);

  // Fetch the position account to get the full LbPosition data
  const positionState = await dlmmPool.getPosition(positionPubKey);

  const transactions = await dlmmPool.claimSwapFee({
    owner: userPubKey,
    position: {
      publicKey: positionPubKey,
      positionData: positionState.positionData,
      version: positionState.version,
    },
  });

  return transactions;
}

/**
 * Result of a close position attempt, which may be partial.
 */
export interface ClosePositionResult {
  /** Whether all transactions were confirmed successfully */
  success: boolean;
  /** Whether some (but not all) transactions were confirmed */
  partialSuccess: boolean;
  /** Signatures of confirmed transactions */
  confirmedSignatures: string[];
  /** Number of transaction chunks that failed */
  failedChunks: number;
  /** Total number of transaction chunks */
  totalChunks: number;
  /** Error message if any */
  error?: string;
}

const MAX_CLOSE_RETRIES = 3;

/**
 * Close a position with atomic transaction sending and retry logic.
 *
 * For positions spanning >70 bins, the SDK returns multiple transactions.
 * This function sends all transactions atomically (one blockhash, send all,
 * then confirm all) and retries failed chunks up to MAX_CLOSE_RETRIES times.
 */
export async function closePositionWithRetry(
  connection: Connection,
  keypair: Keypair,
  poolAddress: string,
  positionPubKey: PublicKey,
  lowerBinId: number,
  upperBinId: number
): Promise<ClosePositionResult> {
  const userPubKey = keypair.publicKey;
  const result: ClosePositionResult = {
    success: false,
    partialSuccess: false,
    confirmedSignatures: [],
    failedChunks: 0,
    totalChunks: 0,
  };

  let currentLowerBin = lowerBinId;
  let attempt = 0;

  while (currentLowerBin <= upperBinId && attempt < MAX_CLOSE_RETRIES) {
    attempt++;
    const remainingBins = upperBinId - currentLowerBin + 1;
    console.info(
      `[ClosePosition] Attempt ${attempt}/${MAX_CLOSE_RETRIES}: closing bins ${currentLowerBin} → ${upperBinId} (${remainingBins} bins remaining) for position ${positionPubKey.toBase58()}`
    );

    try {
      const transactions = await closePosition(
        connection,
        userPubKey,
        poolAddress,
        positionPubKey,
        currentLowerBin,
        upperBinId
      );

      result.totalChunks = transactions.length;

      if (transactions.length === 0) {
        console.info("[ClosePosition] No transactions returned — position may already be closed");
        result.success = true;
        return result;
      }

      console.info(
        `[ClosePosition] Built ${transactions.length} transaction${transactions.length > 1 ? "s" : ""} for ${remainingBins} bins`
      );

      // Strategy: send all transactions atomically using a single blockhash,
      // then confirm them all. This prevents state-change failures between
      // sequential confirms.
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      console.info(`[ClosePosition] Using blockhash: ${blockhash.slice(0, 20)}... (valid until block ${lastValidBlockHeight})`);

      // Sign all transactions with the same blockhash
      for (const tx of transactions) {
        tx.feePayer = userPubKey;
        tx.recentBlockhash = blockhash;
        tx.sign(keypair);
      }

      // Send all transactions without waiting for confirmation
      const sentSignatures: string[] = [];
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const rawTx = tx.serialize();
        const signature = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });
        sentSignatures.push(signature);
        console.info(
          `[ClosePosition] Sent tx ${i + 1}/${transactions.length}: ${signature}\n` +
          `  Solscan: https://solscan.io/tx/${signature}`
        );
      }

      // Confirm all transactions
      let confirmedCount = 0;
      let failedCount = 0;
      for (let i = 0; i < sentSignatures.length; i++) {
        try {
          const confirmation = await connection.confirmTransaction(
            { signature: sentSignatures[i], blockhash, lastValidBlockHeight },
            "confirmed"
          );
          if (confirmation.value.err) {
            console.warn(
              `[ClosePosition] ⚠️ Tx ${sentSignatures[i]} confirmed with error: ${JSON.stringify(confirmation.value.err)}`
            );
            failedCount++;
          } else {
            confirmedCount++;
            result.confirmedSignatures.push(sentSignatures[i]);
            console.info(
              `[ClosePosition] ✅ Confirmed tx ${i + 1}/${sentSignatures.length}: ${sentSignatures[i]}\n` +
              `  Solscan: https://solscan.io/tx/${sentSignatures[i]}`
            );
          }
        } catch (confirmErr) {
          console.warn(`[ClosePosition] ⚠️ Failed to confirm tx ${sentSignatures[i]}:`, confirmErr);
          failedCount++;
        }
      }

      console.info(
        `[ClosePosition] Attempt ${attempt} result: ${confirmedCount}/${transactions.length} transactions confirmed, ${failedCount} failed`
      );

      if (failedCount === 0) {
        // All transactions confirmed — success!
        console.info(
          `[ClosePosition] ✅ All ${confirmedCount} transaction(s) confirmed for position ${positionPubKey.toBase58()}`
        );
        result.success = true;
        result.partialSuccess = false;
        result.failedChunks = 0;
        return result;
      }

      // Some transactions failed — calculate remaining bin range
      // Each confirmed transaction covers up to 70 bins (DEFAULT_BIN_PER_POSITION)
      const BIN_PER_CHUNK = 70;
      const confirmedBins = confirmedCount * BIN_PER_CHUNK;
      currentLowerBin = Math.min(currentLowerBin + confirmedBins, upperBinId + 1);
      result.failedChunks = failedCount;
      result.partialSuccess = confirmedCount > 0;

      // If no transactions confirmed at all, retry the whole range
      if (confirmedCount === 0) {
        console.warn(`[ClosePosition] No transactions confirmed on attempt ${attempt}, retrying...`);
        continue;
      }

      // Some confirmed — retry remaining range
      console.info(
        `[ClosePosition] Partial success: ${confirmedCount} confirmed, retrying remaining bins ${currentLowerBin} → ${upperBinId}`
      );
    } catch (err) {
      console.error(`[ClosePosition] ❌ Error on attempt ${attempt}:`, err);
      result.error = err instanceof Error ? err.message : String(err);

      if (attempt >= MAX_CLOSE_RETRIES) {
        console.error(`[ClosePosition] Exhausted all ${MAX_CLOSE_RETRIES} retries`);
        break;
      }
      console.info(`[ClosePosition] Retrying in 2s...`);
      // Brief delay before retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // If we get here, we either succeeded partially or exhausted retries
  if (result.confirmedSignatures.length > 0) {
    result.partialSuccess = true;
    result.success = false;
    console.warn(
      `[ClosePosition] ⚠️ Partial close for ${positionPubKey.toBase58()}: ${result.confirmedSignatures.length} tx(s) confirmed, ${result.failedChunks} chunk(s) failed`
    );
  } else {
    console.error(`[ClosePosition] ❌ Failed to close position ${positionPubKey.toBase58()} after ${MAX_CLOSE_RETRIES} attempts`);
  }

  return result;
}
