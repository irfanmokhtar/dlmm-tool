import { Connection, PublicKey } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import { DLMM_API_BASE } from "./constants";

// ---------- Types ----------
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
  tokenX: { symbol: string; mint: string; decimals: number };
  tokenY: { symbol: string; mint: string; decimals: number };
}

// ---------- API Functions ----------

/**
 * Fetch all DLMM pairs from Meteora API
 */
export async function fetchAllPairs(): Promise<PoolInfo[]> {
  try {
    const res = await fetch(`${DLMM_API_BASE}/pair/all`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch DLMM pairs:", err);
    return [];
  }
}

// Pairs Cache to resolve symbols
let pairsCache: PoolInfo[] | null = null;

async function getPoolInfoCached(poolAddress: string): Promise<PoolInfo | undefined> {
  if (!pairsCache) {
    try {
      pairsCache = await fetchAllPairs();
    } catch (e) {
      console.error("Failed to fetch pairs cache:", e);
      pairsCache = []; // prevent repeated failed fetches
    }
  }
  return pairsCache.find((p) => p.address === poolAddress);
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

    for (const [poolAddress, positionInfo] of positions) {
      try {
        // Create DLMM instance for this pool
        const dlmmPool = await DLMM.create(
          connection,
          new PublicKey(poolAddress)
        );

        // Get active bin
        const activeBin = await dlmmPool.getActiveBin();

        // Get token info and resolve symbols
        const tokenX = dlmmPool.tokenX as any;
        const tokenY = dlmmPool.tokenY as any;
        
        let symbolX = tokenX.symbol || tokenX.publicKey.toBase58().slice(0, 4);
        let symbolY = tokenY.symbol || tokenY.publicKey.toBase58().slice(0, 4);
        let poolName = `${symbolX}-${symbolY}`;

        const poolInfo = await getPoolInfoCached(poolAddress);
        if (poolInfo && poolInfo.name) {
          poolName = poolInfo.name;
          const parts = poolInfo.name.split("-");
          if (parts.length === 2) {
            symbolX = parts[0];
            symbolY = parts[1];
          }
        }

        for (const position of positionInfo.lbPairPositionsData) {
          const posData = position.positionData;

          // Calculate total amounts from bin data
          let totalXAmount = BigInt(0);
          let totalYAmount = BigInt(0);
          let feeX = BigInt(posData.feeX?.toString() || "0");
          let feeY = BigInt(posData.feeY?.toString() || "0");

          if (posData.positionBinData) {
            for (const bin of posData.positionBinData) {
              totalXAmount += BigInt(bin.binXAmount || "0");
              totalYAmount += BigInt(bin.binYAmount || "0");
            }
          }

          userPositions.push({
            publicKey: position.publicKey,
            positionData: {
              lowerBinId: posData.lowerBinId,
              upperBinId: posData.upperBinId,
              totalXAmount: (
                Number(totalXAmount) / Math.pow(10, tokenX.decimal ?? 9)
              ).toFixed((tokenX.decimal ?? 9) > 4 ? 4 : (tokenX.decimal ?? 9)),
              totalYAmount: (
                Number(totalYAmount) / Math.pow(10, tokenY.decimal ?? 6)
              ).toFixed((tokenY.decimal ?? 6) > 4 ? 4 : (tokenY.decimal ?? 6)),
              feeX: (
                Number(feeX) / Math.pow(10, tokenX.decimal ?? 9)
              ).toFixed((tokenX.decimal ?? 9) > 4 ? 4 : (tokenX.decimal ?? 9)),
              feeY: (
                Number(feeY) / Math.pow(10, tokenY.decimal ?? 6)
              ).toFixed((tokenY.decimal ?? 6) > 4 ? 4 : (tokenY.decimal ?? 6)),
              rewardOne: "0",
              rewardTwo: "0",
              positionBinData: (posData.positionBinData || []).map(
                (bin: any) => ({
                  binId: Number(bin.binId),
                  price: bin.pricePerToken || "0",
                  pricePerToken: bin.pricePerToken || "0",
                  amountX: (
                    Number(bin.binXAmount || "0") /
                    Math.pow(10, tokenX.decimal ?? 9)
                  ).toString(),
                  amountY: (
                    Number(bin.binYAmount || "0") /
                    Math.pow(10, tokenY.decimal ?? 6)
                  ).toString(),
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
              mint: tokenX.publicKey.toBase58(),
              decimals: tokenX.decimal ?? 9,
            },
            tokenY: {
              symbol: symbolY,
              mint: tokenY.publicKey.toBase58(),
              decimals: tokenY.decimal ?? 6,
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
    return [];
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
