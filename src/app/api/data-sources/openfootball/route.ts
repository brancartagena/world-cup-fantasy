import { NextResponse } from "next/server";

import { fetchOpenFootballWorldCup2026 } from "@/lib/openfootball";

export async function GET() {
  try {
    const tournament = await fetchOpenFootballWorldCup2026();

    return NextResponse.json({
      source: "openfootball",
      syncedAt: new Date().toISOString(),
      fixtureCount: tournament.fixtures.length,
      tournament,
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: "openfootball",
        error:
          error instanceof Error
            ? error.message
            : "Unknown OpenFootball sync error",
      },
      { status: 502 },
    );
  }
}
