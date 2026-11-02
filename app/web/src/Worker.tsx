import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button, Card, CardHeader, Label, List, ListItemStandard, MessageStrip, Option,
  Select, Tab, TabContainer, Text, TextArea, Timeline, TimelineItem, Title
} from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/microphone.js'
import '@ui5/webcomponents-icons/dist/sys-enter-2.js'
import '@ui5/webcomponents-icons/dist/ai.js'
import { AI_ROUTE, list, parseJson, sendEvent, value } from './api'
import { Lang, speechLang, texts, Texts } from './i18n'
import { Certificates, Jobs, Learn, Resume, Skills } from './WorkerTabs'
import { ProfileCard } from './ui'
import type { User } from './main'

export type Run = (action: () => Promise<unknown>) => Promise<void>
type ScreenProps = { t: Texts; run: Run; revision: number; busy: boolean }

const LANG_KEY = 'fs-lang'
function savedLang(): Lang {
  try { return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en' } catch { return 'en' }
}

// Which agent or step each audit event belongs to, for the activity panel.
const ACTIVITY: Record<string, string> = {
  consent_granted: 'Consent recorded',
  consent_revoked: 'Consent withdrawn, data erased',
  input_submitted: 'Agent A: Discovery',
  readback_confirmed: 'Agents B, C, D: Verification, Matching, Pathway',
  verification_requested: 'Verification requested, EWM records attached',
  verification_decided: 'Manager decision, certificate, SuccessFactors, then Agents C and D',
  assessment_submitted: 'Assessment scored, then Agents C and D',
  module_completed: 'Lesson completed',
  outside_opt_in: 'Agents C and F: Matching, Market',
  application_submitted: 'Application sent with certificates',
  application_answered: 'Other company replied',
  review_requested: 'Agent E: Review packet',
  manager_decided: 'Manager decision'
}

export function WorkerApp({ showTrace, user }: { showTrace: boolean; user: User }) {
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
      list('/worker/MyAuditEvents?$orderby=occurredAt desc&$top=20'),
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
  const degraded = thisRun.find(e => e.type === 'input_submitted' || e.type === 'readback_confirmed')?.degraded

  return (
    <div className={showTrace ? 'worker with-trace' : 'worker'}>
      <main className="worker-main">
        {!me && <Text>{t.working}</Text>}
        {me && (
          <ProfileCard
            person={me}
            company={user.company}
            labels={t.profile}
            action={(
              <Select accessibleName={t.chooseLanguage} value={lang} onChange={e => setLang(e.target.value as Lang)}>
                <Option value="en">English</Option>
                <Option value="hi">हिन्दी</Option>
              </Select>
            )}
          />
        )}
        {stage && <Steps stage={stage} t={t} />}
        {error && <MessageStrip design="Negative" hideCloseButton>{error}</MessageStrip>}
        {degraded && <MessageStrip design="Critical" hideCloseButton>{t.degraded}</MessageStrip>}
        {(stage === 'NOT_STARTED' || stage === 'HALTED') && <Consent {...props} />}
        {stage === 'DISCOVERING' && <Talk {...props} lang={lang} />}
        {stage === 'AWAITING_READBACK' && <Readback {...props} lang={lang} />}
        {(stage === 'ACTIVE' || stage === 'AWAITING_MANAGER' || stage === 'SHORTLISTED') && <Home {...props} stage={stage} me={me} user={user} />}
        <p className="fine-print">{t.sampleNote} {AI_ROUTE[route] ? `AI: ${AI_ROUTE[route]}.` : ''}</p>
      </main>
      {showTrace && (
        <aside className="trace" aria-label="Agent activity">
          <Title level="H2" size="H5">Agent activity</Title>
          <Text>AI route: <strong>{AI_ROUTE[route] ?? '…'}</strong></Text>
          {!thisRun.length && <Text>Each step of the journey appears here.</Text>}
          <Timeline>
            {thisRun.map(e => (
              <TimelineItem
                key={e.ID}
                icon={e.type === 'input_submitted' || e.type === 'readback_confirmed' ? 'ai' : 'sys-enter-2'}
                titleText={ACTIVITY[e.type] ?? e.type}
                subtitleText={new Date(e.occurredAt).toLocaleTimeString()}
              >
                <Text>{e.contract} → {e.stage}{e.degraded ? ' · backup used' : ''}</Text>
              </TimelineItem>
            ))}
          </Timeline>
        </aside>
      )}
    </div>
  )
}

const STEP_OF: Record<string, number> = { NOT_STARTED: 0, HALTED: 0, DISCOVERING: 1, AWAITING_READBACK: 2, ACTIVE: 3, AWAITING_MANAGER: 4, SHORTLISTED: 5 }

function Steps({ stage, t }: { stage: string; t: Texts }) {
  const current = STEP_OF[stage] ?? 0
  return (
    <ol className="steps">
      {t.steps.map((label, i) => (
        <li key={label} className={i < current ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="step-dot">{i < current ? '✓' : i + 1}</span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  )
}

function Consent({ t, run, busy }: ScreenProps) {
  return (
    <Card header={<CardHeader titleText={t.consentTitle} />}>
      <div className="card-body">
        <Text>{t.appTagline}</Text>
        <Text>{t.consentText}</Text>
        <Text className="fine-print">{t.moreLanguages}</Text>
        <Button design="Emphasized" disabled={busy} onClick={() => run(() => sendEvent('consent_granted'))}>{t.agree}</Button>
      </div>
    </Card>
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
    <Card header={<CardHeader titleText={t.talkTitle} subtitleText={t.talkHint} />}>
      <div className="card-body">
        <Button icon="microphone" design={listening ? 'Negative' : 'Default'} onClick={toggleVoice}>{listening ? t.stop : t.talk}</Button>
        {voiceError && <MessageStrip design="Critical" hideCloseButton>{voiceError}</MessageStrip>}
        <TextArea accessibleName={t.talkHint} rows={6} maxlength={4000} placeholder={t.placeholder} value={text} onInput={e => setText(e.target.value)} />
        <Button design="Emphasized" disabled={busy || !text.trim()} onClick={() => run(() => sendEvent('input_submitted', { text }))}>
          {busy ? t.working : t.continue}
        </Button>
      </div>
    </Card>
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
    <Card header={<CardHeader titleText={t.readbackTitle} />}>
      <List separators="Inner">
        {tasks.map(x => (
          <ListItemStandard key={x.ID} wrappingType="Normal" description={[x.tool, x.frequency, x.example].filter(Boolean).join(' · ') || undefined}>{x.task}</ListItemStandard>
        ))}
      </List>
      <div className="card-body">
        <div className="actions">
          <Button design="Emphasized" disabled={busy || !tasks.length} onClick={() => run(() => sendEvent('readback_confirmed'))}>
            {busy ? t.working : t.yesCorrect}
          </Button>
          <Button onClick={readAloud}>{t.readAloud}</Button>
        </div>
        <Label for="correction" wrappingType="Normal">{t.editHint}</Label>
        <TextArea id="correction" rows={4} maxlength={4000} value={text} onInput={e => setText(e.target.value)} />
        <Button disabled={busy || !text.trim()} onClick={() => run(() => sendEvent('input_submitted', { text }))}>{t.checkAgain}</Button>
      </div>
    </Card>
  )
}

const TABS = ['skills', 'match', 'learn', 'passport', 'resume'] as const

function Home({ t, run, revision, busy, stage, me, user }: ScreenProps & { stage: string; me: any; user: User }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('skills')
  const [decision, setDecision] = useState<any>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [verified, setVerified] = useState(0)
  const [lessons, setLessons] = useState<[number, number]>([0, 0])

  useEffect(() => {
    list('/worker/MyDecisions?$orderby=createdAt desc&$top=1').then(rows => setDecision(rows[0] ?? null)).catch(() => setDecision(null))
    list('/worker/Skills').then(rows => setNames(Object.fromEntries(rows.map(s => [s.ID, s.name])))).catch(() => setNames({}))
    list("/worker/MySkills?$filter=status eq 'verified'").then(rows => setVerified(rows.length)).catch(() => setVerified(0))
    Promise.all([list('/worker/MyMatches'), list('/worker/Vacancies')]).then(([matches, vacancies]) => {
      const internal = new Set(vacancies.filter(v => !v.isExternal).map(v => v.ID))
      const scores = matches.filter(m => internal.has(m.vacancy_ID)).map(m => m.score)
      setScore(scores.length ? Math.max(...scores) : null)
    }).catch(() => setScore(null))
    list('/worker/MyPlan').then(rows => {
      const completed = parseJson<string[]>(rows[0]?.completed, [])
      // A lesson leaves the plan once its skill is verified, so count it from both lists.
      setLessons([completed.length, new Set([...completed, ...parseJson<string[]>(rows[0]?.modules, [])]).size])
    }).catch(() => setLessons([0, 0]))
  }, [revision])

  const props = { t, run, revision, busy, names: { ...names, ...t.skillNames }, stage, me, user }
  return (
    <>
      {stage === 'AWAITING_MANAGER' && <MessageStrip design="Information" hideCloseButton>{t.waitingManager}</MessageStrip>}
      {stage === 'SHORTLISTED' && <MessageStrip design="Positive" hideCloseButton>{t.shortlisted}</MessageStrip>}
      {stage === 'ACTIVE' && decision && decision.outcome !== 'shortlist' && (
        <MessageStrip design="Information" hideCloseButton>
          {decision.outcome === 'not_yet' ? t.decisionNotYet : t.decisionMore} <strong>{decision.reasons}</strong>
        </MessageStrip>
      )}
      <div className="kpis">
        <div className="kpi"><strong>{verified}</strong><span>{t.verifiedSkills}</span></div>
        <div className="kpi"><strong>{score === null ? '–' : `${score}%`}</strong><span>{t.skillMatch} ({t.illustrative})</span></div>
        <div className="kpi"><strong>{lessons[0]}/{lessons[1]}</strong><span>{t.learn}</span></div>
      </div>
      <TabContainer collapsed onTabSelect={e => setTab(TABS[e.detail.tabIndex])}>
        {TABS.map(name => <Tab key={name} text={t[name]} selected={tab === name} />)}
      </TabContainer>
      {tab === 'skills' && <Skills {...props} />}
      {tab === 'match' && <Jobs {...props} />}
      {tab === 'learn' && <Learn {...props} />}
      {tab === 'passport' && <Certificates {...props} />}
      {tab === 'resume' && <Resume {...props} />}
      {!confirming && <Button design="Transparent" className="delete-data" onClick={() => setConfirming(true)}>{t.deleteData}</Button>}
      {confirming && (
        <div className="card-body">
          <Text>{t.deleteConfirm}</Text>
          <div className="actions">
            <Button design="Negative" disabled={busy} onClick={() => run(() => sendEvent('consent_revoked'))}>{t.yesDelete}</Button>
            <Button onClick={() => setConfirming(false)}>{t.noKeep}</Button>
          </div>
        </div>
      )}
    </>
  )
}
