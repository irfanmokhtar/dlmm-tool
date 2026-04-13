import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL = 60_000; // 60 seconds
const priceCache = new Map<string, { price: number; updatedAt: number }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids");

  if (!ids) {
    return NextResponse.json({ error: "Missing required param: ids" }, { status: 400 });
  }

  const mintList = ids.split(",").map((s) => s.trim()).filter(Boolean);
  if (mintList.length === 0 || mintList.length > 50) {
    return NextResponse.json({ error: "ids must contain 1-50 comma-separated mints" }, { status: 400 });
  }

  // Check which prices are cached and still fresh
  const now = Date.now();
  const result: Record<string, number> = {};
  const uncached: string[] = [];

  for (const mint of mintList) {
    const cached = priceCache.get(mint);
    if (cached && cached.price > 0 && now - cached.updatedAt < CACHE_TTL) {
      result[mint] = cached.price;
    } else {
      uncached.push(mint);
    }
  }

  // Fetch uncached prices from Jupiter
  if (uncached.length > 0) {
    try {
      const apiKey = process.env.JUPITER_API_KEY;
      const headers: Record<string, string> = {};
      if (apiKey) headers["x-api-key"] = apiKey;

      const res = await fetch(
        `https://api.jup.ag/price/v3?ids=${uncached.join(",")}`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        for (const mint of uncached) {
          const usdPrice = data?.[mint]?.usdPrice;
          if (usdPrice && usdPrice > 0) {
            result[mint] = usdPrice;
            priceCache.set(mint, { price: usdPrice, updatedAt: now });
          }
        }
      } else {
        console.error("[Token-Prices] Jupiter API returned", res.status);
      }
    } catch (err) {
      console.error("[Token-Prices] Failed to fetch:", err);
    }
  }

  return NextResponse.json({ prices: result });
}