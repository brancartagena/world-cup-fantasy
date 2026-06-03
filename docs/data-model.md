# World Cup Fantasy Data Model

This MVP should cache every external source in our database. The app should never depend on a live third-party request to render a league, draft room, roster, or leaderboard.

## Core Tables

- `users`: app profile linked to auth provider.
- `leagues`: fantasy league settings, draft time, and scoring mode.
- `league_members`: users inside a league.
- `drafts`: one draft per league.
- `draft_picks`: ordered selections, skipped picks, and autopicks.
- `teams`: national teams with external source IDs.
- `players`: tournament player pool with team, position, and external source IDs.
- `fixtures`: World Cup matches imported from OpenFootball.
- `lineups`: starters and benches from free data APIs where available.
- `match_events`: goals, assists, cards, substitutions, saves, and other source events.
- `player_match_stats`: normalized player stat totals per fixture.
- `fantasy_rosters`: current drafted squads.
- `fantasy_scores`: calculated point rows with source and admin approval status.
- `suspensions`: red-card suspension windows and manual overrides.
- `sync_runs`: every import attempt, request count, status, and error details.

## Source Priority

1. Admin-approved scoring overrides.
2. BALLDONTLIE World Cup event/player data.
3. API-Football live events and stats.
4. OpenFootball fixtures and results.

## Scoring Notes

- Keep raw source events even after normalization.
- Recalculate fantasy scores after a sync or admin edit.
- Store every scoring row with `reason`, `points`, `fixture_id`, `player_id`, and `source`.
- Suspended players keep individual points from matches they play, but receive no team-win points during suspension.
