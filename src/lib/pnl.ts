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
  totalDepositedX: number;
  totalDepositedY: number;
  totalInitialValueUsd: number;
}

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "cost-basis-cache.json");
const DLMM_PROGRAM_ID = "LBUZKhLz79uFqcGiEBwtHn6AVgVxs5YymSNozXfUByL";

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch historical price from Birdeye
 * Fallback to 0 if no API key is set or the request fails.
 * Includes exponential backoff for rate limits (429).
 */
async function getHistoricalPrice(mint: string, timestamp: number, retries = 3): Promise<number> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    console.warn("BIRDEYE_API_KEY not set. Cannot fetch historical price for", mint);
    return 0;
  }

  let delay = 1000; // start with 1s

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
          return data.data.items[0].value;
        }
        return 0;
      } 
      
      if (response.status === 429) {
        if (attempt < retries) {
          console.log(`[Birdeye] Rate limited (429). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${retries})`);
          await sleep(delay + Math.random() * 500); // Add jitter
          delay *= 2; // exponential backoff
          continue;
        }
      }

      const text = await response.text();
      console.error(`[Birdeye] Failed for ${mint}: ${response.status} - ${text.slice(0, 100)}`);
      break; // stop on other errors
    } catch (err) {
      if (attempt < retries) {
        await sleep(delay);
        delay *= 2;
        continue;
      }
      console.warn(`Failed to fetch historical price for ${mint}:`, err);
    }
  }
  return 0;
}

/**
 * Crawls transaction history for a position to calculate accurate cost basis
 * using the Delta Method (pre vs post token balances).
 * Fallback to user wallet signatures if the position PDA history is empty.
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
    totalDepositedX: 0,
    totalDepositedY: 0,
    totalInitialValueUsd: 0,
  };

  try {
    const positionPubKey = new PublicKey(positionAddress);
    const userPubKey = new PublicKey(userWallet);
    
    // 1. Try fetching signatures for the position address directly
    let signatures = await connection.getSignaturesForAddress(positionPubKey, { 
      limit: 100, 
      until: costBasis.lastParsedSignature || undefined 
    });

    console.log(`[PnL] Found ${signatures.length} signatures for position ${positionAddress}`);
    
    // 2. Fallback: Search user wallet history for position initialization/deposits
    // Some PDAs are not indexed for signatures directly by all RPCs
    // REFINED: If we have no deposits yet, we MUST search the wallet to find the entry point.
    if (costBasis.deposits.length === 0) {
      console.log(`[PnL] No deposits found in cache/PDA. Falling back to wallet ${userWallet} history...`);
      const walletSignatures = await connection.getSignaturesForAddress(userPubKey, { limit: 100 });
      
      // Filter were done in the loop below, but we'll prepend these to the check list if needed
      // Actually, we'll just use the wallet signatures if the PDA returns nothing or if we're desperate
      if (signatures.length === 0) {
        signatures = walletSignatures;
      } else {
        // Unique merge
        const sigSet = new Set(signatures.map(s => s.signature));
        for (const ws of walletSignatures) {
          if (!sigSet.has(ws.signature)) {
            signatures.push(ws);
          }
        }
      }
    }

    if (signatures.length === 0) {
      return costBasis;
    }

    // Process from oldest to newest
    const reversedSignatures = [...signatures].reverse();

    for (const sigInfo of reversedSignatures) {
      if (sigInfo.err) continue;

      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta || !tx.blockTime) continue;

      // Filter: Must involve the position address
      const involvesPosition = tx.transaction.message.accountKeys.some(
        ak => ak.pubkey.toBase58() === positionAddress
      );
      if (!involvesPosition) continue;

      // Delta Method: Check balance shifts in the user's wallet
      const preBalances = tx.meta.preTokenBalances || [];
      const postBalances = tx.meta.postTokenBalances || [];

      const preX = preBalances.find((b) => b.owner === userWallet && b.mint === mintX);
      const postX = postBalances.find((b) => b.owner === userWallet && b.mint === mintX);
      const preY = preBalances.find((b) => b.owner === userWallet && b.mint === mintY);
      const postY = postBalances.find((b) => b.owner === userWallet && b.mint === mintY);

      // Delta (Pre - Post): Positive means tokens LEFT the wallet (Deposit)
      const preAmtX = preX ? Number(preX.uiTokenAmount.uiAmountString) : 0;
      const postAmtX = postX ? Number(postX.uiTokenAmount.uiAmountString) : 0;
      const deltaX = preAmtX - postAmtX;

      const preAmtY = preY ? Number(preY.uiTokenAmount.uiAmountString) : 0;
      const postAmtY = postY ? Number(postY.uiTokenAmount.uiAmountString) : 0;
      const deltaY = preAmtY - postAmtY;

      // We only count deposits for "Cost Basis" (entry value)
      // Withdrawals would reduce the "Current Value" side of the equation
      if (deltaX > 0 || deltaY > 0) {
        const amtX = Math.max(0, deltaX);
        const amtY = Math.max(0, deltaY);

        console.log(`[PnL] Detected deposit in ${sigInfo.signature}: X=${amtX}, Y=${amtY}`);
        
        const pxX = amtX > 0 ? await getHistoricalPrice(mintX, tx.blockTime) : 0;
        const pxY = amtY > 0 ? await getHistoricalPrice(mintY, tx.blockTime) : 0;
        const depositUsd = (amtX * pxX) + (amtY * pxY);

        costBasis.deposits.push({
          signature: sigInfo.signature,
          blockTime: tx.blockTime,
          amountX: amtX,
          amountY: amtY,
          priceX: pxX,
          priceY: pxY,
          usdValue: depositUsd
        });

        costBasis.totalDepositedX += amtX;
        costBasis.totalDepositedY += amtY;
        costBasis.totalInitialValueUsd += depositUsd;
      }
    }

    costBasis.lastParsedSignature = signatures[0].signature;
    cache[positionAddress] = costBasis;
    saveCache(cache);

    return costBasis;
  } catch (err) {
    console.error("Error crawling cost basis:", err);
    return costBasis;
  }
}
