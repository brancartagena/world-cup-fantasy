create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  draft_starts_at timestamptz,
  draft_order_locked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fifa_code text,
  group_name text,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid not null references public.teams(id),
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  api_football_id text,
  balldontlie_id text,
  created_at timestamptz not null default now()
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  external_source text not null,
  external_id text not null,
  round text not null,
  group_name text,
  home_team text not null,
  away_team text not null,
  venue text,
  starts_on date not null,
  kickoff_label text,
  created_at timestamptz not null default now(),
  unique (external_source, external_id)
);

create table public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid references public.players(id),
  pick_number integer not null,
  status text not null check (status in ('pending', 'made', 'skipped', 'autopicked')),
  made_at timestamptz,
  unique (league_id, pick_number)
);

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_id uuid references public.players(id),
  team_id uuid references public.teams(id),
  event_type text not null,
  minute integer,
  external_source text not null,
  external_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.fantasy_scores (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_id uuid not null references public.players(id),
  points integer not null,
  reason text not null,
  source text not null,
  approved_by_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  request_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
