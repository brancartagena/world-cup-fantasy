import "server-only";

const apiFootballBaseUrl = "https://v3.football.api-sports.io";
const worldCupLeagueId = 1;
const worldCupSeason = 2026;

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: {
      elapsed: number | null;
      long: string;
      short: string;
    };
    venue: {
      city: string | null;
      name: string | null;
    };
  };
  goals: {
    away: number | null;
    home: number | null;
  };
  league: {
    round: string;
  };
  teams: {
    away: {
      logo: string;
      name: string;
    };
    home: {
      logo: string;
      name: string;
    };
  };
};

export type WorldCupMatch = {
  awayTeam: string;
  awayTeamLogo: string;
  awayGoals: number | null;
  date: string;
  elapsed: number | null;
  fixtureId: number | string;
  homeTeam: string;
  homeTeamLogo: string;
  homeGoals: number | null;
  round: string;
  status: string;
  statusShort: string;
  venue: string;
};

export async function fetchWorldCupMatches() {
  return fetchApiFootballFixtures(
    new URLSearchParams({
      league: String(worldCupLeagueId),
      season: String(worldCupSeason),
    }),
  );
}

export async function fetchWorldCupLiveMatches() {
  return fetchApiFootballFixtures(
    new URLSearchParams({
      league: String(worldCupLeagueId),
      live: "all",
    }),
  );
}

export async function fetchWorldCupScheduleAndLive() {
  const [schedule, live] = await Promise.all([
    fetchWorldCupMatches(),
    fetchWorldCupLiveMatches(),
  ]);

  return {
    live,
    schedule: schedule.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  };
}

async function fetchApiFootballFixtures(params: URLSearchParams) {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    throw new Error("Missing API_FOOTBALL_KEY.");
  }

  const response = await fetch(`${apiFootballBaseUrl}/fixtures?${params}`, {
    headers: {
      "x-apisports-key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    errors?: unknown;
    response?: ApiFootballFixture[];
  };

  if (hasApiErrors(payload.errors)) {
    throw new Error(`API-Football returned an error: ${formatApiErrors(payload.errors)}`);
  }

  return (payload.response ?? []).map(normalizeFixture);
}

function normalizeFixture(match: ApiFootballFixture): WorldCupMatch {
  const venue = [match.fixture.venue.name, match.fixture.venue.city]
    .filter(Boolean)
    .join(", ");

  return {
    awayGoals: match.goals.away,
    awayTeam: match.teams.away.name,
    awayTeamLogo: match.teams.away.logo,
    date: match.fixture.date,
    elapsed: match.fixture.status.elapsed,
    fixtureId: match.fixture.id,
    homeGoals: match.goals.home,
    homeTeam: match.teams.home.name,
    homeTeamLogo: match.teams.home.logo,
    round: match.league.round,
    status: match.fixture.status.long,
    statusShort: match.fixture.status.short,
    venue,
  };
}

function hasApiErrors(errors: unknown) {
  if (!errors) {
    return false;
  }

  if (Array.isArray(errors)) {
    return errors.length > 0;
  }

  if (typeof errors === "object") {
    return Object.keys(errors).length > 0;
  }

  return true;
}

function formatApiErrors(errors: unknown) {
  if (typeof errors === "string") {
    return errors;
  }

  return JSON.stringify(errors).slice(0, 300);
}
