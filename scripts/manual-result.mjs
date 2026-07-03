// Manually record a match result (same effect as admin mode in the app).
// Meant for the "Set match result" workflow_dispatch; the sync never
// overwrites rows with result_source='manual'.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      MATCH_EXTERNAL_ID, SCORE_A, SCORE_B, RESULT (team_a|team_b)
import { createClient } from '@supabase/supabase-js'

const {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  MATCH_EXTERNAL_ID, SCORE_A, SCORE_B, RESULT,
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Supabase secrets not configured')
  process.exit(1)
}
if (!MATCH_EXTERNAL_ID || SCORE_A === '' || SCORE_B === '' || !['team_a', 'team_b'].includes(RESULT)) {
  console.error('need MATCH_EXTERNAL_ID, SCORE_A, SCORE_B and RESULT of team_a|team_b')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await supabase.from('matches')
  .update({
    status: 'completed',
    score_a: Number(SCORE_A),
    score_b: Number(SCORE_B),
    result: RESULT,
    result_source: 'manual',
  })
  .eq('external_id', MATCH_EXTERNAL_ID)
  .select('round, team_a, team_b, score_a, score_b, result')

if (error) {
  console.error('update failed:', error.message)
  process.exit(1)
}
if (!data?.length) {
  console.error(`no match found with external_id ${MATCH_EXTERNAL_ID}`)
  process.exit(1)
}
const m = data[0]
console.log(`set ${m.round} ${m.team_a} ${m.score_a}-${m.score_b} ${m.team_b} — ${m.result === 'team_a' ? m.team_a : m.team_b} through (manual)`)
