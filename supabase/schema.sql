-- World Cup 2026 Prediction Leaderboard — full schema + seed data.
-- Run this ONCE in the Supabase SQL Editor of a fresh project.

create table matches (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,          -- football-data.org match id, filled by the sync job
  round text not null check (round in ('R32','R16','QF','SF','F')),
  team_a text not null default 'TBD',
  team_b text not null default 'TBD',
  kickoff_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming','locked','completed')),
  result text check (result in ('team_a','team_b')),
  score_a int,                      -- regulation (90') full-time score
  score_b int,
  result_source text check (result_source in ('api','manual')),
  teams_source text not null default 'seed' check (teams_source in ('seed','api','manual')),
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  auth_user_id uuid unique references auth.users(id),
  created_at timestamptz not null default now()
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  pick text not null check (pick in ('team_a','team_b')),
  predicted_score_a int check (predicted_score_a between 0 and 99),
  predicted_score_b int check (predicted_score_b between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, match_id)
);

-- RLS: trusted-group model per the PRD. Everyone (anon key) can read everything
-- and manage players/predictions; match edits also go through the anon key and
-- are gated by the admin PIN in the UI only. The one hard server-side rule:
-- predictions cannot be created or changed once the match has kicked off.
alter table matches enable row level security;
alter table players enable row level security;
alter table predictions enable row level security;

create policy "read matches"  on matches  for select using (true);
create policy "write matches" on matches  for all using (true) with check (true);
create policy "read players"  on players  for select using (true);
create policy "signup creates own player" on players for insert to authenticated
  with check (auth_user_id = auth.uid());
create policy "claim or rename own player" on players for update to authenticated
  using (auth_user_id is null or auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
create policy "read predictions" on predictions for select using (true);
create policy "own predictions before kickoff" on predictions for insert to authenticated
  with check (
    exists (select 1 from players p where p.id = player_id and p.auth_user_id = auth.uid())
    and exists (select 1 from matches m
      where m.id = match_id and m.kickoff_at > now() and m.status = 'upcoming'));
create policy "own repredictions before kickoff" on predictions for update to authenticated
  using (
    exists (select 1 from players p where p.id = predictions.player_id and p.auth_user_id = auth.uid())
    and exists (select 1 from matches m
      where m.id = predictions.match_id and m.kickoff_at > now() and m.status = 'upcoming'));

create or replace function set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
create trigger predictions_updated before update on predictions
  for each row execute function set_updated_at();

-- Seed: 8 Round of 16 slots. Team names below are PLACEHOLDERS from Syaz's
-- notes on July 3 — confirm/edit them in the admin panel, or let the sync job
-- overwrite them once the football-data.org token is configured.
-- Kickoff times are also placeholders (stored UTC; app displays SGT) — the
-- sync job corrects them automatically, or edit in admin.
insert into matches (round, team_a, team_b, kickoff_at) values
  ('R16', 'Canada', 'Morocco', '2026-07-04 16:00:00+00'),
  ('R16', 'USA',    'Belgium', '2026-07-04 20:00:00+00'),
  ('R16', 'Brazil', 'Norway',  '2026-07-05 16:00:00+00'),
  ('R16', 'TBD',    'TBD',     '2026-07-05 20:00:00+00'),
  ('R16', 'TBD',    'TBD',     '2026-07-06 16:00:00+00'),
  ('R16', 'TBD',    'TBD',     '2026-07-06 20:00:00+00'),
  ('R16', 'TBD',    'TBD',     '2026-07-07 16:00:00+00'),
  ('R16', 'TBD',    'TBD',     '2026-07-07 20:00:00+00');
