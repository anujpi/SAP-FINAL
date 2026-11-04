import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Avatar, Button, Card, CardHeader, Dialog, Label, Link, List, ListItemStandard, MessageStrip, ObjectStatus, Option,
  Select, Tab, TabContainer, Text, TextArea, Timeline, TimelineItem, Title
} from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/microphone.js'
import '@ui5/webcomponents-icons/dist/edit.js'
import '@ui5/webcomponents-icons/dist/sys-enter-2.js'
import '@ui5/webcomponents-icons/dist/ai.js'
import { AI_ROUTE, list, parsed, sendEvent, value } from './api'
import { Lang, speechLang, texts, Texts } from './i18n'
import { Certificates, Jobs, Learning, Requests, Resume, Skills } from './WorkerTabs'
import { initials } from './ui'
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
  input_submitted: 'Agent A: understands what they said',
  readback_confirmed: 'Agent B matches the skills library, then EWM records in HANA are checked',
  recording_cancelled: 'Recording cancelled',
  verification_requested: 'Verification requested, EWM records attached',
  verification_decided: 'Manager decision, certificate, SuccessFactors, then Agents C and D',
  assessment_submitted: 'Assessment scored, then Agents C and D',
  module_completed: 'Lesson completed',
  outside_opt_in: 'Agents C and F: Matching, Market',
  application_submitted: 'Application sent with certificates',
  application_answered: 'Other company replied',
  hire_interest_sent: 'A company asked to connect',
  hire_interest_answered: 'Worker answered: permission logged',
  review_requested: 'Agent E: Review packet',
  manager_decided: 'Manager decision'
}

type Result = { found: any[]; unmatched: string[] }

