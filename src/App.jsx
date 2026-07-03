import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  ROUNDS, isTbd, isLocked, fmtSgt, scorePrediction, buildLeaderboard,
  whatsappText, POINTS_WINNER, POINTS_EXACT, flag,
} from './lib.js'

export default function App() {
  const [config, setConfig] = useState(undefined) // undefined = loading, null = failed
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'config.json', { cache: 'no-store' })
      .then(r => r.json()).then(setConfig).catch(() => setConfig(null))
  }, [])

  if (config === undefined) return <div className="center">Loading…</div>
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) return <SetupNotice />
  return <Game config={config} />
}

function SetupNotice() {
  return (
    <div className="center card setup">
      <h1>⚽ Almost ready!</h1>
      <p>The database isn't connected yet. Admin: add the Supabase URL and anon
        key to <code>public/config.json</code> in the GitHub repo (see
        WAKE-UP-CHECKLIST.md), and this page will come alive on the next deploy.</p>
    </div>
  )
}

function Game({ config }) {
  const supabase = useMemo(
    () => createClient(config.supabaseUrl, config.supabaseAnonKey), [config])
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [player, setPlayer] = useState(undefined)   // null = signed in, no name yet
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [predictions, setPredictions] = useState([])
  const [tab, setTab] = useState('matches')
  const [admin, setAdmin] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const [m, p, pr] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at'),
      supabase.from('players').select('*'),
      supabase.from('predictions').select('*'),
    ])
    if (m.error || p.error || pr.error) {
      setError('Could not load data — check connection.'); return
    }
    setError('')
    setMatches(m.data); setPlayers(p.data); setPredictions(pr.data)
  }, [supabase])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30000) // keeps leaderboard live without realtime
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!session) { setPlayer(session === undefined ? undefined : null); return }
    supabase.from('players').select('*')
      .eq('auth_user_id', session.user.id).maybeSingle()
      .then(({ data }) => setPlayer(data ?? null))
  }, [session, supabase])

  const claimName = async (name) => {
    const clean = name.trim().slice(0, 30)
    if (!clean) return
    // a player row from before login existed may have this name — adopt it
    const { data: existing } = await supabase.from('players')
      .select('*').ilike('name', clean).maybeSingle()
    if (existing) {
      if (existing.auth_user_id) { setError('That name is taken — pick another.'); return }
      const { data, error: e } = await supabase.from('players')
        .update({ auth_user_id: session.user.id }).eq('id', existing.id).select().single()
      if (e) { setError('Could not claim that name, try another.'); return }
      setError(''); setPlayer(data); refresh(); return
    }
    const { data, error: e } = await supabase.from('players')
      .insert({ name: clean, auth_user_id: session.user.id }).select().single()
    if (e) { setError('Could not save name, try another.'); return }
    setError(''); setPlayer(data)
    refresh()
  }

  const myPreds = useMemo(() => {
    const map = new Map()
    if (player) for (const pr of predictions)
      if (pr.player_id === player.id) map.set(pr.match_id, pr)
    return map
  }, [predictions, player])

  const submitPrediction = async (match, fields) => {
    const existing = myPreds.get(match.id)
    const row = {
      player_id: player.id, match_id: match.id,
      pick: fields.pick ?? existing?.pick,
      predicted_score_a: fields.predicted_score_a !== undefined
        ? fields.predicted_score_a : existing?.predicted_score_a ?? null,
      predicted_score_b: fields.predicted_score_b !== undefined
        ? fields.predicted_score_b : existing?.predicted_score_b ?? null,
    }
    if (!row.pick) return
    const { error: e } = await supabase.from('predictions')
      .upsert(row, { onConflict: 'player_id,match_id' })
    if (e) setError('Pick not saved — the match may have kicked off.')
    refresh()
  }

  const leaderboard = useMemo(
    () => buildLeaderboard(players, predictions, matches),
    [players, predictions, matches])

  if (session === undefined || (session && player === undefined))
    return <div className="center">Loading…</div>
  if (!session) return <AuthGate supabase={supabase} />
  if (player === null)
    return <NamePick onSubmit={claimName} error={error} onLogout={() => supabase.auth.signOut()} />

  return (
    <div className="app">
      <header>
        <h1>⚽ WC2026 Predictions</h1>
        <span className="who">Hi, {player.name}!{' '}
          <button className="link" onClick={() => supabase.auth.signOut()}>log out</button>
        </span>
      </header>
      {error && <div className="banner">{error}</div>}
      <nav>
        <button className={tab === 'matches' ? 'on' : ''} onClick={() => setTab('matches')}>Matches</button>
        <button className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>Leaderboard</button>
        <button className={tab === 'admin' ? 'on' : ''} onClick={() => setTab('admin')}>⚙️</button>
      </nav>
      {tab === 'matches' && <Matches matches={matches} myPreds={myPreds} onSubmit={submitPrediction} />}
      {tab === 'board' && <Leaderboard rows={leaderboard} me={player} />}
      {tab === 'admin' && (admin
        ? <AdminPanel supabase={supabase} matches={matches} leaderboard={leaderboard} refresh={refresh} />
        : <PinGate pin={config.adminPin} onOk={() => setAdmin(true)} />)}
      <footer>Winner pick +{POINTS_WINNER} · exact 90-min score +{POINTS_EXACT} bonus · picks lock at kickoff · times in SGT</footer>
    </div>
  )
}

