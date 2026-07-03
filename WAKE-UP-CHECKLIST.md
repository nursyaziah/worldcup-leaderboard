# ☀️ Good morning Syaz — 3 steps to go live (~10 minutes)

The app is **built, pushed, and deployed**. It's waiting on the two accounts
only you can log into: Supabase and football-data.org. Everything else is done.

**Your app URL:** https://nursyaziah.github.io/worldcup-leaderboard/
(right now it shows a "database not connected" notice — that disappears after Step 2)

---

## Step 1 — Create the Supabase project (~4 min)

1. Go to https://supabase.com/dashboard → **New project** (any name, e.g. `worldcup`).
2. When it's ready, open **SQL Editor** → **New query**, paste the entire
   contents of [`supabase/schema.sql`](supabase/schema.sql) from this repo, and **Run**.
   This creates the tables and seeds the 8 Round-of-16 slots
   (Canada–Morocco, USA–Belgium, Brazil–Norway + 5 TBD — all editable in the app's admin tab).
3. Go to **Project Settings → API** and copy three things:
   - Project URL (looks like `https://xxxx.supabase.co`)
   - `anon` public key
   - `service_role` key (keep this one secret)

## Step 2 — Connect the frontend (~2 min)

1. In GitHub, open `public/config.json` in this repo and click the ✏️ edit button:
   https://github.com/nursyaziah/worldcup-leaderboard/edit/main/public/config.json
2. Paste in the **Project URL** and **anon key** (NOT the service_role key —
   this file is public). Change `adminPin` if you want (default: `2026`).
3. Commit — GitHub Actions redeploys automatically (~1 min). The app is now live
   and playable. Share the URL in the family group! 🎉

## Step 3 — Turn on automatic results (~4 min)

1. Register free at https://www.football-data.org/client/register — the API
   token arrives by email instantly.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**,
   add these three:
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
   | `FOOTBALL_DATA_TOKEN` | your football-data.org token |
3. Done. The sync workflow already runs every ~5 minutes; once the secrets exist
   it starts filling in TBD matchups, real kickoff times, and final results
   automatically. To trigger one immediately: **Actions → Sync match data → Run workflow**.

---

## Tonight (before Round of 16 kicks off)

- Open the app → **⚙️ tab** → enter PIN → confirm/fix the 8 matchups and kickoff
  times once tonight's Round-of-32 results are in (or just let the sync job do it
  after Step 3 — anything you edit manually won't be overwritten).
- Kickoff times display in **SGT**; picks lock automatically at kickoff
  (enforced in the database, not just the UI).

## Things I decided that you can change

- **Scoring:** +1 winner, +2 exact 90-min score → one place: top of [`src/lib.js`](src/lib.js).
- **Tiebreak:** points, then alphabetical (placeholder per the PRD).
- **Repo is public** — required for free GitHub Pages hosting. The URL is
  unlisted; nothing sensitive is in it (the admin PIN in config.json is
  "trusted family" security, exactly as the PRD specified).
- **Extra time/penalties:** winner pick = whoever advances; exact-score bonus =
  regulation 90-min score. Both per the PRD.

## If something's wrong

- Result wrong/missing? Fix it in the ⚙️ admin tab — manual results are never
  overwritten by the sync job.
- Sync not working? Check the **Actions** tab for red runs and read the log.
- Want changes? Just ask Claude Code — the repo is the single source of truth.
