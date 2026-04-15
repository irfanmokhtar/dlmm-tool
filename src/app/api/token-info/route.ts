import { NextRequest, NextResponse } from "next/server";
import { JUPITER_DATA_API_BASE } from "@/lib/constants";

// Cache token info (including global fees) for 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mints = searchParams.get("mints");

  if (!mints) {
    return NextResponse.json({ error: "Missing mints parameter" }, { status: 400 });
  }

  const mintArray = mints.split(",").filter(Boolean);
  const now = Date.now();
  const results: any[] = [];
  const missing: string[] = [];

  // Check cache first
  for (const mint of mintArray) {
    const entry = cache.get(mint);
    if (entry && now - entry.timestamp < CACHE_TTL) {
      results.push(entry.data);
    } else {
      missing.push(mint);
    }
  }

  if (missing.length === 0) {
    return NextResponse.json(results);
  }

  // Fetch missing mints from Jupiter Data API
  // The /assets/search endpoint accepts a query but we need per-mint data.
  // We'll fetch each mint individually for accuracy.
  const apiKey = process.env.JUPITER_API_KEY;

  for (const mint of missing) {
    try {
      const url = `${JUPITER_DATA_API_BASE}/assets/search?query=${encodeURIComponent(mint)}`;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) headers["x-api-key"] = apiKey;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        results.push({ mint, global_fees_sol: null, error: `Jupiter API ${res.status}` });
        continue;
      }

      const data = await res.json();
      const tokens = Array.isArray(data) ? data : [data];
      const token = tokens.find((t: any) => t.id === mint) || tokens[0];

      if (!token) {
        results.push({ mint, global_fees_sol: null });
        continue;
      }

      const entry = {
        mint: token.id,
        symbol: token.symbol ?? token.ticker ?? null,
        name: token.name ?? null,
        global_fees_sol: token.fees != null ? parseFloat(token.fees) : null,
        holders: token.holderCount ?? null,
        organic_score: token.organicScore ?? null,
      };

      cache.set(mint, { data: entry, timestamp: now });
      results.push(entry);
    } catch (err) {
      results.push({ mint, global_fees_sol: null, error: String(err) });
    }
  }

  return NextResponse.json(results);
}