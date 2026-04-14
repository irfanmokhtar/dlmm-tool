import { NextRequest, NextResponse } from "next/server";
import { POOL_DISCOVERY_API_BASE } from "@/lib/constants";

export async function GET(
  req: NextRequest,
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

    const url = `${POOL_DISCOVERY_API_BASE}/pools/${encodeURIComponent(address)}`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Pool Detail] API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Pool Detail API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[Pool Detail] Failed to fetch:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch pool detail" },
      { status: 500 }
    );
  }
}