import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { getCostBasisForPosition } from "@/lib/pnl";
import DLMM from "@meteora-ag/dlmm";
import { PublicKey } from "@solana/web3.js";

// Uses Jupiter V2 Price API
async function getLivePrice(mints: string[]): Promise<Record<string, number>> {
  try {
    const url = `https://api.jup.ag/price/v2?ids=${mints.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const mint of mints) {
      if (data.data[mint]) {
        prices[mint] = Number(data.data[mint].price);
      }
    }
    return prices;
  } catch (err) {
    console.warn("Failed to fetch live prices from Jupiter:", err);
    return {};
  }
}

/**
 * GET /api/pnl?position=XYZ&user=ABC&pool=MNO
 * 
 * Calculates the current Net PnL % of a DLMM position by crawling
 * the transaction history for deposits and comparing to live bin value.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const positionAddress = searchParams.get("position");
    const userWallet = searchParams.get("user");
    const poolAddress = searchParams.get("pool");

    if (!positionAddress || !userWallet || !poolAddress) {
      return NextResponse.json({ error: "Missing required params: position, user, pool" }, { status: 400 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.ankr.com/solana";
    const connection = new Connection(rpcUrl, "confirmed");

    // 1. Get Live Position Data (SDK)
    const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
    const tokenX = dlmmPool.tokenX as any;
    const tokenY = dlmmPool.tokenY as any;
    const mintX = tokenX.publicKey.toBase58();
    const mintY = tokenY.publicKey.toBase58();

    // 2. Fetch Cost Basis (RPC Crawler)
    const costBasis = await getCostBasisForPosition(
      connection,
      positionAddress,
      userWallet,
      mintX,
      mintY,
      tokenX.mint.decimals ?? 9,
      tokenY.mint.decimals ?? 6
    );

    // 3. Find current token amounts in the position
    const allPositions = await DLMM.getAllLbPairPositionsByUser(connection, new PublicKey(userWallet));
    const poolPositions = allPositions.get(poolAddress);
    
    let currentX = 0;
    let currentY = 0;

    if (poolPositions) {
      const pos = poolPositions.lbPairPositionsData.find(p => p.publicKey.toBase58() === positionAddress);
      if (pos) {
        if (pos.positionData.positionBinData) {
          for (const bin of pos.positionData.positionBinData as any[]) {
            currentX += parseFloat(bin.positionXAmount || "0");
            currentY += parseFloat(bin.positionYAmount || "0");
          }
        }
        currentX += Number(pos.positionData.feeX?.toString() || "0");
        currentY += Number(pos.positionData.feeY?.toString() || "0");
      }
    }

    const normalizedCurrentX = currentX / Math.pow(10, tokenX.mint.decimals ?? 9);
    const normalizedCurrentY = currentY / Math.pow(10, tokenY.mint.decimals ?? 6);

    // 4. Get Live Prices
    const solMint = "So11111111111111111111111111111111111111112";
    const livePrices = await getLivePrice([mintX, mintY, solMint]);
    const priceX = livePrices[mintX] || 0;
    const priceY = livePrices[mintY] || 0;
    const priceSol = livePrices[solMint] || 0;

    // 5. Calculate Metrics
    const currentValueUsd = (normalizedCurrentX * priceX) + (normalizedCurrentY * priceY);
    
    // HODL Value: If we just held the deposited tokens in wallet
    const hodlValueUsd = (costBasis.totalDepositedX * priceX) + (costBasis.totalDepositedY * priceY);
    
    // Divergence Loss (IL): Current Value relative to HODL Value
    const divergenceLossUsd = hodlValueUsd > 0 ? currentValueUsd - hodlValueUsd : 0;
    
    // Net PnL (including yield)
    const pnlUsd = currentValueUsd - costBasis.totalInitialValueUsd;
    const pnlSol = priceSol > 0 ? pnlUsd / priceSol : 0;
    const pnlPercentage = costBasis.totalInitialValueUsd > 0 
      ? (pnlUsd / costBasis.totalInitialValueUsd) * 100 
      : 0;

    return NextResponse.json({
      positionAddress,
      costBasisUsd: costBasis.totalInitialValueUsd,
      currentValueUsd,
      hodlValueUsd,
      divergenceLossUsd,
      pnlUsd,
      pnlSol,
      pnlPercentage,
      totalDepositedX: costBasis.totalDepositedX,
      totalDepositedY: costBasis.totalDepositedY,
      currentTokens: {
        x: normalizedCurrentX,
        y: normalizedCurrentY
      }
    });
    
  } catch (err) {
    console.error("PnL calculation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
