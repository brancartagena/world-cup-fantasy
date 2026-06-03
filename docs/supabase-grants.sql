-- Run this after the schema, RLS, and league state SQL files.
-- RLS still decides which rows users can access. These grants only allow the
-- Supabase Data API roles to attempt the operations covered by the policies.

grant usage on schema public to anon, authenticated;

grant select on public.teams to anon, authenticated;
grant select on public.players to anon, authenticated;
grant select on public.fixtures to anon, authenticated;
grant select on public.match_events to anon, authenticated;

grant select, insert, update on public.leagues to authenticated;
grant select, insert, update, delete on public.league_members to authenticated;
grant select, insert, update on public.draft_picks to authenticated;
grant select, insert, update on public.fantasy_scores to authenticated;
grant select, insert, update on public.league_states to authenticated;
grant select on public.sync_runs to authenticated;

grant execute on function public.join_league(text, text) to authenticated;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_host(uuid) to authenticated;
