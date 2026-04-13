import { NextRequest, NextResponse } from "next/server";
import { DLMM_DATA_API_BASE, DEFAULT_PAGE_SIZE, DEFAULT_SORT_BY } from "@/lib/constants";
import { logger } from "@/lib/logger";

// ---------- In-memory cache ----------
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(params: URLSearchParams): string {
  return params.toString();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Build query params for Meteora API
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("page_size") || String(DEFAULT_PAGE_SIZE);
    const query = searchParams.get("query") || "";
    const sortBy = searchParams.get("sort_by") || DEFAULT_SORT_BY;
    let filterBy = searchParams.get("filter_by") || "";

    // Always exclude blacklisted pools
    if (filterBy) {
      if (!filterBy.includes("is_blacklisted")) {
        filterBy += " && is_blacklisted=false";
      }
    } else {
      filterBy = "is_blacklisted=false";
    }

    const apiParams = new URLSearchParams();
    apiParams.set("page", page);
    apiParams.set("page_size", pageSize);
    if (query) apiParams.set("query", query);
    if (sortBy) apiParams.set("sort_by", sortBy);
    if (filterBy) apiParams.set("filter_by", filterBy);

    // Check cache
    const cacheKey = getCacheKey(apiParams);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug("[Pools Discover] Cache hit for:", cacheKey);
      return NextResponse.json(cached.data);
    }

    // Fetch from Meteora Data API
    const url = `${DLMM_DATA_API_BASE}/pools?${apiParams.toString()}`;
    logger.debug("[Pools Discover] Fetching:", url);

    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("[Pools Discover] API error:", response.status, errorBody);
      return NextResponse.json(
        { error: `Meteora API returned ${response.status}`, details: errorBody },
        { status: response.status }
      );
    }

    const body = await response.json();

    // Cache the response
    cache.set(cacheKey, { data: body, timestamp: Date.now() });

    // Clean up old cache entries periodically (keep cache size bounded)
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (now - entry.timestamp > CACHE_TTL * 2) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json(body);
  } catch (err) {
    logger.error("[Pools Discover] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch pools" },
      { status: 500 }
    );
  }
}