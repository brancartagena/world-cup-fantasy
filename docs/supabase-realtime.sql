-- Run this once to make Supabase send Realtime database-change events
-- for room membership and shared draft/scores state.
--
-- The app also has a 3-second polling fallback, but this makes turn changes
-- appear as quickly as Supabase can push them to each browser.

alter publication supabase_realtime add table public.league_members;
alter publication supabase_realtime add table public.league_states;
