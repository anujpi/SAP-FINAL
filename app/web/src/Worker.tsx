import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { list, parseJson, parsed, sendEvent, value } from './api'
import { Lang, speechLang, texts, Texts } from './i18n'

type Run = (action: () => Promise<unknown>) => Promise<void>
type ScreenProps = { t: Texts; run: Run; revision: number; busy: boolean }

const LANG_KEY = 'fs-lang'
function savedLang(): Lang {
  try { return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en' } catch { return 'en' }
}

const ROUTE_LABEL: Record<string, string> = {
  'generative-ai-hub': 'SAP Generative AI Hub',
  'direct-anthropic': 'Anthropic API (not SAP)',
  offline: 'Offline backup (no AI)'
}

export function WorkerApp() {
  const [lang, setLangState] = useState<Lang>(savedLang)
  const [me, setMe] = useState<any>(null)
  const [trace, setTrace] = useState<any[]>([])
  const [route, setRoute] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const t = texts[lang]

  const setLang = (next: Lang) => {
    setLangState(next)
    try { localStorage.setItem(LANG_KEY, next) } catch { /* the choice just won't be remembered */ }
  }

  const reload = useCallback(async () => {
    const [people, events, activeRoute] = await Promise.all([
      list('/worker/Me'),
      list('/worker/MyAuditEvents?$orderby=occurredAt desc&$top=14'),
      value<string>('/worker/aiStatus()')
    ])
    setMe(people[0] ?? null)
    setTrace(events)
    setRoute(activeRoute)
    if (!people[0]) throw new Error("This login isn't linked to a worker, so there's nothing to show. An admin needs to set its worker ID.")
    setRevision(r => r + 1)
  }, [])

  const run: Run = useCallback(async action => {
    setBusy(true)
    setError('')
    try {
      await action()
      await reload()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [reload])

  useEffect(() => { reload().catch(e => setError(e.message)) }, [reload])

  const props = { t, run, revision, busy }
  const stage = me?.stage
  // Show this run only. The audit log keeps every earlier run for the manager.
  const runStart = trace.findIndex(e => e.type === 'consent_granted')
  const thisRun = stage === 'NOT_STARTED' || stage === 'HALTED' ? [] : runStart < 0 ? trace : trace.slice(0, runStart + 1)
  const degraded = thisRun[0]?.degraded

  return (
    <div className="split">
      <main className="phone">
        <header className="bar">
          <strong>Frontline Shift</strong>
          <a href="#/manager">Manager</a>
          <select id="language" aria-label={t.chooseLanguage} value={lang} onChange={e => setLang(e.target.value as Lang)}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </select>
        </header>
        <div className="demo-badge">DEMO · Ravi and all data are fictional</div>
        {error && <p className="alert" role="alert">{error}</p>}
        {degraded && <p className="notice" role="status">{t.degraded}</p>}
        {!me && !error && <p>{t.working}</p>}
        {(stage === 'NOT_STARTED' || stage === 'HALTED') && <Consent {...props} lang={lang} setLang={setLang} />}
        {stage === 'DISCOVERING' && <Talk {...props} lang={lang} />}
        {stage === 'AWAITING_READBACK' && <Readback {...props} lang={lang} />}
        {(stage === 'ACTIVE' || stage === 'AWAITING_MANAGER' || stage === 'SHORTLISTED') && <Home {...props} stage={stage} />}
        <footer className="foot">No live SAP system is connected. Roles and jobs are sample data.</footer>
      </main>
      <aside className="trace" aria-label="System trace">
        <h2>System trace</h2>
        <p className="route">AI route: <strong>{ROUTE_LABEL[route] ?? '…'}</strong></p>
        <ol>
          {thisRun.map(e => (
            <li key={e.ID}>
              <code>{e.type}</code>
              <span>{e.contract} → {e.stage}{e.degraded ? ' · backup used' : ''}</span>
            </li>
          ))}
        </ol>
        {!thisRun.length && <p>Each step of the journey appears here.</p>}
      </aside>
    </div>
  )
}

function Consent({ t, run, busy, lang, setLang }: ScreenProps & { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <section className="stack">
      <p className="lede">{t.appTagline}</p>
      <h1>{t.chooseLanguage}</h1>
      <div className="choices">
        <button type="button" className={lang === 'en' ? 'choice on' : 'choice'} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
        <button type="button" className={lang === 'hi' ? 'choice on' : 'choice'} aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>हिन्दी</button>
        <button type="button" className="choice" disabled>ಕನ್ನಡ <small>{t.comingSoon}</small></button>
        <button type="button" className="choice" disabled>தமிழ் <small>{t.comingSoon}</small></button>
      </div>
      <h2>{t.consentTitle}</h2>
      <p>{t.consentText}</p>
      <button type="button" className="primary" disabled={busy} onClick={() => run(() => sendEvent('consent_granted'))}>{t.agree}</button>
    </section>
  )
}

function Talk({ t, run, busy, lang }: ScreenProps & { lang: Lang }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const recognition = useRef<any>(null)

  const toggleVoice = () => {
    if (listening) { recognition.current?.stop(); return }
    const Speech = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!Speech) { setVoiceError(t.voiceUnavailable); return }
    const r = new Speech()
    r.lang = speechLang[lang]
    r.continuous = true
    r.interimResults = false
    r.onresult = (e: any) => {
      const heard = Array.from(e.results as any[]).slice(e.resultIndex).map((res: any) => res[0].transcript).join(' ')
      setText(old => `${old} ${heard}`.trim())
    }
    r.onerror = () => { setVoiceError(t.voiceUnavailable); setListening(false) }
    r.onend = () => setListening(false)
    recognition.current = r
    setVoiceError('')
    setListening(true)
    r.start()
  }

  return (
    <section className="stack">
      <h1>{t.talkTitle}</h1>
      <p>{t.talkHint}</p>
      <button type="button" className={listening ? 'mic on' : 'mic'} aria-pressed={listening} onClick={toggleVoice}>
        {listening ? t.stop : t.talk}
      </button>
      {voiceError && <p className="notice" role="status">{voiceError}</p>}
      <textarea id="answer" aria-label={t.talkHint} rows={6} maxLength={4000} placeholder={t.placeholder} value={text} onChange={e => setText(e.target.value)} />
      <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => run(() => sendEvent('input_submitted', { text }))}>
        {busy ? t.working : t.continue}
      </button>
    </section>
  )
}

function Readback({ t, run, busy, revision, lang }: ScreenProps & { lang: Lang }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [text, setText] = useState('')

  useEffect(() => {
    list('/worker/MyTasks').then(rows => {
      setTasks(rows)
      setText(rows.map(r => r.task).join('. '))
    }).catch(() => setTasks([]))
  }, [revision])

  const readAloud = () => {
    const speech = new SpeechSynthesisUtterance(tasks.map(x => x.task).join('. '))
    speech.lang = speechLang[lang]
    window.speechSynthesis?.speak(speech)
  }

  return (
    <section className="stack">
      <h1>{t.readbackTitle}</h1>
      <ul className="cards">
        {tasks.map(x => (
          <li key={x.ID}>
            <strong>{x.task}</strong>
            {(x.tool || x.frequency) && <small>{[x.tool, x.frequency].filter(Boolean).join(' · ')}</small>}
            {x.example && <small>{x.example}</small>}
          </li>
        ))}
      </ul>
      <button type="button" onClick={readAloud}>{t.readAloud}</button>
      <button type="button" className="primary" disabled={busy || !tasks.length} onClick={() => run(() => sendEvent('readback_confirmed'))}>
        {busy ? t.working : t.yesCorrect}
      </button>
      <label htmlFor="correction">{t.editHint}</label>
      <textarea id="correction" rows={4} maxLength={4000} value={text} onChange={e => setText(e.target.value)} />
      <button type="button" disabled={busy || !text.trim()} onClick={() => run(() => sendEvent('input_submitted', { text }))}>{t.checkAgain}</button>
    </section>
  )
}

function Home({ t, run, revision, busy, stage }: ScreenProps & { stage: string }) {
  const [tab, setTab] = useState<'skills' | 'match' | 'learn' | 'passport'>('skills')
  const [decision, setDecision] = useState<any>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    list('/worker/MyDecisions?$orderby=createdAt desc&$top=1').then(rows => setDecision(rows[0] ?? null)).catch(() => setDecision(null))
    list('/worker/Skills').then(rows => setNames(Object.fromEntries(rows.map(s => [s.ID, s.name])))).catch(() => setNames({}))
  }, [revision])

  const props = { t, run, revision, busy, names: { ...names, ...t.skillNames }, stage }
  return (
    <section className="stack">
      {stage === 'AWAITING_MANAGER' && <p className="notice">{t.waitingManager}</p>}
      {stage === 'SHORTLISTED' && <p className="success">{t.shortlisted}</p>}
      {stage === 'ACTIVE' && decision && decision.outcome !== 'shortlist' && (
        <p className="notice">
          {decision.outcome === 'not_yet' ? t.decisionNotYet : t.decisionMore} <strong>{decision.reasons}</strong>
        </p>
      )}
      <nav className="tabs">
        {(['skills', 'match', 'learn', 'passport'] as const).map(name => (
          <button type="button" key={name} className={tab === name ? 'tab on' : 'tab'} aria-pressed={tab === name} onClick={() => setTab(name)}>{t[name]}</button>
        ))}
      </nav>
      {tab === 'skills' && <Skills {...props} />}
      {tab === 'match' && <Match {...props} />}
      {tab === 'learn' && <Learn {...props} />}
      {tab === 'passport' && <Passport {...props} />}
      <hr />
      {!confirming && <button type="button" className="quiet" onClick={() => setConfirming(true)}>{t.deleteData}</button>}
      {confirming && (
        <div className="stack">
          <p>{t.deleteConfirm}</p>
          <button type="button" className="danger" disabled={busy} onClick={() => run(() => sendEvent('consent_revoked'))}>{t.yesDelete}</button>
          <button type="button" onClick={() => setConfirming(false)}>{t.noKeep}</button>
        </div>
      )}
    </section>
  )
}

