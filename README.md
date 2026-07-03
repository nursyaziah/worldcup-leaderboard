# ⚽ World Cup 2026 Family Prediction Leaderboard

Private prediction game for family & friends for the 2026 World Cup knockout
rounds. Pick winners, optionally guess exact scores, watch the live leaderboard.

**Live app:** https://nursyaziah.github.io/worldcup-leaderboard/
**Setting it up?** See [WAKE-UP-CHECKLIST.md](WAKE-UP-CHECKLIST.md).

## How it works

- **Frontend:** Vite + React, mobile-first, deployed to GitHub Pages on every
  push to `main` (`.github/workflows/deploy.yml`). Runtime config (Supabase URL,
  anon key, admin PIN) lives in `public/config.json`.
- **Database:** Supabase Postgres — schema + seed in `supabase/schema.sql`.
  Players and predictions are written straight from the browser with the anon
  key; RLS enforces the one hard rule (no predictions after kickoff).
- **Results sync:** `scripts/sync.mjs` runs every ~5 min via GitHub Actions
  (`.github/workflows/sync.yml`), pulling knockout matches from
  football-data.org (competition `WC`) and writing team names, kickoff times,
  and final results into Supabase. Admin manual edits (`result_source` /
  `teams_source` = `manual`) are never overwritten.
- **Scoring** (derived, never stored): +1 for picking the team that advances
  (incl. ET/pens), +2 bonus for the exact regulation 90-minute score. Values
  configurable at the top of `src/lib.js`.
- **Admin:** ⚙️ tab, gated by the shared PIN in `public/config.json` — edit
  matches, enter/correct results, add QF/SF/F matches, and copy a ready-to-paste
  WhatsApp update.

## Local dev

```bash
npm install
npm run dev
```

Fill `public/config.json` with your Supabase project URL + anon key first.

## Manual sync run

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FOOTBALL_DATA_TOKEN=... npm run sync
```
