import { NextRequest, NextResponse } from "next/server";
import { DLMM_DATA_API_BASE } from "@/lib/constants";
import { logger } from "@/lib/logger";

// ---------- In-memory cache ----------
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json(
        { error: "Missing pool address" },
        { status: 400 }
      );
    }

    // Check cache
    const cached = cache.get(address);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Fetch from Meteora Data API
    const url = `${DLMM_DATA_API_BASE}/pools/${encodeURIComponent(address)}`;
    logger.debug("[Pool Detail] Fetching:", url);

    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("[Pool Detail] API error:", response.status, errorBody);
      return NextResponse.json(
        { error: `Meteora API returned ${response.status}`, details: errorBody },
        { status: response.status }
      );
    }

    const body = await response.json();

    // Cache the response
    cache.set(address, { data: body, timestamp: Date.now() });

    return NextResponse.json(body);
  } catch (err) {
    logger.error("[Pool Detail] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch pool" },
      { status: 500 }
    );
  }
}