import { openFootballWorldCup2026Url } from "./fantasy-config";

export type OpenFootballMatch = {
  round: string;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
  score?: {
    ft?: [number, number];
    ht?: [number, number];
    et?: [number, number];
    p?: [number, number];
  };
};

export type OpenFootballWorldCup = {
  name: string;
  matches: OpenFootballMatch[];
};

export type NormalizedFixture = {
  externalId: string;
  round: string;
  date: string;
  kickoffLabel: string | null;
  homeTeam: string;
  awayTeam: string;
  group: string | null;
  venue: string | null;
  source: "openfootball";
};

export function normalizeOpenFootballFixture(
  match: OpenFootballMatch,
  index: number,
): NormalizedFixture {
  return {
    externalId: `openfootball-2026-${index + 1}`,
    round: match.round,
    date: match.date,
    kickoffLabel: match.time ?? null,
    homeTeam: match.team1,
    awayTeam: match.team2,
    group: match.group ?? null,
    venue: match.ground ?? null,
    source: "openfootball",
  };
}

export async function fetchOpenFootballWorldCup2026() {
  const response = await fetch(openFootballWorldCup2026Url, {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`OpenFootball sync failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenFootballWorldCup;

  return {
    name: data.name,
    fixtures: data.matches.map(normalizeOpenFootballFixture),
  };
}