type HomeProps = ScreenProps & { names: Record<string, string>; stage: string }

const Chip = ({ status, t }: { status: string; t: Texts }) => (
  <span className={`chip ${status}`}>{t[status as 'verified' | 'self_reported' | 'needs_evidence'] ?? t.needs_evidence}</span>
)

function Skills({ t, revision, names }: HomeProps) {
  const [skills, setSkills] = useState<any[]>([])
  useEffect(() => { list('/worker/MySkills').then(setSkills).catch(() => setSkills([])) }, [revision])
  return (
    <>
      <h1>{t.yourSkills}</h1>
      <p>{t.verifiedMeans}</p>
      {!skills.length && <p>{t.noSkills}</p>}
      <ul className="cards">
        {skills.map(s => (
          <li key={s.ID}>
            <strong>{names[s.skill_ID] ?? s.skill_ID}</strong>
            <Chip status={s.status} t={t} />
          </li>
        ))}
      </ul>
    </>
  )
}

function Match({ t, run, revision, busy, names, stage }: HomeProps) {
  const [matches, setMatches] = useState<any[]>([])
  const [vacancies, setVacancies] = useState<any[]>([])
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [optIn, setOptIn] = useState(false)
  const [market, setMarket] = useState<any[]>([])

  useEffect(() => {
    list('/worker/MyMatches').then(setMatches).catch(() => setMatches([]))
    list('/worker/Vacancies').then(setVacancies).catch(() => setVacancies([]))
    list('/worker/Roles').then(rows => setRoles(Object.fromEntries(rows.map(r => [r.ID, r.title])))).catch(() => setRoles({}))
    list('/worker/Me').then(rows => setOptIn(Boolean(rows[0]?.outsideOptIn))).catch(() => setOptIn(false))
    parsed('/worker/marketSignal()').then(setMarket).catch(() => setMarket([]))
  }, [revision])

  const withVacancy = matches.map(m => ({ ...m, vacancy: vacancies.find(v => v.ID === m.vacancy_ID) }))
  const internal = withVacancy.filter(m => !m.vacancy?.isExternal)
  const external = withVacancy.filter(m => m.vacancy?.isExternal)

  return (
    <>
      <h1>{t.opportunity}</h1>
      {internal.map(m => <MatchCard key={m.ID} m={m} t={t} names={names} title={roles[m.vacancy?.role_ID]} />)}
      {stage === 'ACTIVE' && (
        <button type="button" className="primary" disabled={busy} onClick={() => run(() => sendEvent('review_requested'))}>{t.requestReview}</button>
      )}
      {stage !== 'SHORTLISTED' && (
        <label className="check">
          <input id="outside-opt-in" type="checkbox" checked={optIn} disabled={busy || stage !== 'ACTIVE'} onChange={e => run(() => sendEvent('outside_opt_in', { optIn: e.target.checked }))} />
          {t.outsideToggle}
        </label>
      )}
      {optIn && external.map(m => (
        <MatchCard key={m.ID} m={m} t={t} names={names} title={`${roles[m.vacancy?.role_ID]} · ${m.vacancy?.employer} (${t.jobs})`} />
      ))}
      {optIn && market.length > 0 && (
        <>
          <h2>{t.inDemand}</h2>
          <ul className="cards">
            {market.map(s => <li key={s.skill}><strong>{names[s.skill] ?? s.skill}</strong><small>{s.demandCount} {t.jobs}</small></li>)}
          </ul>
        </>
      )}
    </>
  )
}

