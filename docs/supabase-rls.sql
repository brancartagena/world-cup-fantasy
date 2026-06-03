-- Run this after docs/supabase-schema.sql.
-- This setup assumes the app uses Supabase anonymous auth, so every visitor
-- gets an auth.uid() without needing an email/password account.

alter table public.leagues
  add column if not exists host_user_id uuid default auth.uid(),
  add column if not exists invite_code text unique,
  add column if not exists max_members integer not null default 10;

alter table public.league_members
  alter column user_id set default auth.uid(),
  add column if not exists is_host boolean not null default false;

create or replace function public.is_league_member(target_league_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members
    where league_id = target_league_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_league_host(target_league_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leagues
    where id = target_league_id
      and host_user_id = auth.uid()
  );
$$;

create or replace function public.join_league(join_code text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league_id uuid;
  member_count integer;
begin
  select id
  into target_league_id
  from public.leagues
  where invite_code = upper(trim(join_code));

  if target_league_id is null then
    raise exception 'Invalid invite code';
  end if;

  select count(*)
  into member_count
  from public.league_members
  where league_id = target_league_id;

  if member_count >= 10 then
    raise exception 'League is full';
  end if;

  insert into public.league_members (league_id, user_id, display_name)
  values (target_league_id, auth.uid(), trim(member_name))
  on conflict (league_id, user_id)
  do update set display_name = excluded.display_name;

  return target_league_id;
end;
$$;

grant execute on function public.join_league(text, text) to authenticated;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_host(uuid) to authenticated;

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.fixtures enable row level security;
alter table public.draft_picks enable row level security;
alter table public.match_events enable row level security;
alter table public.fantasy_scores enable row level security;
alter table public.sync_runs enable row level security;

drop policy if exists "public tournament teams are readable" on public.teams;
create policy "public tournament teams are readable"
on public.teams for select
to anon, authenticated
using (true);

drop policy if exists "public tournament players are readable" on public.players;
create policy "public tournament players are readable"
on public.players for select
to anon, authenticated
using (true);

drop policy if exists "public fixtures are readable" on public.fixtures;
create policy "public fixtures are readable"
on public.fixtures for select
to anon, authenticated
using (true);

drop policy if exists "public match events are readable" on public.match_events;
create policy "public match events are readable"
on public.match_events for select
to anon, authenticated
using (true);

drop policy if exists "authenticated users can create leagues" on public.leagues;
create policy "authenticated users can create leagues"
on public.leagues for insert
to authenticated
with check (host_user_id = auth.uid());

drop policy if exists "league members can read leagues" on public.leagues;
create policy "league members can read leagues"
on public.leagues for select
to authenticated
using (public.is_league_member(id) or host_user_id = auth.uid());

drop policy if exists "hosts can update leagues" on public.leagues;
create policy "hosts can update leagues"
on public.leagues for update
to authenticated
using (host_user_id = auth.uid())
with check (host_user_id = auth.uid());

drop policy if exists "hosts can add members" on public.league_members;
create policy "hosts can add members"
on public.league_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_league_host(league_id)
);

drop policy if exists "league members can read members" on public.league_members;
create policy "league members can read members"
on public.league_members for select
to authenticated
using (public.is_league_member(league_id) or public.is_league_host(league_id));

drop policy if exists "hosts can update members" on public.league_members;
create policy "hosts can update members"
on public.league_members for update
to authenticated
using (public.is_league_host(league_id))
with check (public.is_league_host(league_id));

drop policy if exists "hosts can remove members" on public.league_members;
create policy "hosts can remove members"
on public.league_members for delete
to authenticated
using (public.is_league_host(league_id));

drop policy if exists "league members can read draft picks" on public.draft_picks;
create policy "league members can read draft picks"
on public.draft_picks for select
to authenticated
using (public.is_league_member(league_id) or public.is_league_host(league_id));

drop policy if exists "league members can make draft picks" on public.draft_picks;
create policy "league members can make draft picks"
on public.draft_picks for insert
to authenticated
with check (public.is_league_member(league_id) or public.is_league_host(league_id));

drop policy if exists "hosts can update draft picks" on public.draft_picks;
create policy "hosts can update draft picks"
on public.draft_picks for update
to authenticated
using (public.is_league_host(league_id))
with check (public.is_league_host(league_id));

drop policy if exists "league members can read fantasy scores" on public.fantasy_scores;
create policy "league members can read fantasy scores"
on public.fantasy_scores for select
to authenticated
using (public.is_league_member(league_id) or public.is_league_host(league_id));

drop policy if exists "hosts can create fantasy scores" on public.fantasy_scores;
create policy "hosts can create fantasy scores"
on public.fantasy_scores for insert
to authenticated
with check (public.is_league_host(league_id));

drop policy if exists "hosts can update fantasy scores" on public.fantasy_scores;
create policy "hosts can update fantasy scores"
on public.fantasy_scores for update
to authenticated
using (public.is_league_host(league_id))
with check (public.is_league_host(league_id));

drop policy if exists "authenticated users can read sync status" on public.sync_runs;
create policy "authenticated users can read sync status"
on public.sync_runs for select
to authenticated
using (true);
