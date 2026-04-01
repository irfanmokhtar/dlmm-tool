import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

export interface DepositEvent {
  signature: string;
  blockTime: number;
  amountX: number;
  amountY: number;
  priceX: number;
  priceY: number;
  usdValue: number;
}

export interface PositionCostBasis {
  positionAddress: string;
  lastParsedSignature: string | null;
  deposits: DepositEvent[];
  totalInitialValueUsd: number;
}

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "cost-basis-cache.json");

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function loadCache(): Record<string, PositionCostBasis> {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveCache(cache: Record<string, PositionCostBasis>) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Fetch historical price from Birdeye
 * Fallback to 0 if no API key is set or the request fails.
 */
async function getHistoricalPrice(mint: string, timestamp: number): Promise<number> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    console.warn("BIRDEYE_API_KEY not set. Cannot fetch historical price for", mint);
    return 0; // Requires API key for accurate cost basis
  }

  try {
    // Birdeye API expects seconds, but let's query a 1H candle around the timestamp
    const url = `https://public-api.birdeye.so/defi/history_price?address=${mint}&address_type=token&type=1H&time_from=${timestamp - 3600}&time_to=${timestamp + 3600}`;
    
    const response = await fetch(url, {
      headers: {
        "X-API-KEY": apiKey,
        "x-chain": "solana"
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.data?.items && data.data.items.length > 0) {
        // Find the closest candle
        return data.data.items[0].value;
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch historical price for ${mint}:`, err);
  }
  return 0;
}

/**
 * Crawls transaction history for a position to calculate accurate cost basis
 * using the Delta Method (pre vs post token balances).
 */
export async function getCostBasisForPosition(
  connection: Connection,
  positionAddress: string,
  userWallet: string,
  mintX: string,
  mintY: string,
  decimalsX: number,
  decimalsY: number
): Promise<PositionCostBasis> {
  const cache = loadCache();
  let costBasis = cache[positionAddress] || {
    positionAddress,
    lastParsedSignature: null,
    deposits: [],
    totalInitialValueUsd: 0,
  };

  try {
    const positionPubKey = new PublicKey(positionAddress);
    
    // Fetch signatures (until we hit the last parsed one)
    const options: any = { limit: 100 };
    if (costBasis.lastParsedSignature) {
      options.until = costBasis.lastParsedSignature;
    }

    const signatures = await connection.getSignaturesForAddress(positionPubKey, options);
    
    if (signatures.length === 0) {
      return costBasis; // No new transactions
    }

    // Process from oldest to newest
    const newDeposits: DepositEvent[] = [];
    const reversedSignatures = [...signatures].reverse();

    for (const sigInfo of reversedSignatures) {
      if (sigInfo.err) continue; // Skip failed txs

      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta || !tx.blockTime) continue;

      // Ensure this transaction actually modified user balances (deposit or withdraw)
      const preBalances = tx.meta.preTokenBalances || [];
      const postBalances = tx.meta.postTokenBalances || [];

      // Find user balances for Mint X
      const preX = preBalances.find((b) => b.owner === userWallet && b.mint === mintX);
      const postX = postBalances.find((b) => b.owner === userWallet && b.mint === mintX);
      
      // Find user balances for Mint Y
      const preY = preBalances.find((b) => b.owner === userWallet && b.mint === mintY);
      const postY = postBalances.find((b) => b.owner === userWallet && b.mint === mintY);

      // Delta: Pre minus Post (positive means tokens left the user's wallet = deposit)
      const preAmountX = preX ? Number(preX.uiTokenAmount.uiAmountString) : 0;
      const postAmountX = postX ? Number(postX.uiTokenAmount.uiAmountString) : 0;
      const amountXDeposited = preAmountX - postAmountX;

      const preAmountY = preY ? Number(preY.uiTokenAmount.uiAmountString) : 0;
      const postAmountY = postY ? Number(postY.uiTokenAmount.uiAmountString) : 0;
      const amountYDeposited = preAmountY - postAmountY;

      // If user deposited tokens (positive delta for at least one token)
      if (amountXDeposited > 0 || amountYDeposited > 0) {
        // Need to value this exact deposit
        const priceX = amountXDeposited > 0 ? await getHistoricalPrice(mintX, tx.blockTime) : 0;
        const priceY = amountYDeposited > 0 ? await getHistoricalPrice(mintY, tx.blockTime) : 0;

        const usdValue = (amountXDeposited * priceX) + (amountYDeposited * priceY);

        newDeposits.push({
          signature: sigInfo.signature,
          blockTime: tx.blockTime,
          amountX: amountXDeposited,
          amountY: amountYDeposited,
          priceX,
          priceY,
          usdValue
        });
      }
    }

    if (newDeposits.length > 0) {
      costBasis.deposits.push(...newDeposits);
      costBasis.totalInitialValueUsd = costBasis.deposits.reduce((acc, sum) => acc + sum.usdValue, 0);
    }

    costBasis.lastParsedSignature = signatures[0].signature; // most recent parsed

    // Update Cache
    cache[positionAddress] = costBasis;
    saveCache(cache);

    return costBasis;
  } catch (err) {
    console.error("Error crawling cost basis:", err);
    return costBasis;
  }
}