function AuthGate({ supabase }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setMsg(''); setBusy(true)
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password: pw })
      if (error) setMsg(error.message)
      else if (!data.session)
        setMsg('Account created! Check your email for a confirmation link, then log in.')
      // if a session came back, onAuthStateChange takes it from here
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (error) setMsg(error.message === 'Invalid login credentials'
        ? 'Wrong email or password.' : error.message)
    }
    setBusy(false)
  }
  return (
    <div className="center card">
      <h1>⚽ World Cup 2026<br />Family Predictions</h1>
      <p>{mode === 'signin' ? 'Log in to make your picks:' : 'Create your account:'}</p>
      <form className="stack" onSubmit={submit}>
        <input type="email" required value={email} placeholder="Email"
          autoComplete="email" onChange={e => setEmail(e.target.value)} />
        <input type="password" required minLength={6} value={pw} placeholder="Password (min 6 chars)"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          onChange={e => setPw(e.target.value)} />
        <button type="submit" className="primary" disabled={busy}>
          {mode === 'signin' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      {msg && <p className="note">{msg}</p>}
      <p><button className="link" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg('') }}>
        {mode === 'signin' ? "First time? Create an account" : 'Already have an account? Log in'}
      </button></p>
    </div>
  )
}

function NamePick({ onSubmit, error, onLogout }) {
  const [name, setName] = useState('')
  return (
    <div className="center card">
      <h1>⚽ Almost there!</h1>
      <p>Pick your display name for the leaderboard:</p>
      <form onSubmit={e => { e.preventDefault(); onSubmit(name) }}>
        <input autoFocus value={name} maxLength={30} placeholder="Your name"
          onChange={e => setName(e.target.value)} />
        <button type="submit" className="primary" disabled={!name.trim()}>Let's go</button>
      </form>
      {error && <p className="bad">{error}</p>}
      <p><button className="link" onClick={onLogout}>log out</button></p>
    </div>
  )
}

function PinGate({ pin, onOk }) {
  const [v, setV] = useState('')
  const [bad, setBad] = useState(false)
  return (
    <div className="center card">
      <p>Admin PIN:</p>
      <form onSubmit={e => { e.preventDefault(); v === String(pin) ? onOk() : setBad(true) }}>
        <input type="password" inputMode="numeric" value={v} onChange={e => setV(e.target.value)} />
        <button type="submit" className="primary">Enter</button>
      </form>
      {bad && <p className="bad">Wrong PIN</p>}
    </div>
  )
}

function Matches({ matches, myPreds, onSubmit }) {
  const rounds = [...new Set(matches.map(m => m.round))]
  return (
    <div className="list">
      {rounds.map(r => (
        <section key={r}>
          <h2>{ROUNDS[r] || r}</h2>
          {matches.filter(m => m.round === r).map(m => (
            <MatchCard key={m.id} match={m} pred={myPreds.get(m.id)} onSubmit={onSubmit} />
          ))}
        </section>
      ))}
      {!matches.length && <p className="center">No matches yet — check back soon!</p>}
    </div>
  )
}

function MatchCard({ match, pred, onSubmit }) {
  const locked = isLocked(match)
  const tbd = isTbd(match)
  const done = match.status === 'completed' && match.result
  const s = pred ? scorePrediction(pred, match) : null
  const [sa, setSa] = useState(pred?.predicted_score_a ?? '')
  const [sb, setSb] = useState(pred?.predicted_score_b ?? '')
  useEffect(() => {
    setSa(pred?.predicted_score_a ?? ''); setSb(pred?.predicted_score_b ?? '')
  }, [pred?.predicted_score_a, pred?.predicted_score_b])

  const saveScore = () => {
    const a = sa === '' ? null : Number(sa)
    const b = sb === '' ? null : Number(sb)
    if ((a === null) !== (b === null)) return // need both or neither
    if (a !== (pred?.predicted_score_a ?? null) || b !== (pred?.predicted_score_b ?? null))
      onSubmit(match, { predicted_score_a: a, predicted_score_b: b })
  }

  const teamBtn = (side, name) => {
    const picked = pred?.pick === side
    const won = done && match.result === side
    return (
      <button
        className={'team' + (picked ? ' picked' : '') + (won ? ' winner' : '')}
        disabled={locked || tbd}
        onClick={() => onSubmit(match, { pick: side })}>
        <span className="flag">{flag(name)}</span>
        <span className="tname">{name}</span>
        {done && match.score_a != null && (
          <span className="sc">{side === 'team_a' ? match.score_a : match.score_b}</span>)}
      </button>
    )
  }

  return (
    <div className={'match' + (done ? ' done' : '')}>
      <div className="meta">
        <span>{fmtSgt(match.kickoff_at)}</span>
        <span className="state">
          {done ? (s ? `${s.pts} pt${s.pts === 1 ? '' : 's'} ${s.winnerRight ? '✅' : '❌'}${s.exact ? ' 🎯' : ''}` : 'Final')
            : tbd ? 'Matchup TBD'
            : locked ? '🔒 Locked'
            : pred ? '✅ Picked' : 'Tap to pick'}
        </span>
      </div>
      <div className="teams">
        {teamBtn('team_a', match.team_a)}
        <span className="vs">vs</span>
        {teamBtn('team_b', match.team_b)}
      </div>
      {!tbd && (pred || !locked) && (
        <div className="scoreline">
          <label>90-min score (optional, +{POINTS_EXACT}):</label>
          <input type="number" min="0" max="99" inputMode="numeric" value={sa} disabled={locked || !pred}
            onChange={e => setSa(e.target.value)} onBlur={saveScore} />
          <span>–</span>
          <input type="number" min="0" max="99" inputMode="numeric" value={sb} disabled={locked || !pred}
            onChange={e => setSb(e.target.value)} onBlur={saveScore} />
        </div>
      )}
    </div>
  )
}

