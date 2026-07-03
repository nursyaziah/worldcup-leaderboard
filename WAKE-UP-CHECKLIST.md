# ☀️ Setup status

**App URL:** https://nursyaziah.github.io/worldcup-leaderboard/

- ✅ App built, deployed to GitHub Pages, auto-deploys on every push
- ✅ football-data.org token registered, verified, and stored as the
  `FOOTBALL_DATA_TOKEN` Actions secret (2026-07-03)
- ✅ Sync workflow running every ~5 min (no-ops until Supabase secrets exist)
- ⬜ Supabase connection — the only remaining step

## Remaining step — connect Supabase

No keys are ever committed to this repo. The frontend's `config.json` is
generated at deploy time from GitHub Actions **secrets**, and the sync job
reads secrets directly.

1. In your Supabase project, run the whole of
   [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor (once).
2. Add these repository secrets
   (**Settings → Secrets and variables → Actions**), from
   **Project Settings → API** in Supabase:
   | Secret | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL (`https://xxxx.supabase.co`) |
   | `SUPABASE_ANON_KEY` | `anon` public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key |
   | `ADMIN_PIN` | optional — admin PIN, defaults to `2026` |

   (Or paste the URL + keys to Claude Code in chat and it does this part.)
3. Re-run **Actions → Deploy to GitHub Pages → Run workflow**. Live in ~1 min.
   The next sync run then fills in matchups, kickoff times, and results
   automatically.

## Before Round of 16 kicks off

- Open the app → ⚙️ tab → PIN → sanity-check the 8 matchups/kickoffs once
  tonight's results are in (the sync job should have them right; anything you
  edit manually is never overwritten by the sync).
- Kickoff times display in SGT; picks lock at kickoff (enforced in the DB).

## Defaults you can change

- Scoring (+1 winner / +2 exact 90-min score): top of [`src/lib.js`](src/lib.js).
- Tiebreak: points, then alphabetical (placeholder per the PRD).
- Repo is public (needed for free GitHub Pages). No keys or personal data in it.

## If something's wrong

- Wrong/missing result → fix in the ⚙️ admin tab; manual edits stick.
- Sync issues → check the repo's **Actions** tab logs.
