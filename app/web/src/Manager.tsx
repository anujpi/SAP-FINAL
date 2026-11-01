import { useCallback, useEffect, useState } from 'react'
import { list, parseJson, parsed, value } from './api'

const OUTCOMES = [
  { id: 'shortlist', label: 'Shortlist for interview' },
  { id: 'request_evidence', label: 'Request more evidence' },
  { id: 'not_yet', label: 'Not yet' }
]

export function ManagerApp() {
  const [tab, setTab] = useState<'review' | 'attest' | 'audit' | 'fairness'>('review')
  const [names, setNames] = useState<Record<string, string>>({})
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = useCallback(async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(done)
      setRevision(r => r + 1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    list('/manager/Skills').then(rows => setNames(Object.fromEntries(rows.map(s => [s.ID, s.name])))).catch(e => setError(e.message))
  }, [])

  const props = { names, revision, run, busy }
  return (
    <main className="wide">
      <header className="bar">
        <strong>Frontline Shift · Manager</strong>
        <a href="#/worker">Worker view</a>
      </header>
      <div className="demo-badge">DEMO · All people, scores and fairness figures are fictional</div>
      <nav className="tabs">
        {([['review', 'Review'], ['attest', 'Attest skills'], ['audit', 'Audit log'], ['fairness', 'Fairness']] as const).map(([id, label]) => (
          <button type="button" key={id} className={tab === id ? 'tab on' : 'tab'} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {error && <p className="alert" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}
      {tab === 'review' && <Review {...props} />}
      {tab === 'attest' && <Attest {...props} />}
      {tab === 'audit' && <Audit revision={revision} />}
      {tab === 'fairness' && <Fairness revision={revision} />}
      <footer className="foot">No live SAP system is connected. The manager decides, not the AI.</footer>
    </main>
  )
}

type Props = {
  names: Record<string, string>
  revision: number
  run: (action: () => Promise<unknown>, done: string) => Promise<void>
  busy: boolean
}

function Review({ names, revision, run, busy }: Props) {
  const [queue, setQueue] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [packet, setPacket] = useState<any>(null)
  const [outcome, setOutcome] = useState('not_yet')
  const [reasons, setReasons] = useState('')

  useEffect(() => {
    list('/manager/ReviewQueue').then(rows => {
      setQueue(rows)
      setSelected(current => rows.some(r => r.ID === current) ? current : rows[0]?.ID ?? '')
    }).catch(() => setQueue([]))
  }, [revision])

  useEffect(() => {
    if (!selected) { setPacket(null); return }
    parsed(`/manager/reviewPacket(worker=${selected})`).then(setPacket).catch(() => setPacket(null))
  }, [selected, revision])

  if (!queue.length) return <p>No one is waiting for review. The worker asks for review from the Match screen.</p>

  const best = packet?.matches?.[0]
  const reasonNeeded = outcome !== 'shortlist'

  return (
    <section className="stack">
      <h1>Review queue</h1>
      <ul className="cards">
        {queue.map(w => (
          <li key={w.ID}>
            <button type="button" className={w.ID === selected ? 'choice on' : 'choice'} aria-pressed={w.ID === selected} onClick={() => setSelected(w.ID)}>{w.name} · {w.site}</button>
          </li>
        ))}
      </ul>
      {packet && (
        <>
          <h2>{packet.worker.name}</h2>
          {best && <p className="score"><strong>{best.score}%</strong> skill match <small>(demo data)</small></p>}
          <h3>Verified skills</h3>
          <ul className="plain">{packet.verified.map((c: any) => <li key={c.ID}>{names[c.skill_ID] ?? c.skill_ID} · level {c.proficiency} · {c.source}</li>)}</ul>
          <h3>Self-reported or needs evidence</h3>
          <ul className="plain">{packet.needsEvidence.map((c: any) => <li key={c.ID}>{names[c.skill_ID] ?? c.skill_ID}</li>)}</ul>
          <h3>Evidence</h3>
          <ul className="plain">{packet.evidence.map((e: any) => <li key={e.ID}>{names[e.skill_ID] ?? e.skill_ID}: {e.type} by {e.attestedBy}</li>)}</ul>
          {best && (
            <details>
              <summary>Rule trace</summary>
              <ul className="plain small">{parseJson<any[]>(best.ruleTrace, []).map(r => <li key={r.skill}>{names[r.skill] ?? r.skill}: weight {r.weight} × credit {r.credit}</li>)}</ul>
            </details>
          )}
          <h3>Decision</h3>
          <div className="choices">
            {OUTCOMES.map(o => (
              <button type="button" key={o.id} className={outcome === o.id ? 'choice on' : 'choice'} aria-pressed={outcome === o.id} onClick={() => setOutcome(o.id)}>{o.label}</button>
            ))}
          </div>
          <label htmlFor="reason">Reason{reasonNeeded ? ' (required)' : ' (optional)'}</label>
          <textarea id="reason" rows={3} maxLength={1000} value={reasons} onChange={e => setReasons(e.target.value)} />
          <p className="notice">Decision and reason are logged. The manager decides, not the AI.</p>
          <button
            type="button"
            className="primary"
            disabled={busy || (reasonNeeded && !reasons.trim())}
            onClick={() => run(() => value('/manager/decide', { worker: selected, outcome, reasons }), 'Decision recorded.').then(() => setReasons(''))}
          >
            Record decision
          </button>
        </>
      )}
    </section>
  )
}

function Attest({ names, revision, run, busy }: Props) {
  const [team, setTeam] = useState<any[]>([])
  const [worker, setWorker] = useState('')
  const [skill, setSkill] = useState('')
  const skillIds = Object.keys(names)

  useEffect(() => {
    list('/manager/Team?$orderby=name').then(rows => {
      setTeam(rows)
      setWorker(current => current || (rows.find(r => !r.name.startsWith('Sample'))?.ID ?? ''))
    }).catch(() => setTeam([]))
  }, [revision])

  const person = team.find(w => w.ID === worker)
  const canAttest = person?.stage === 'ACTIVE' || person?.stage === 'AWAITING_MANAGER'

  return (
    <section className="stack">
      <h1>Supervisor attestation</h1>
      <p>Confirm only what you have seen this person do on the floor.</p>
      <label htmlFor="attest-worker">Worker</label>
      <select id="attest-worker" value={worker} onChange={e => setWorker(e.target.value)}>
        {team.map(w => <option key={w.ID} value={w.ID}>{w.name} ({w.stage})</option>)}
      </select>
      <label htmlFor="attest-skill">Skill</label>
      <select id="attest-skill" value={skill} onChange={e => setSkill(e.target.value)}>
        <option value="">Choose a skill</option>
        {skillIds.map(id => <option key={id} value={id}>{names[id]}</option>)}
      </select>
      {!canAttest && person && <p className="notice">{person.name} hasn't confirmed their profile yet.</p>}
      <button
        type="button"
        className="primary"
        disabled={busy || !skill || !canAttest}
        onClick={() => run(() => value('/manager/attest', { worker, skill, proficiency: 2 }), `Attested ${names[skill]} at level 2.`)}
      >
        Attest at level 2
      </button>
      <hr />
      <button
        type="button"
        className="quiet"
        disabled={busy || !worker}
        onClick={() => run(() => value('/manager/resetDemo', { worker }), `Reset demo for ${person?.name}.`)}
      >
        Reset demo for this worker
      </button>
    </section>
  )
}

function Audit({ revision }: { revision: number }) {
  const [events, setEvents] = useState<any[]>([])
  useEffect(() => {
    list('/manager/AuditEvents?$orderby=occurredAt desc&$top=40').then(setEvents).catch(() => setEvents([]))
  }, [revision])
  return (
    <section className="stack">
      <h1>Hand-off log</h1>
      {!events.length && <p>No hand-offs yet.</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Event</th><th>Contract</th><th>Stage</th><th>Actor</th><th>Backup</th></tr></thead>
          <tbody>
            {events.map(e => (
              <tr key={e.ID}>
                <td>{new Date(e.occurredAt).toLocaleTimeString()}</td>
                <td><code>{e.type}</code></td>
                <td>{e.contract}</td>
                <td>{e.stage}</td>
                <td>{e.actor}</td>
                <td>{e.degraded ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Fairness({ revision }: { revision: number }) {
  const [report, setReport] = useState<any[]>([])
  useEffect(() => { parsed('/manager/fairnessReport()').then(setReport).catch(() => setReport([])) }, [revision])
  return (
    <section className="stack">
      <h1>Bias audit</h1>
      <p className="notice">Fictional sample data. This shows how the audit works and is not a real result. HR reviews every flag.</p>
      {report.map(r => (
        <article className="match" key={r.dimension}>
          <h2>{r.dimension === 'lang' ? 'By language' : 'By employment type'}</h2>
          <p className={r.flagged ? 'alert' : 'success'}>
            {r.flagged ? `Flagged for HR: a gap of ${r.gap} points in average score.` : `No flag: a gap of ${r.gap} points.`}
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Group</th><th>People</th><th>Average score</th><th>Shortlisted</th></tr></thead>
              <tbody>
                {r.groups.map((g: any) => <tr key={g.group}><td>{g.group}</td><td>{g.n}</td><td>{g.avgScore}</td><td>{g.shortlistRate}%</td></tr>)}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  )
}
