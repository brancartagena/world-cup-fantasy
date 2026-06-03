-- Run this after docs/supabase-rls.sql.
-- This table stores the current small-group MVP draft state while the app uses
-- sample/free player data before the real tournament player table is populated.

create table if not exists public.league_states (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  draft_order jsonb not null default '[]'::jsonb,
  picks jsonb not null default '[]'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.league_states enable row level security;

drop policy if exists "league members can read league state" on public.league_states;
create policy "league members can read league state"
on public.league_states for select
to authenticated
using (
  public.is_league_member(league_id)
  or public.is_league_host(league_id)
);

drop policy if exists "hosts can create league state" on public.league_states;
create policy "hosts can create league state"
on public.league_states for insert
to authenticated
with check (public.is_league_host(league_id));

drop policy if exists "league members can update league state" on public.league_states;
create policy "league members can update league state"
on public.league_states for update
to authenticated
using (
  public.is_league_member(league_id)
  or public.is_league_host(league_id)
)
with check (
  public.is_league_member(league_id)
  or public.is_league_host(league_id)
);

drop trigger if exists set_league_states_updated_at on public.league_states;
drop function if exists public.set_updated_at();

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_league_states_updated_at
before update on public.league_states
for each row
execute function public.set_updated_at();
