import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "token-metadata-cache.json");
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes (prevents refresh spam, keeps prices fresh)

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function loadCache(): Record<string, { data: any, timestamp: number }> {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveCache(cache: Record<string, { data: any, timestamp: number }>) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mints = searchParams.get("mints");

  if (!mints) {
    return NextResponse.json({ error: "Missing mints parameter" }, { status: 400 });
  }

  const mintArray = mints.split(",");
  const cache = loadCache();
  const now = Date.now();
  
  // Check if we have requested mints in cache and they are fresh
  const cachedData: any[] = [];
  const missingMints: string[] = [];

  mintArray.forEach(mint => {
    // Solana addresses are case-sensitive, but let's be careful
    const entry = cache[mint];
    const isFresh = entry && (now - entry.timestamp < CACHE_TTL);

    if (isFresh) {
      cachedData.push(entry.data);
    } else {
      missingMints.push(mint);
    }
  });

  if (missingMints.length === 0) {
    logger.debug(`[Proxy] Metadata cache hit for: ${mints}`);
    return NextResponse.json(cachedData);
  }

  const apiKey = process.env.JUPITER_API_KEY;

  try {
    const query = missingMints.join(",");
    const url = `https://api.jup.ag/tokens/v2/search?query=${query}`;
    logger.debug(`[Proxy] Metadata cache miss for: ${query}. Fetching...`);

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey || "",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[Proxy] Jupiter API error: ${response.status} - ${errorText}`);
      
      if (cachedData.length > 0) return NextResponse.json(cachedData);

      return NextResponse.json(
        { error: `Jupiter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const newData = await response.json();
    
    // Update cache with new results
    if (Array.isArray(newData)) {
      const foundIds = new Set<string>();
      newData.forEach(token => {
        const id = token.id || token.address;
        if (id) {
          cache[id] = { data: token, timestamp: now };
          foundIds.add(id);
        }
      });

      // Handle missing tokens: If Jupiter didn't return them, 
      // cache a null/placeholder for a shorter time to avoid spamming for things that don't exist
      missingMints.forEach(m => {
        if (!foundIds.has(m)) {
            logger.warn(`[Proxy] Jupiter returned no metadata for: ${m}`);
            // Cache null with a 1-hour "forget" TTL to stop spamming invalid mints
            cache[m] = { data: { id: m, symbol: m.slice(0, 4), icon: "" }, timestamp: now + (CACHE_TTL * 6) };
        }
      });

      saveCache(cache);
    }

    // Combine cached and fresh data
    const finalData = [...cachedData, ...newData];
    return NextResponse.json(finalData);
  } catch (error) {
    logger.error("[Proxy] Token metadata fetch failed:", error);
    if (cachedData.length > 0) return NextResponse.json(cachedData);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