function MatchCard({ m, t, names, title }: { m: any; t: Texts; names: Record<string, string>; title?: string }) {
  const strengths = parseJson<string[]>(m.strengths, [])
  const gaps = parseJson<any[]>(m.gaps, [])
  const trace = parseJson<any[]>(m.ruleTrace, [])
  return (
    <article className="match">
      <h2>{title}</h2>
      <p className="score"><strong>{m.score}%</strong> {t.skillMatch} <small>({t.illustrative})</small></p>
      <div className="meter" role="img" aria-label={`${m.score}%`}><span style={{ width: `${m.score}%` }} /></div>
      <h3>{t.whyMatch}</h3>
      <ul className="plain">{strengths.map(s => <li key={s}>{names[s] ?? s}</li>)}</ul>
      <h3>{t.gaps}</h3>
      <ul className="plain">{gaps.map(g => <li key={g.skill}>{names[g.skill] ?? g.skill} <Chip status={g.status} t={t} /></li>)}</ul>
      <details>
        <summary>{t.rules}</summary>
        <ul className="plain small">
          {trace.map(r => <li key={r.skill}>{names[r.skill] ?? r.skill}: {t.weight} {r.weight} × {t.credit} {r.credit}</li>)}
        </ul>
      </details>
    </article>
  )
}