export function WorkerApp({ showTrace, user }: { showTrace: boolean; user: User }) {
  const [lang, setLangState] = useState<Lang>(savedLang)
  const [me, setMe] = useState<any>(null)
  const [trace, setTrace] = useState<any[]>([])
  const [route, setRoute] = useState('')
  const [pending, setPending] = useState<any[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [recording, setRecording] = useState<'' | 'talk' | 'type'>('')
  const [result, setResult] = useState<Result | null>(null)
  const t = texts[lang]

  const setLang = (next: Lang) => {
    setLangState(next)
    try { localStorage.setItem(LANG_KEY, next) } catch { /* the choice just won't be remembered */ }
  }

  const reload = useCallback(async () => {
    const [people, events, activeRoute, unconfirmed] = await Promise.all([
      list('/worker/Me'),
      list('/worker/MyAuditEvents?$orderby=occurredAt desc&$top=20'),
      value<string>('/worker/aiStatus()'),
      list('/worker/MyTasks?$filter=confirmed eq false')
    ])
    setMe(people[0] ?? null)
    setTrace(events)
    setRoute(activeRoute)
    setPending(unconfirmed)
    if (!people[0]) throw new Error("This login isn't linked to a worker, so there's nothing to show. An admin needs to register this email.")
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
  const started = stage && stage !== 'NOT_STARTED' && stage !== 'HALTED'
  // Show this run only. The audit log keeps every earlier run for the manager.
  const runStart = trace.findIndex(e => e.type === 'consent_granted')
  const thisRun = !started ? [] : runStart < 0 ? trace : trace.slice(0, runStart + 1)
  const degraded = thisRun.find(e => e.type === 'input_submitted' || e.type === 'readback_confirmed')?.degraded
  const dialogOpen = Boolean(recording) || pending.length > 0 || Boolean(result)
  const closeDialog = () => { setRecording(''); setResult(null) }

  return (
    <div className={showTrace ? 'worker with-trace' : 'worker'}>
      <main className="worker-main">
        {!me && !error && <Text>{t.working}</Text>}
        {error && <MessageStrip design="Negative" hideCloseButton>{error}</MessageStrip>}
        {me && (
          <section className="worker-hero">
            <div className="hero-who">
              <Avatar initials={initials(me.name)} size="M" colorScheme="Accent10" />
              <div>
                <p className="hero-hello">{t.hello(me.name.split(' ')[0])}</p>
                <p className="hero-job">{[me.jobTitle, user.company].filter(Boolean).join(', ')}</p>
              </div>
              <Select className="hero-lang" accessibleName={t.chooseLanguage} value={lang} onChange={e => setLang(e.target.value as Lang)}>
                <Option value="en">English</Option>
                <Option value="hi">हिन्दी</Option>
              </Select>
            </div>
            {started && (
              <div className="hero-record">
                <h2>{t.recordTitle}</h2>
                <p>{t.recordHint}</p>
                <div className="hero-actions">
                  <Button design="Emphasized" icon="microphone" onClick={() => setRecording('talk')}>{t.talk}</Button>
                  <Button design="Default" icon="edit" onClick={() => setRecording('type')}>{t.typeInstead}</Button>
                </div>
              </div>
            )}
          </section>
        )}
        {degraded && <MessageStrip design="Critical" hideCloseButton>{t.degraded}</MessageStrip>}
        {!started && me && <Consent {...props} />}
        {started && <Home {...props} stage={stage} me={me} user={user} lang={lang} />}
        <p className="fine-print">{t.sampleNote} {AI_ROUTE[route] ? `AI: ${AI_ROUTE[route]}.` : ''} {t.libraryNote}</p>
      </main>

      {started && (
        <Dialog
          open={dialogOpen}
          headerText={result ? t.resultTitle : pending.length ? t.readbackTitle : t.recordTitle}
          className="record-dialog"
          onClose={closeDialog}
        >
          {result
            ? <Found t={t} result={result} onClose={closeDialog} />
            : pending.length
              ? <Readback {...props} lang={lang} tasks={pending} onConfirmed={setResult} />
              : <Talk {...props} lang={lang} startListening={recording === 'talk'} onCancel={closeDialog} />}
        </Dialog>
      )}

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

function Talk({ t, run, busy, lang, startListening, onCancel }: ScreenProps & { lang: Lang; startListening: boolean; onCancel: () => void }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [heardSoFar, setHeardSoFar] = useState('')
  const recognition = useRef<any>(null)

  const toggleVoice = () => {
    if (listening) { recognition.current?.stop(); return }
    const Speech = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!Speech) { setVoiceError(t.voiceUnavailable); return }
    const r = new Speech()
    r.lang = speechLang[lang]
    r.continuous = true
    r.interimResults = true
    r.onresult = (e: any) => {
      const results = Array.from(e.results as any[]).slice(e.resultIndex) as any[]
      const final = results.filter(res => res.isFinal).map(res => res[0].transcript).join(' ')
      if (final) setText(old => `${old} ${final}`.trim())
      setHeardSoFar(results.filter(res => !res.isFinal).map(res => res[0].transcript).join(' '))
    }
    // "aborted" just means it was stopped, so there is nothing to explain.
    r.onerror = (e: any) => { if (e.error !== 'aborted') setVoiceError(t.voiceErrors[e.error] ?? t.voiceUnavailable) }
    r.onend = () => { setListening(false); setHeardSoFar('') }
    recognition.current = r
    setVoiceError('')
    setListening(true)
    try {
      r.start()
    } catch {
      setListening(false)
      setVoiceError(t.voiceUnavailable)
    }
  }

  // Opened with Talk, so start listening straight away.
  useEffect(() => { if (startListening) toggleVoice() }, [])
  useEffect(() => () => recognition.current?.abort?.(), [])

  return (
    <div className="dialog-body">
      <Text>{t.talkHint}</Text>
      <Button icon="microphone" design={listening ? 'Negative' : 'Default'} className={listening ? 'mic live' : 'mic'} onClick={toggleVoice}>
        {listening ? t.stop : t.talk}
      </Button>
      {voiceError && <MessageStrip design="Critical" hideCloseButton>{voiceError}</MessageStrip>}
      {listening && <Text className="fine-print">{heardSoFar || t.listening}</Text>}
      <TextArea accessibleName={t.talkHint} rows={5} maxlength={4000} placeholder={t.placeholder} value={text} onInput={e => setText(e.target.value)} />
      <div className="actions">
        <Button design="Emphasized" disabled={busy || !text.trim()} onClick={() => { recognition.current?.stop(); run(() => sendEvent('input_submitted', { text })) }}>
          {busy ? t.working : t.continue}
        </Button>
        <Button design="Transparent" onClick={onCancel}>{t.cancel}</Button>
      </div>
    </div>
  )
}

function Readback({ t, run, busy, lang, tasks, onConfirmed }: ScreenProps & { lang: Lang; tasks: any[]; onConfirmed: (r: Result) => void }) {
  const [text, setText] = useState(tasks.map(r => r.task).join('. '))
  const [editing, setEditing] = useState(false)

  const readAloud = () => {
    const speech = new SpeechSynthesisUtterance(tasks.map(x => x.task).join('. '))
    speech.lang = speechLang[lang]
    window.speechSynthesis?.speak(speech)
  }

  return (
    <div className="dialog-body">
      <List separators="Inner">
        {tasks.map(x => (
          <ListItemStandard key={x.ID} wrappingType="Normal" description={[x.tool, x.frequency, x.example].filter(Boolean).join(' · ') || undefined}>{x.task}</ListItemStandard>
        ))}
      </List>
      <div className="actions">
        <Button design="Emphasized" disabled={busy} onClick={() => run(async () => {
          const res = await sendEvent('readback_confirmed')
          onConfirmed({ found: res.found ?? [], unmatched: res.unmatched ?? [] })
        })}>
          {busy ? t.checking : t.yesCorrect}
        </Button>
        <Button onClick={readAloud}>{t.readAloud}</Button>
        <Button design="Transparent" onClick={() => setEditing(e => !e)}>{t.change}</Button>
        <Button design="Transparent" disabled={busy} onClick={() => run(() => sendEvent('recording_cancelled'))}>{t.cancel}</Button>
      </div>
      {busy && <Text className="fine-print">{t.checkingHint}</Text>}
      {editing && (
        <>
          <Label for="correction" wrappingType="Normal">{t.editHint}</Label>
          <TextArea id="correction" rows={4} maxlength={4000} value={text} onInput={e => setText(e.target.value)} />
          <Button disabled={busy || !text.trim()} onClick={() => run(() => sendEvent('input_submitted', { text }))}>{t.checkAgain}</Button>
        </>
      )}
    </div>
  )
}

const FOUND_STATE: Record<string, 'Positive' | 'Information' | 'None'> = { work_records: 'Positive', self_reported: 'Information', needs_evidence: 'None' }

/** What this one recording found: matched skills, what the records showed, and anything that matched nothing. */
function Found({ t, result, onClose }: { t: Texts; result: Result; onClose: () => void }) {
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    list('/worker/Skills').then(rows => setNames(Object.fromEntries(rows.map(s => [s.ID, s.name])))).catch(() => setNames({}))
  }, [])
  const name = (id: string) => t.skillNames[id] ?? names[id] ?? id
  return (
    <div className="dialog-body">
      {!result.found.length && <MessageStrip design="Information" hideCloseButton>{t.nothingFound}</MessageStrip>}
      {result.found.length > 0 && (
        <ul className="found-list">
          {result.found.map(f => (
            <li key={f.skill_ID}>
              <div className="skill-row-head">
                <span>{name(f.skill_ID)} {f.isNew && <span className="new-tag">{t.newTag}</span>}</span>
                <ObjectStatus state={FOUND_STATE[f.status] ?? 'None'}>{t[f.status as 'work_records' | 'self_reported' | 'needs_evidence'] ?? f.status}</ObjectStatus>
              </div>
              <Text className="fine-print">{f.basis ? t.youSaid(f.basis) : t.notMentioned}</Text>
            </li>
          ))}
        </ul>
      )}
      {result.unmatched.length > 0 && (
        <>
          <Title level="H3" size="H6">{t.notInLibrary}</Title>
          <ul className="plain">{result.unmatched.map(u => <li key={u}>{u}</li>)}</ul>
          <Text className="fine-print">{t.notInLibraryHint}</Text>
        </>
      )}
      <Text className="fine-print">{t.managerDecides}</Text>
      <div className="actions"><Button design="Emphasized" onClick={onClose}>{t.close}</Button></div>
    </div>
  )
}

const TABS = ['skills', 'learn', 'match', 'requests', 'passport', 'resume'] as const

function Home({ t, run, revision, busy, stage, me, user, lang }: ScreenProps & { stage: string; me: any; user: User; lang: Lang }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('skills')
  // A notification can open a tab.
  useEffect(() => {
    const open = (e: Event) => setTab((e as CustomEvent).detail)
    addEventListener('worker-tab', open)
    return () => removeEventListener('worker-tab', open)
  }, [])
  const [decision, setDecision] = useState<any>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [counts, setCounts] = useState({ verified: 0, records: 0, certificates: 0 })
  const [waiting, setWaiting] = useState(0)
  const [move, setMove] = useState<any>(null)

  useEffect(() => {
    parsed<any>('/worker/myHireRequests()').then(r => {
      setWaiting(r.requests.filter((q: any) => q.status === 'pending').length)
      setMove(['joined', 'accepted', 'offered'].map(s => r.access.find((a: any) => a.status === s && !a.cancelled)).find(Boolean) ?? null)
    }).catch(() => { setWaiting(0); setMove(null) })
    list('/worker/MyDecisions?$orderby=createdAt desc&$top=1').then(rows => setDecision(rows[0] ?? null)).catch(() => setDecision(null))
    list('/worker/Skills').then(rows => setNames(Object.fromEntries(rows.map(s => [s.ID, s.name])))).catch(() => setNames({}))
    Promise.all([list('/worker/MySkills'), list('/passport/MyCredentials')]).then(([skills, certs]) => setCounts({
      verified: skills.filter(s => s.status === 'verified').length,
      records: skills.filter(s => s.status === 'work_records').length,
      certificates: certs.length
    })).catch(() => setCounts({ verified: 0, records: 0, certificates: 0 }))
    Promise.all([list('/worker/MyMatches'), list('/worker/Vacancies')]).then(([matches, vacancies]) => {
      const internal = new Set(vacancies.filter(v => !v.isExternal).map(v => v.ID))
      const scores = matches.filter(m => internal.has(m.vacancy_ID)).map(m => m.score)
      setScore(scores.length ? Math.max(...scores) : null)
    }).catch(() => setScore(null))
  }, [revision])

  const props = { t, run, revision, busy, names: { ...names, ...t.skillNames }, stage, me, user, lang }
  const kpi = (n: string | number, label: string, go: (typeof TABS)[number]) => (
    <button type="button" className="kpi" onClick={() => setTab(go)}><strong>{n}</strong><span>{label}</span></button>
  )
  return (
    <>
      {stage === 'AWAITING_MANAGER' && <MessageStrip design="Information" hideCloseButton>{t.waitingManager}</MessageStrip>}
      {stage === 'SHORTLISTED' && <MessageStrip design="Positive" hideCloseButton>{decision?.outcome === 'move_to_role' ? t.movedToRole(me.jobTitle) : t.shortlisted}</MessageStrip>}
      {stage === 'ACTIVE' && decision && decision.outcome !== 'shortlist' && decision.outcome !== 'move_to_role' && (
        <MessageStrip design="Information" hideCloseButton>
          {decision.outcome === 'not_yet' ? t.decisionNotYet : t.decisionMore} <strong>{decision.reasons}</strong>
        </MessageStrip>
      )}
      {move?.status === 'offered' && <MessageStrip design="Information" hideCloseButton><strong>{t.offerFrom(move.company, move.role)}</strong> <Link onClick={() => setTab('requests')}>{t.acceptOffer}</Link></MessageStrip>}
      {move?.status === 'accepted' && <MessageStrip design="Positive" hideCloseButton>{t.servingNotice(new Date(move.leavesOn).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), move.company)}</MessageStrip>}
      {move?.status === 'joined' && <MessageStrip design="Positive" hideCloseButton>{t.joinedCompany(move.company)}</MessageStrip>}
      {waiting > 0 && <MessageStrip design="Information" hideCloseButton><strong>{t.requestsWaiting(waiting)}</strong></MessageStrip>}
      <div className="kpis four">
        {kpi(counts.verified, t.verifiedSkills, 'skills')}
        {kpi(counts.records, t.work_records, 'skills')}
        {kpi(counts.certificates, t.passport, 'passport')}
        {kpi(score === null ? '–' : `${score}%`, `${t.skillMatch} (${t.illustrative})`, 'match')}
      </div>
      <TabContainer collapsed onTabSelect={e => setTab(TABS[e.detail.tabIndex])}>
        {TABS.map(name => <Tab key={name} text={t[name]} selected={tab === name} />)}
      </TabContainer>
      {tab === 'skills' && <Skills {...props} />}
      {tab === 'learn' && <Learning {...props} />}
      {tab === 'match' && <Jobs {...props} />}
      {tab === 'requests' && <Requests {...props} />}
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

