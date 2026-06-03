# World Cup Fantasy

A private no-paid-data fantasy draft app for the 2026 FIFA World Cup.

The first build is made for one host and a small friend group of up to 10 people. It includes league setup, invited members, draft order locking, a snake-style draft room, roster rule validation, manual score adjustments, and a leaderboard. OpenFootball is available for the tournament fixture skeleton, with hooks for API-Football and BALLDONTLIE free accounts to enrich rosters, lineups, events, and stats later.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Free data-first architecture

## Data Sources

- OpenFootball: fixtures, groups, dates, kickoff times, venues, and results.
- API-Football: free-tier live data, lineups, events, player stats, and injuries where available.
- BALLDONTLIE: World Cup rosters, matches, player stats, events, and standings where available.
- Admin dashboard: final source of truth for fantasy scoring corrections.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill in any keys you have:

```bash
API_FOOTBALL_KEY=
BALLDONTLIE_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

OpenFootball does not need an API key.

## Current Routes

- `/`: Private fantasy league app.
- `/api/data-sources/openfootball`: Fetches and normalizes the 2026 OpenFootball fixture JSON.
- `/api/data-sources/status`: Checks whether optional free API keys are configured.

## Next Build Steps

1. Add persistent storage with Supabase or a local Postgres database.
2. Create the OpenFootball import job and fixture table.
3. Add API-Football and BALLDONTLIE server clients.
4. Build league creation and draft rooms.
5. Build roster validation and scoring engine.
6. Add admin scoring review and override screens.

## Current MVP Behavior

- Host can rename the league.
- Host can add up to 10 members.
- Host can remove invited members before the draft order is locked.
- Draft order can be locked from the League tab.
- Draft tab shows the current drafter, snake order, player pool, and rosters.
- Draft picks enforce 6-player rosters, goalkeeper requirement, and national-team limits.
- Scores tab lets the host manually adjust player points and view the leaderboard.
- League state is saved in browser local storage for quick testing.

## Project Docs

- `docs/data-model.md`: table plan and source priority.
- `docs/supabase-schema.sql`: first-pass SQL schema for Supabase.
- `docs/supabase-rls.sql`: invite-code and Row Level Security setup.
- `docs/supabase-league-state.sql`: realtime room state table for the MVP.
- `docs/supabase-grants.sql`: Data API grants required when automatic table exposure is disabled.
- `docs/supabase-setup.md`: Supabase environment and database setup notes.
