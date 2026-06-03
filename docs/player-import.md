# Player Import

The draft screen now reads from Supabase `players` joined to `teams`. If the table is empty, the app falls back to the temporary sample player list.

## Ready-To-Run Files

The uploaded FIFA squad PDF has been converted into:

- `docs/world-cup-2026-players.csv`
- `docs/world-cup-2026-players.sql`

The extraction produced:

- 48 teams
- 1,248 players
- 26 players per team

The easiest path is to run `docs/world-cup-2026-players.sql` in Supabase SQL Editor. It replaces the current `teams` and `players` rows, then inserts the full player pool.

After running it, refresh the app. The Player Pool should show the imported World Cup players instead of the sample list.

## CSV Format

Use this template:

```txt
docs/player-import-template.csv
```

Required columns:

- `name`
- `team`
- `position`

Optional columns:

- `fifa_code`
- `group_name`
- `api_football_id`
- `balldontlie_id`

Valid positions:

- `GK`
- `DEF`
- `MID`
- `FWD`

## Import Command

Use a service role key locally only. Do not commit it and do not expose it in the browser.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://kbysbxnpvkxywvkackle.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
node scripts/import-players.mjs ./players.csv
```

After import, refresh the app. The Player Pool should show the imported World Cup players instead of the sample list.

## Source Note

FIFA published the final 2026 World Cup squad lists on June 2, 2026. Use FIFA or another roster source to produce `players.csv`, then run the importer.
