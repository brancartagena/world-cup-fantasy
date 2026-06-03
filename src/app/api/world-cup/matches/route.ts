import { NextResponse } from "next/server";

import {
  fetchWorldCupLiveMatches,
  fetchWorldCupMatches,
  type WorldCupMatch,
} from "@/lib/api-football";
import {
  fetchOpenFootballWorldCup2026,
  type NormalizedFixture,
} from "@/lib/openfootball";

const cacheTtlMs = 60_000;

let cachedMatches:
  | {
      refreshedAt: string;
      live: WorldCupMatch[];
      schedule: WorldCupMatch[];
    }
  | null = null;

export async function GET() {
  if (
    cachedMatches &&
    Date.now() - new Date(cachedMatches.refreshedAt).getTime() < cacheTtlMs
  ) {
    return NextResponse.json({
      cached: true,
      ...cachedMatches,
    });
  }

  try {
    const [scheduleResult, liveResult] = await Promise.allSettled([
      fetchWorldCupMatches(),
      fetchWorldCupLiveMatches(),
    ]);
    let schedule =
      scheduleResult.status === "fulfilled" ? scheduleResult.value : [];
    let scheduleFallbackError = "";

    if (!schedule.length) {
      try {
        const openFootball = await fetchOpenFootballWorldCup2026();
        schedule = openFootball.fixtures.map(openFootballToWorldCupMatch);
      } catch (error) {
        scheduleFallbackError = getErrorMessage(error);
      }
    }

    schedule = schedule.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const live = liveResult.status === "fulfilled" ? liveResult.value : [];
    const errors = [
      scheduleResult.status === "rejected" ? getErrorMessage(scheduleResult.reason) : "",
      scheduleFallbackError,
      liveResult.status === "rejected" ? getErrorMessage(liveResult.reason) : "",
    ].filter(Boolean);

    cachedMatches = {
      refreshedAt: new Date().toISOString(),
      live,
      schedule,
    };

    return NextResponse.json({
      cached: false,
      error: buildClientError(errors, schedule.length, live.length),
      providerErrors: errors,
      ...cachedMatches,
    });
  } catch (error) {
    return NextResponse.json(
      {
        cached: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown API-Football fixture error.",
        live: cachedMatches?.live ?? [],
        refreshedAt: cachedMatches?.refreshedAt ?? new Date().toISOString(),
        schedule: cachedMatches?.schedule ?? [],
      },
      { status: 502 },
    );
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown API-Football fixture error.";
}

function buildClientError(errors: string[], scheduleCount: number, liveCount: number) {
  if (!errors.length) {
    return "";
  }

  if (scheduleCount > 0 && liveCount === 0) {
    return "Showing the free OpenFootball schedule. Live match data is not available from the configured free API plans yet.";
  }

  return errors.join(" ");
}

function openFootballToWorldCupMatch(fixture: NormalizedFixture): WorldCupMatch {
  return {
    awayGoals: null,
    awayTeam: fixture.awayTeam,
    awayTeamLogo: "",
    date: fixture.date,
    elapsed: null,
    fixtureId: fixture.externalId,
    homeGoals: null,
    homeTeam: fixture.homeTeam,
    homeTeamLogo: "",
    round: fixture.group ?? fixture.round,
    status: "Scheduled",
    statusShort: "NS",
    venue: fixture.venue ?? "",
  };
}
