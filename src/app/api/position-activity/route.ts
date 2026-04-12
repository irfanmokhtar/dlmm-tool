import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, ConfirmedSignatureInfo } from "@solana/web3.js";
import crypto from "crypto";

const DLMM_PROGRAM_ID = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";

/** Map of DLMM instruction names to activity metadata */
const INSTRUCTION_MAP: Record<string, { type: string; label: string; icon: string }> = {
  initializePosition: { type: "open", label: "Opened Position", icon: "🟢" },
  initializePosition2: { type: "open", label: "Opened Position", icon: "🟢" },
  initializePositionByOperator: { type: "open", label: "Opened Position", icon: "🟢" },
  addLiquidityByWeight: { type: "add_liquidity", label: "Added Liquidity", icon: "➕" },
  addLiquidityByStrategy2: { type: "add_liquidity", label: "Added Liquidity", icon: "➕" },
  addLiquidityOneSide: { type: "add_liquidity", label: "Added Liquidity (One Side)", icon: "➕" },
  addLiquidityOneSidePrecise2: { type: "add_liquidity", label: "Added Liquidity (One Side)", icon: "➕" },
  removeLiquidityByRange2: { type: "remove_liquidity", label: "Removed Liquidity", icon: "➖" },
  claimFee2: { type: "claim_fee", label: "Claimed Fees", icon: "💰" },
  claimReward2: { type: "claim_reward", label: "Claimed Rewards", icon: "🎁" },
  closePositionIfEmpty: { type: "close", label: "Closed Position", icon: "🔴" },
  closePosition2: { type: "close", label: "Closed Position", icon: "🔴" },
  rebalanceLiquidity: { type: "rebalance", label: "Rebalanced Liquidity", icon: "🔄" },
  increasePositionLength2: { type: "extend", label: "Extended Range", icon: "↔️" },
  decreasePositionLength2: { type: "shrink", label: "Shrunk Range", icon: "↔️" },
};

export interface PositionActivity {
  signature: string;
  blockTime: number | null;
  type: string;
  label: string;
  icon: string;
  slot: number;
  url: string;
  failed: boolean;
  fee: number;
}

/**
 * GET /api/position-activity?positionId=...&limit=...
 *
 * Fetches on-chain transaction history for a DLMM position by:
 * 1. Getting signatures for the position address
 * 2. Fetching each transaction to parse DLMM program instructions
 * 3. Mapping instructions to human-readable activity types via Anchor discriminators
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("positionId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    if (!positionId) {
      return NextResponse.json(
        { error: "Missing required param: positionId" },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.ankr.com/solana";
    const connection = new Connection(rpcUrl, "confirmed");

    let positionPubKey: PublicKey;
    try {
      positionPubKey = new PublicKey(positionId);
    } catch {
      return NextResponse.json({ error: "Invalid positionId" }, { status: 400 });
    }

    // Step 1: Get signatures for the position address
    const signatures = await connection.getSignaturesForAddress(positionPubKey, { limit });

    if (signatures.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    // Pre-compute Anchor discriminators for all known instructions
    const discriminatorCache = new Map<string, { type: string; label: string; icon: string }>();
    for (const [name, info] of Object.entries(INSTRUCTION_MAP)) {
      const disc = computeAnchorDiscriminator(name);
      discriminatorCache.set(disc.toString("hex"), info);
    }

    // Step 2: Fetch transactions and parse instructions
    const activities: PositionActivity[] = [];

    for (const sigInfo of signatures) {
      try {
        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta) {
          activities.push(makeActivity(sigInfo, "unknown", "Unknown Transaction", "❓"));
          continue;
        }

        // Collect all account keys
        const accountKeys = (tx.transaction.message.staticAccountKeys || []).map(
          (k: PublicKey) => k.toBase58()
        );

        // Find DLMM instructions in this transaction
        const foundTypes: string[] = [];

        // Check top-level instructions
        for (const ix of tx.transaction.message.compiledInstructions || []) {
          if (accountKeys[ix.programIdIndex] === DLMM_PROGRAM_ID && ix.data) {
            const matched = matchInstruction(ix.data, discriminatorCache);
            if (matched) foundTypes.push(matched.type);
          }
        }

        // Check inner instructions
        if (tx.meta.innerInstructions) {
          for (const inner of tx.meta.innerInstructions) {
            for (const ix of inner.instructions) {
              if (accountKeys[ix.programIdIndex] === DLMM_PROGRAM_ID && ix.data) {
                const matched = matchInstruction(ix.data, discriminatorCache);
                if (matched) foundTypes.push(matched.type);
              }
            }
          }
        }

        // Determine primary activity by priority
        const priorityOrder = [
          "close", "remove_liquidity", "claim_fee", "claim_reward",
          "add_liquidity", "open", "rebalance", "extend", "shrink",
        ];

        let primaryType = "unknown";
        let primaryLabel = "Transaction";
        let primaryIcon = "❓";

        for (const pType of priorityOrder) {
          if (foundTypes.includes(pType)) {
            const entry = Object.values(INSTRUCTION_MAP).find((v) => v.type === pType);
            if (entry) {
              primaryType = entry.type;
              primaryLabel = entry.label;
              primaryIcon = entry.icon;
            }
            break;
          }
        }

        activities.push({
          ...makeActivity(sigInfo, primaryType, primaryLabel, primaryIcon),
          fee: tx.meta.fee / 1e9,
        });
      } catch {
        activities.push(makeActivity(sigInfo, "unknown", "Unknown Transaction", "❓"));
      }
    }

    return NextResponse.json({ activities });
  } catch (err) {
    console.error("[Position-Activity] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch position activity" },
      { status: 500 }
    );
  }
}

function makeActivity(
  sigInfo: ConfirmedSignatureInfo,
  type: string,
  label: string,
  icon: string
): PositionActivity {
  return {
    signature: sigInfo.signature,
    blockTime: sigInfo.blockTime ?? null,
    type,
    label,
    icon,
    slot: sigInfo.slot,
    url: `https://solscan.io/tx/${sigInfo.signature}`,
    failed: sigInfo.err != null,
    fee: 0,
  };
}

/** Match instruction data to a known DLMM instruction via Anchor discriminator */
function matchInstruction(
  data: Uint8Array | Buffer | string,
  cache: Map<string, { type: string; label: string; icon: string }>
): { type: string; label: string; icon: string } | null {
  try {
    let bytes: Uint8Array;
    if (typeof data === "string") {
      bytes = base58ToBytes(data);
    } else {
      bytes = Uint8Array.from(data);
    }
    if (bytes.length < 8) return null;
    return cache.get(Buffer.from(bytes.slice(0, 8)).toString("hex")) || null;
  } catch {
    return null;
  }
}

/** Compute the Anchor discriminator: SHA256("global:<method_name>")[0..8] */
function computeAnchorDiscriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().slice(0, 8);
}

/** Simple base58 decoder */
function base58ToBytes(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = ALPHABET.indexOf(str[i]);
    for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
    bytes[0] += c;
    let carry = 0;
    for (let j = 0; j < bytes.length; ++j) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === "1"; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}