import { NextRequest, NextResponse } from "next/server";
import { POOL_DISCOVERY_API_BASE } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const pageSize = searchParams.get("page_size") || "50";
    const page = searchParams.get("page") || "1";
    const query = searchParams.get("query") || "";
    const timeframe = searchParams.get("timeframe") || "24h";
    const category = searchParams.get("category") || "trending";
    const sortBy = searchParams.get("sort_by") || "";
    const filterBy = searchParams.get("filter_by") || "";

    const params = new URLSearchParams({
      page_size: pageSize,
      page,
      timeframe,
      category,
    });

    if (query) params.set("query", query);
    if (sortBy) params.set("sort_by", sortBy);
    if (filterBy) params.set("filter_by", filterBy);

    const url = `${POOL_DISCOVERY_API_BASE}/pools?${params.toString()}`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Pool Discovery] API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Pool Discovery API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[Pool Discovery] Failed to fetch:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch pools" },
      { status: 500 }
    );
  }
}