# Supabase Setup

## Environment Variables

Use the base project URL, not the REST endpoint URL.

```txt
NEXT_PUBLIC_SUPABASE_URL=https://kbysbxnpvkxywvkackle.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

For Vercel, add these in:

```txt
Project Settings -> Environment Variables
```

## Database Tables

Open Supabase SQL Editor and run:

```txt
docs/supabase-schema.sql
```

This creates the first set of tables for leagues, members, teams, players, fixtures, draft picks, match events, fantasy scores, and sync runs.

Then run:

```txt
docs/supabase-rls.sql
```

This enables Row Level Security, adds invite-code fields, and creates the join-room function.

Then run:

```txt
docs/supabase-league-state.sql
```

This creates the shared realtime draft/scores state table for the first playable private-room MVP.

Finally run:

```txt
docs/supabase-grants.sql
```

This grants the Supabase API roles access to the tables. Row Level Security still controls which rows they can read or write.

For live room updates, run:

```txt
docs/supabase-realtime.sql
```

The app also polls every 3 seconds as a fallback, but Realtime makes draft turns and score updates appear faster.

## Auth

Enable anonymous auth so friends can join without creating accounts:

```txt
Authentication -> Sign In / Providers -> Anonymous sign-ins
```

Turn it on before wiring the app to real rooms.

## Room Flow

The next implementation step is to move the current local browser state into Supabase:

1. Host creates a league.
2. App generates an invite code.
3. Friends join with the invite code.
4. Draft picks are saved in Supabase.
5. Supabase Realtime pushes roster, pick, and score changes to everyone.
