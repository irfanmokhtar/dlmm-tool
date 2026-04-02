import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import BN from "bn.js";
import { DLMM_API_BASE } from "./constants";

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
    console.warn("Failed to fetch token symbol via DAS API:", err);
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
            console.warn("[TokenMetadata] Proxy fetch failed:", res.status);
        }
    } catch (err) {
        console.warn("[TokenMetadata] Metadata resolution failed:", err);
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
          });
        }
      } catch (poolErr) {
        console.error(`Error fetching pool ${poolAddress}:`, poolErr);
      }
    }

    return userPositions;
  } catch (err) {
    console.error("Failed to fetch user positions:", err);
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

/**
 * Get the current active bin ID for a pool (lightweight check for monitoring)
 */
export async function getActiveBinForPool(
  connection: Connection,
  poolAddress: string
): Promise<{ binId: number; price: string }> {
  const dlmmPool = await getOrCreateDlmmPool(connection, poolAddress);
  const activeBin = await dlmmPool.getActiveBin();
  return { binId: activeBin.binId, price: activeBin.price };
}

/**
 * Close a position by removing 100% liquidity, claiming fees, and closing the account.
 * Returns Transaction[] that need to be signed and sent by the wallet.
 */
export async function closePosition(
  connection: Connection,
  userPubKey: PublicKey,
  poolAddress: string,
  positionPubKey: PublicKey,
  lowerBinId: number,
  upperBinId: number
): Promise<Transaction[]> {
  const dlmmPool = await getOrCreateDlmmPool(connection, poolAddress);

  const transactions = await dlmmPool.removeLiquidity({
    user: userPubKey,
    position: positionPubKey,
    fromBinId: lowerBinId,
    toBinId: upperBinId,
    bps: new BN(10000), // 100%
    shouldClaimAndClose: true,
  });

  return transactions;
}
