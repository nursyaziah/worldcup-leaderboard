-- Migration 2: proper login (Supabase Auth, email + password).
-- Run ONCE in the Supabase SQL Editor. Safe to re-run (idempotent).
-- After this, making/changing picks requires being signed in, and a
-- prediction can only be written by the account that owns the player.

alter table players add column if not exists auth_user_id uuid unique references auth.users(id);

drop policy if exists "add players" on players;
drop policy if exists "signup creates own player" on players;
drop policy if exists "claim or rename own player" on players;
create policy "signup creates own player" on players for insert to authenticated
  with check (auth_user_id = auth.uid());
-- lets a signed-in user adopt a pre-login player row (created before this
-- migration) by name, or rename their own
create policy "claim or rename own player" on players for update to authenticated
  using (auth_user_id is null or auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists "predict before kickoff" on predictions;
drop policy if exists "repredict before kickoff" on predictions;
drop policy if exists "own predictions before kickoff" on predictions;
drop policy if exists "own repredictions before kickoff" on predictions;
create policy "own predictions before kickoff" on predictions for insert to authenticated
  with check (
    exists (select 1 from players p where p.id = player_id and p.auth_user_id = auth.uid())
    and exists (select 1 from matches m where m.id = match_id
      and m.kickoff_at > now() and m.status = 'upcoming'));
create policy "own repredictions before kickoff" on predictions for update to authenticated
  using (
    exists (select 1 from players p where p.id = predictions.player_id and p.auth_user_id = auth.uid())
    and exists (select 1 from matches m where m.id = predictions.match_id
      and m.kickoff_at > now() and m.status = 'upcoming'));