function Leaderboard({ rows, me }) {
  return (
    <div className="list">
      {rows.map((row, i) => (
        <div key={row.player.id} className={'lb' + (row.player.id === me.id ? ' me' : '')}>
          <span className="rank">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
          <span className="name">{row.player.name}</span>
          <span className="detail">{row.winners}W · {row.exacts}🎯</span>
          <span className="pts">{row.total} pts</span>
        </div>
      ))}
      {!rows.length && <p className="center">No players yet — share the link!</p>}
    </div>
  )
}

function AdminPanel({ supabase, matches, leaderboard, refresh }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(whatsappText(matches, leaderboard))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const addMatch = async (round) => {
    await supabase.from('matches').insert({
      round, team_a: 'TBD', team_b: 'TBD',
      kickoff_at: new Date(Date.now() + 86400000).toISOString(),
    })
    refresh()
  }
  return (
    <div className="list">
      <button className="primary wide" onClick={copy}>
        {copied ? '✅ Copied!' : '📋 Copy update for WhatsApp'}
      </button>
      {matches.map(m => <AdminMatch key={m.id} supabase={supabase} match={m} refresh={refresh} />)}
      <div className="addrow">
        {Object.keys(ROUNDS).map(r =>
          <button key={r} onClick={() => addMatch(r)}>+ {r}</button>)}
      </div>
    </div>
  )
}

function toLocalInput(iso) {
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function AdminMatch({ supabase, match, refresh }) {
  const [f, setF] = useState({
    team_a: match.team_a, team_b: match.team_b,
    kickoff: toLocalInput(match.kickoff_at), status: match.status,
    result: match.result ?? '', score_a: match.score_a ?? '', score_b: match.score_b ?? '',
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    const upd = {
      round: match.round, status: f.status,
      kickoff_at: new Date(f.kickoff).toISOString(),
      result: f.result || null,
      score_a: f.score_a === '' ? null : Number(f.score_a),
      score_b: f.score_b === '' ? null : Number(f.score_b),
    }
    if (f.team_a !== match.team_a || f.team_b !== match.team_b) {
      upd.team_a = f.team_a; upd.team_b = f.team_b; upd.teams_source = 'manual'
    }
    const resultChanged = upd.result !== match.result ||
      upd.score_a !== match.score_a || upd.score_b !== match.score_b
    if (resultChanged) upd.result_source = 'manual' // sync job will not overwrite
    const { error } = await supabase.from('matches').update(upd).eq('id', match.id)
    if (!error) refresh()
  }
  const del = async () => {
    if (!window.confirm(`Delete ${match.team_a} vs ${match.team_b}? This removes its predictions too.`)) return
    await supabase.from('matches').delete().eq('id', match.id)
    refresh()
  }
  return (
    <div className="match adm">
      <div className="row">
        <input value={f.team_a} onChange={set('team_a')} />
        <span>vs</span>
        <input value={f.team_b} onChange={set('team_b')} />
      </div>
      <div className="row">
        <input type="datetime-local" value={f.kickoff} onChange={set('kickoff')} />
        <select value={f.status} onChange={set('status')}>
          <option value="upcoming">upcoming</option>
          <option value="locked">locked</option>
          <option value="completed">completed</option>
        </select>
      </div>
      <div className="row">
        <select value={f.result} onChange={set('result')}>
          <option value="">winner…</option>
          <option value="team_a">{f.team_a}</option>
          <option value="team_b">{f.team_b}</option>
        </select>
        <input type="number" placeholder="90'" value={f.score_a} onChange={set('score_a')} />
        <span>–</span>
        <input type="number" placeholder="90'" value={f.score_b} onChange={set('score_b')} />
      </div>
      <div className="row">
        <span className="src">{match.round} · result: {match.result_source ?? '—'} · teams: {match.teams_source}</span>
        <button className="link bad" onClick={del}>delete</button>
        <button className="primary" onClick={save}>Save</button>
      </div>
    </div>
  )
}
