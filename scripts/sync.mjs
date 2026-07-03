// Syncs World Cup knockout matches from football-data.org into Supabase.
// Runs on a GitHub Actions schedule (see .github/workflows/sync.yml).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_TOKEN
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_TOKEN } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FOOTBALL_DATA_TOKEN) {
  console.log('Secrets not configured yet — skipping sync (this is expected until setup is done).')
  process.exit(0)
}

const STAGE_TO_ROUND = {
  LAST_32: 'R32', LAST_16: 'R16', QUARTER_FINALS: 'QF', SEMI_FINALS: 'SF', FINAL: 'F',
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// football-data.org asks clients to watch the throttling headers
// (X-Requests-Available-Minute / X-RequestCounter-Reset) instead of
// blindly retrying into the rate limiter.
async function fetchWithThrottle(url, attempt = 1) {
  const res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN } })
  const available = res.headers.get('x-requests-available-minute')
  const resetSec = Number(res.headers.get('x-requestcounter-reset')) || 60
  if (res.status === 429) {
    if (attempt >= 3) {
      console.error(`football-data.org still rate limiting after ${attempt} attempts — giving up until next run`)
      process.exit(1)
    }
    console.log(`rate limited (429); counter resets in ${resetSec}s — waiting before retry ${attempt + 1}`)
    await new Promise(r => setTimeout(r, (resetSec + 1) * 1000))
    return fetchWithThrottle(url, attempt + 1)
  }
  if (!res.ok) {
    console.error(`football-data.org returned ${res.status}`)
    process.exit(1)
  }
  if (available !== null && Number(available) <= 2) {
    console.log(`warning: only ${available} requests left this minute (resets in ${resetSec}s)`)
  }
  return res.json()
}

const { matches: apiMatches = [] } = await fetchWithThrottle('https://api.football-data.org/v4/competitions/WC/matches')
const knockout = apiMatches.filter(m => STAGE_TO_ROUND[m.stage])
console.log(`API: ${knockout.length} knockout matches`)

const { data: rows, error } = await supabase.from('matches').select('*').order('kickoff_at')
if (error) throw error

// row ids that are already tied to an API match, so a TBD slot isn't claimed twice
const claimed = new Set(rows.filter(r => r.external_id).map(r => r.id))

for (const am of knockout) {
  const extId = String(am.id)
  const round = STAGE_TO_ROUND[am.stage]
  const home = am.homeTeam?.name || null
  const away = am.awayTeam?.name || null

  // 1) already mapped by external_id  2) same teams+round  3) claim an unmapped TBD slot in the round
  let row = rows.find(r => r.external_id === extId)
  if (!row && home && away) {
    row = rows.find(r => !r.external_id && r.round === round &&
      r.team_a === home && r.team_b === away)
  }
  if (!row) {
    row = rows.find(r => !r.external_id && r.round === round &&
      !claimed.has(r.id) && (r.team_a === 'TBD' || r.team_b === 'TBD'))
  }

  const upd = { external_id: extId, kickoff_at: am.utcDate }

  if (home && away && (!row || row.teams_source !== 'manual')) {
    upd.team_a = home
    upd.team_b = away
    upd.teams_source = 'api'
  }

  const finished = am.status === 'FINISHED'
  if (finished && !am.score?.winner) {
    console.log(`finished but winner not set yet for ${home} vs ${away}: ${JSON.stringify(am.score)}`)
  }
  const live = ['IN_PLAY', 'PAUSED'].includes(am.status)
  const manualResult = row?.result_source === 'manual' // admin override wins
  if (!manualResult) {
    if (finished && am.score?.winner) {
      // regulation 90' score: fullTime includes extra time when played,
      // so prefer regularTime when the match went beyond 90 minutes
      const reg = (am.score.duration !== 'REGULAR' && am.score.regularTime)
        ? am.score.regularTime : am.score.fullTime
      upd.status = 'completed'
      upd.result = am.score.winner === 'HOME_TEAM' ? 'team_a'
        : am.score.winner === 'AWAY_TEAM' ? 'team_b' : null
      upd.score_a = reg?.home ?? null
      upd.score_b = reg?.away ?? null
      upd.result_source = 'api'
    } else if (live && row?.status !== 'completed') {
      upd.status = 'locked'
    }
  }

  if (row) {
    claimed.add(row.id)
    const { error: e } = await supabase.from('matches').update(upd).eq('id', row.id)
    if (e) console.error(`update failed for ${extId}:`, e.message)
    else console.log(`updated ${round} ${upd.team_a ?? row.team_a} vs ${upd.team_b ?? row.team_b}${upd.result ? ' (final)' : ` [api: ${am.status}]`}`)
  } else if (finished) {
    // never seen this match and it's already over (e.g. old R32 games) —
    // nobody could have predicted it, so don't clutter the app with it
    continue
  } else {
    // new match the app doesn't know yet (e.g. a QF slot) — insert it
    const { error: e } = await supabase.from('matches').insert({
      round, team_a: home ?? 'TBD', team_b: away ?? 'TBD',
      kickoff_at: am.utcDate, teams_source: home && away ? 'api' : 'seed',
      ...upd,
    })
    if (e) console.error(`insert failed for ${extId}:`, e.message)
    else console.log(`inserted ${round} ${home ?? 'TBD'} vs ${away ?? 'TBD'}`)
  }
}
console.log('Sync complete.')