function Learn({ t, run, revision, busy }: HomeProps) {
  const [plan, setPlan] = useState<any>(null)
  const [modules, setModules] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<boolean | null>(null)

  useEffect(() => {
    list('/worker/MyPlan').then(rows => setPlan(rows[0] ?? null)).catch(() => setPlan(null))
    list('/worker/LearningModules').then(setModules).catch(() => setModules([]))
  }, [revision])

  const order = parseJson<string[]>(plan?.modules, [])
  const completed = parseJson<string[]>(plan?.completed, [])

  const submit = (module: string) => run(async () => {
    const outcome = await sendEvent('assessment_submitted', { module, answer: answers[module] ?? '' })
    setResult(outcome.passed)
  })

  return (
    <>
      <h1>{t.pathway}</h1>
      {result === true && <p className="success" role="status">{t.passed}</p>}
      {result === false && <p className="notice" role="status">{t.tryAgain}</p>}
      {!order.length && <p>{t.noGaps}</p>}
      <ol className="cards">
        {order.map(id => modules.find(m => m.ID === id)).filter(Boolean).map((m: any) => {
          const isDone = completed.includes(m.ID)
          return (
            <li key={m.ID}>
              <strong>{t.moduleText[m.ID]?.title ?? m.title}</strong>
              <small>{m.durationMin} {t.minutes}{isDone ? ` · ${t.done}` : ''}</small>
              <a href={m.url} target="_blank" rel="noreferrer">{t.openLesson} (SAP Learning)</a>
              {!isDone && <button type="button" disabled={busy} onClick={() => run(() => sendEvent('module_completed', { module: m.ID }))}>{t.markDone}</button>}
              {isDone && m.practiceQuestion && (
                <div className="stack">
                  <h3>{t.practice}</h3>
                  <p>{t.moduleText[m.ID]?.question ?? m.practiceQuestion}</p>
                  <input id={`answer-${m.ID}`} aria-label={t.yourAnswer} placeholder={t.yourAnswer} value={answers[m.ID] ?? ''} onChange={e => setAnswers(a => ({ ...a, [m.ID]: e.target.value }))} />
                  <button type="button" className="primary" disabled={busy || !answers[m.ID]?.trim()} onClick={() => submit(m.ID)}>{t.submit}</button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

function Passport({ t, run, revision, busy, names }: HomeProps) {
  const [skills, setSkills] = useState<any[]>([])
  const [links, setLinks] = useState<any[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  useEffect(() => {
    list("/worker/MySkills?$filter=status eq 'verified'").then(setSkills).catch(() => setSkills([]))
    list('/passport/MyLinks?$filter=revokedAt eq null').then(setLinks).catch(() => setLinks([]))
  }, [revision])

  const toggle = (id: string) => setChosen(old => {
    const next = new Set(old)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <>
      <h1>{t.passportTitle}</h1>
      <p>{t.passportHint}</p>
      {!skills.length && <p>{t.noVerified}</p>}
      {skills.map(s => (
        <label className="check" key={s.ID}>
          <input id={`share-${s.skill_ID}`} type="checkbox" checked={chosen.has(s.skill_ID)} onChange={() => toggle(s.skill_ID)} />
          {names[s.skill_ID] ?? s.skill_ID}
        </label>
      ))}
      {skills.length > 0 && (
        <button type="button" className="primary" disabled={busy || !chosen.size} onClick={() => run(async () => {
          await value('/passport/createLink', { skills: [...chosen] })
          setChosen(new Set())
        })}>{t.createLink}</button>
      )}
      {links.length > 0 && <h2>{t.activeLinks}</h2>}
      {links.map(link => <ShareLink key={link.ID} link={link} t={t} run={run} busy={busy} names={names} />)}
    </>
  )
}

function ShareLink({ link, t, run, busy, names }: { link: any; t: Texts; run: Run; busy: boolean; names: Record<string, string> }) {
  const [qr, setQr] = useState('')
  const url = `${location.origin}/check.html#${link.token}`
  useEffect(() => { QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setQr).catch(() => setQr('')) }, [url])
  const shared = parseJson<string[]>(link.skills, [])
  return (
    <article className="match">
      <p>{shared.map(s => names[s] ?? s).join(', ')}</p>
      {qr && <img src={qr} width={200} height={200} alt="QR code for this share link" />}
      <a href={url} target="_blank" rel="noreferrer">{t.openLink}</a>
      <button type="button" className="danger" disabled={busy} onClick={() => run(() => value('/passport/cancelLink', { token: link.token }))}>{t.cancelLink}</button>
    </article>
  )
}
