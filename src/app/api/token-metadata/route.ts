import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mints = searchParams.get("mints");

  if (!mints) {
    return NextResponse.json({ error: "Missing mints parameter" }, { status: 400 });
  }

  const apiKey = process.env.JUPITER_API_KEY;

  try {
    const url = `https://api.jup.ag/tokens/v2/search?query=${mints}`;
    console.log(`[Proxy] Fetching token metadata for: ${mints}`);

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey || "",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy] Jupiter API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Jupiter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Proxy] Token metadata fetch failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
