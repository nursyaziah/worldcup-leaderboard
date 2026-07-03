// Point values — confirm with Syaz (PRD Open Question 3). One place to change.
export const POINTS_WINNER = 1
export const POINTS_EXACT = 2

export const ROUNDS = { R16: 'Round of 16', QF: 'Quarterfinals', SF: 'Semifinals', F: 'Final' }

export function isTbd(match) {
  return match.team_a === 'TBD' || match.team_b === 'TBD'
}

export function isLocked(match, now = new Date()) {
  return match.status !== 'upcoming' || new Date(match.kickoff_at) <= now
}

export function fmtSgt(iso) {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)) + ' SGT'
}

export function scorePrediction(pred, match) {
  if (match.status !== 'completed' || !match.result) return null
  let pts = 0
  const winnerRight = pred.pick === match.result
  if (winnerRight) pts += POINTS_WINNER
  const exact = match.score_a != null && match.score_b != null &&
    pred.predicted_score_a === match.score_a && pred.predicted_score_b === match.score_b
  if (exact) pts += POINTS_EXACT
  return { pts, winnerRight, exact }
}

// rows: [{ player, total, winners, exacts }] ranked by points desc, then name (placeholder tiebreak)
export function buildLeaderboard(players, predictions, matches) {
  const byMatch = new Map(matches.map(m => [m.id, m]))
  const rows = players.map(player => {
    let total = 0, winners = 0, exacts = 0
    for (const pred of predictions) {
      if (pred.player_id !== player.id) continue
      const match = byMatch.get(pred.match_id)
      if (!match) continue
      const s = scorePrediction(pred, match)
      if (!s) continue
      total += s.pts
      if (s.winnerRight) winners++
      if (s.exact) exacts++
    }
    return { player, total, winners, exacts }
  })
  rows.sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name))
  return rows
}

export function whatsappText(matches, leaderboard) {
  const done = matches.filter(m => m.status === 'completed' && m.result)
    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))
  const lines = ['🏆 World Cup Predictions Update']
  if (done.length) {
    const m = done[0]
    const mid = m.score_a != null ? ` ${m.score_a}-${m.score_b} ` : ' vs '
    const winner = m.result === 'team_a' ? m.team_a : m.team_b
    lines.push(`${m.team_a}${mid}${m.team_b} — ${winner} through! ⚽`)
  }
  lines.push('', 'Leaderboard:')
  leaderboard.slice(0, 10).forEach((row, i) => {
    lines.push(`${i + 1}. ${row.player.name} — ${row.total} pts`)
  })
  return lines.join('\n')
}
