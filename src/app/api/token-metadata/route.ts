import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "token-metadata-cache.json");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
  
  // Check if we have ALL requested mints in cache and they are fresh
  const cachedData: any[] = [];
  const missingMints: string[] = [];

  mintArray.forEach(mint => {
    const entry = cache[mint];
    if (entry && (now - entry.timestamp < CACHE_TTL)) {
      cachedData.push(entry.data);
    } else {
      missingMints.push(mint);
    }
  });

  if (missingMints.length === 0) {
    return NextResponse.json(cachedData);
  }

  const apiKey = process.env.JUPITER_API_KEY;

  try {
    const query = missingMints.join(",");
    const url = `https://api.jup.ag/tokens/v2/search?query=${query}`;
    console.log(`[Proxy] Fetching token metadata for: ${query}`);

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey || "",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy] Jupiter API error: ${response.status} - ${errorText}`);
      
      // If we have some cached data, return it even if partial, or error if nothing
      if (cachedData.length > 0) return NextResponse.json(cachedData);

      return NextResponse.json(
        { error: `Jupiter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const newData = await response.json();
    
    // Update cache with new results
    if (Array.isArray(newData)) {
      newData.forEach(token => {
        const id = token.id || token.address;
        if (id) {
          cache[id] = { data: token, timestamp: now };
        }
      });
      saveCache(cache);
    }

    // Combine cached and fresh data
    return NextResponse.json([...cachedData, ...newData]);
  } catch (error) {
    console.error("[Proxy] Token metadata fetch failed:", error);
    if (cachedData.length > 0) return NextResponse.json(cachedData);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
