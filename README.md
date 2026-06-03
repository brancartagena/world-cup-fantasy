# World Cup Fantasy

A private no-paid-data fantasy draft app for the 2026 FIFA World Cup.

The app is made for one host and a small friend group of up to 10 people. It includes Supabase-backed room creation, invite codes, live member updates, draft order locking, turn-based snake drafting, roster rule validation, timer auto-picks, generated draft sound effects, manual score adjustments, a leaderboard, and a World Cup Match Center.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase
- Free data-first architecture

## Data Sources

- Official FIFA source material: player names, national teams, and roles were extracted from the uploaded FIFA World Cup 2026 player PDF from the FIFA official site.
- OpenFootball: fixtures, groups, dates, kickoff times, venues, and results.
- API-Football: live match data where your plan allows it. The app keeps the key server-side and falls back to OpenFootball for the 2026 schedule if API-Football blocks the season on the free plan.
- Host review: final source of truth for fantasy scoring corrections while free live data is limited.

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
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

OpenFootball does not need an API key.

## Current Routes

- `/`: Private fantasy league app.
- `/api/data-sources/openfootball`: Fetches and normalizes the 2026 OpenFootball fixture JSON.
- `/api/data-sources/status`: Checks whether optional free API keys are configured.
- `/api/world-cup/matches`: Fetches World Cup schedule/live data for the Match Center without exposing API keys to the browser.

## Next Build Steps

1. Build automatic scoring sync once a free or acceptable live event source is available.
2. Add transfer windows for Round of 16, semi-final, and final stages while preserving existing scores.
3. Add host scoring review and override screens.
4. Import or sync fixture results into Supabase for historical scorekeeping.

## Current MVP Behavior

- Host can create a private room and share an invite code.
- Friends can join from another device and see live room/draft updates.
- Host can remove invited members before the draft order is locked.
- Non-host members can leave a room and are removed from the member count.
- Draft order can be locked from the League tab.
- Lock draft, pick advancement, and draft completion have generated sound effects with a Sound On/Off toggle.
- Draft tab shows the current drafter, snake order, player pool, and rosters.
- Draft picks enforce 6-player rosters, goalkeeper requirement, and national-team limits.
- If a user does not pick within 2 minutes, the app auto-picks a valid player and advances the draft.
- Once all members finish picking, rosters are locked and the Lock Draft Order button is replaced with a completed status.
- Scores tab lets the host manually adjust player points and view the leaderboard.
- The Match Center shows the 2026 schedule and tries API-Football live data when the configured plan allows it.
- League membership, draft state, and scores are stored in Supabase.

## Project Docs

- `docs/data-model.md`: table plan and source priority.
- `docs/supabase-schema.sql`: first-pass SQL schema for Supabase.
- `docs/supabase-rls.sql`: invite-code and Row Level Security setup.
- `docs/supabase-league-state.sql`: realtime room state table for the MVP.
- `docs/supabase-grants.sql`: Data API grants required when automatic table exposure is disabled.
- `docs/supabase-realtime.sql`: enables live updates for room membership and draft/scores state.
- `docs/supabase-setup.md`: Supabase environment and database setup notes.
- `docs/player-import.md`: instructions for importing full World Cup squads into Supabase.
- `docs/world-cup-2026-players.csv`: extracted 48-team player pool from the uploaded FIFA official squad PDF.
- `docs/world-cup-2026-players.sql`: SQL import file for Supabase.
