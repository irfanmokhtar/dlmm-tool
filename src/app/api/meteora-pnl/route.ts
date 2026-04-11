import { NextRequest, NextResponse } from "next/server";

const METEORA_PNL_BASE = "https://dlmm.datapi.meteora.ag";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolAddress = searchParams.get("poolAddress");
    const user = searchParams.get("user");
    const status = searchParams.get("status") || "all";
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("page_size") || "100";

    if (!poolAddress || !user) {
      return NextResponse.json(
        { error: "Missing required query params: poolAddress and user" },
        { status: 400 }
      );
    }

    const query = new URLSearchParams({
      user,
      status,
      page,
      page_size: pageSize,
    });

    const url = `${METEORA_PNL_BASE}/positions/${encodeURIComponent(poolAddress)}/pnl?${query.toString()}`;
    const response = await fetch(url);
    const body = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: body?.message || "Failed to fetch Meteora position PnL" },
        { status: response.status }
      );
    }

    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch Meteora position PnL" },
      { status: 500 }
    );
  }
}
