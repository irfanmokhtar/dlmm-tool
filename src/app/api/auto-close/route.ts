import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { closePosition } from "@/lib/dlmm";
import bs58 from "bs58";

/**
 * POST /api/auto-close
 * 
 * Server-side handler that signs and sends close-position transactions
 * using the private key stored in env. This keeps the key server-only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { positionId, poolAddress, lowerBinId, upperBinId } = body;

    // Validate inputs
    if (!positionId || !poolAddress || lowerBinId == null || upperBinId == null) {
      return NextResponse.json(
        { error: "Missing required fields: positionId, poolAddress, lowerBinId, upperBinId" },
        { status: 400 }
      );
    }

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
    const userPubKey = keypair.publicKey;

    console.log(`[Auto-Close] Closing position ${positionId} for wallet ${userPubKey.toBase58()}`);

    // Build close transactions
    const transactions = await closePosition(
      connection,
      userPubKey,
      poolAddress,
      new PublicKey(positionId),
      lowerBinId,
      upperBinId
    );

    // Sign and send each transaction
    const signatures: string[] = [];
    for (const tx of transactions) {
      tx.feePayer = userPubKey;
      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;

      const signature = await sendAndConfirmTransaction(connection, tx, [keypair], {
        commitment: "confirmed",
      });
      signatures.push(signature);
      console.log(`[Auto-Close] Transaction confirmed: ${signature}`);
    }

    return NextResponse.json({
      success: true,
      signatures,
      message: `Position ${positionId} closed successfully`,
    });
  } catch (err) {
    console.error("[Auto-Close] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to close position" },
      { status: 500 }
    );
  }
}
