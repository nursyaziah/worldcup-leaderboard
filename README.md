# ⚽ Aminah Headquaters — World Cup Prediction Game

Private World Cup 2026 prediction game for the Aminah HQ family group.
Pick winners for every knockout match (Round of 32 finale onwards), optionally
guess the exact score for bonus points, and watch the live leaderboard.

## Playing

- Open the app link (shared in the family group), **sign up** with your email
  and a password, and pick your leaderboard name.
- For each match, tap the team you think will go through; optionally add a
  90-minute score guess. You can change picks anytime **until kickoff**.
- Scoring: **+1** for picking the team that advances (extra time/penalties
  count), **+2 bonus** if your scoreline matches the 90-minute score exactly.
- Kickoff times shown in **SGT**. Leaderboard: 🥇🥈🥉 by total points.

## How it works

- **Frontend:** Vite + React, mobile-first, deployed to GitHub Pages on every
  push to `main` (`.github/workflows/deploy.yml`). Runtime config (Supabase
  URL, publishable key, admin PIN) is generated into `public/config.json` at
  deploy time from GitHub Actions secrets — **no keys are committed to the repo**.
- **Auth:** Supabase Auth (email + password). Row-level security ties every
  player row to its auth account — nobody can make or change picks for anyone
  else, and prediction lock at kickoff is enforced by the database itself.
- **Database:** Supabase Postgres. Fresh install: run `supabase/schema.sql`,
  then `supabase/migration-2-auth.sql` in the SQL Editor.
- **Results sync:** `scripts/sync.mjs` runs every ~5 min via GitHub Actions
  (`.github/workflows/sync.yml`), pulling matches from football-data.org and
  writing team names, kickoff times, and final results. Admin manual edits
  (`result_source` / `teams_source` = `manual`) are never overwritten.
- **Admin:** ⚙️ tab with shared PIN — edit matches, correct results, and copy
  a ready-to-paste WhatsApp update.

## Security

- All credentials live only in GitHub Actions **encrypted secrets**
  (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `FOOTBALL_DATA_TOKEN`, optional `ADMIN_PIN`).
- Repo hardening: branch protection on `main` (no force pushes/deletion),
  secret scanning with push protection, Dependabot alerts + auto security
  fixes, only GitHub-authored actions allowed, workflow tokens read-only by
  default.
- The repo must stay **public** (free GitHub Pages requires it); that's safe
  because it contains only code — no keys, no player data.

## Local dev

```bash
npm install
npm run dev     # needs a filled public/config.json (see deploy.yml for shape)
```
