export const dataSources = [
  {
    name: "OpenFootball",
    cost: "Free",
    status: "Primary fixture seed",
    useFor:
      "Groups, fixtures, dates, kickoff times, venues, and eventual results from the public JSON repository.",
  },
  {
    name: "API-Football",
    cost: "Free tier",
    status: "Needs API key",
    useFor:
      "Live score checks, events, lineups, injuries, and player statistics when the free tier includes World Cup 2026 coverage.",
  },
  {
    name: "BALLDONTLIE",
    cost: "Free account",
    status: "Needs API key",
    useFor:
      "World Cup rosters, player stats, match events, standings, and backup validation for fantasy scoring.",
  },
  {
    name: "Admin review",
    cost: "Manual",
    status: "Required",
    useFor:
      "Final scoring corrections when free sources disagree, lag, or omit assists, saves, cards, and suspensions.",
  },
];

export const draftRules = [
  { label: "Draft order", value: "Randomized 15 min before draft" },
  { label: "Roster size", value: "6 players" },
  { label: "Required positions", value: "At least 1 goalkeeper" },
  { label: "Nation limit", value: "Max 2 players per national team" },
  { label: "Second same-nation pick", value: "Only allowed on final pick" },
  { label: "Pick timer", value: "2 minutes" },
];

export const scoringRules = [
  { event: "Goal", points: "+3" },
  { event: "Assist", points: "+1" },
  { event: "Save", points: "+1 per 3 saves" },
  { event: "Clean sheet", points: "+1" },
  { event: "Red card", points: "-2" },
  { event: "Team win", points: "+1" },
  { event: "Semi-final victory", points: "+2" },
  { event: "Final victory", points: "+3" },
  { event: "Suspension rule", points: "No team-win points" },
];

export const syncPlan = [
  {
    stage: "Before tournament",
    action:
      "Import OpenFootball fixtures once per day, then freeze local IDs for draft and scoring references.",
  },
  {
    stage: "Matchday",
    action:
      "Use free API calls sparingly: pre-match lineups, live/post-match events, then a late correction sync.",
  },
  {
    stage: "After matches",
    action:
      "Normalize events into fantasy scores, flag conflicts, and let an admin approve or override totals.",
  },
];

export const openFootballWorldCup2026Url =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
