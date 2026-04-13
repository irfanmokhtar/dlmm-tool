import { NextResponse } from "next/server";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const CACHE_TTL = 60_000; // 60 seconds
let cachedPrice = 0;
let cachedAt = 0;

export async function GET() {
  const now = Date.now();
  if (cachedPrice > 0 && now - cachedAt < CACHE_TTL) {
    return NextResponse.json({ price: cachedPrice });
  }

  try {
    const apiKey = process.env.JUPITER_API_KEY;
    const headers: Record<string, string> = {};
    if (apiKey) headers["x-api-key"] = apiKey;

    const res = await fetch(
      `https://api.jup.ag/price/v3?ids=${SOL_MINT}`,
      { headers }
    );

    if (!res.ok) throw new Error(`Jupiter API returned ${res.status}`);

    const data = await res.json();
    const price = data?.[SOL_MINT]?.usdPrice;

    if (price && price > 0) {
      cachedPrice = price;
      cachedAt = now;
      return NextResponse.json({ price });
    }

    throw new Error("Invalid price data");
  } catch (err) {
    console.error("[Sol-Price] Failed to fetch:", err);
    // Return cached price even if stale, or 0
    return NextResponse.json({ price: cachedPrice });
  }
}