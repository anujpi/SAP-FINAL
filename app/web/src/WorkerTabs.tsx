import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  Button, Card, CardHeader, CheckBox, Input, Link, List, ListItemStandard, MessageStrip, ObjectStatus,
  Panel, ProgressIndicator, Text, Title
} from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/print.js'
import { list, parseJson, parsed, sendEvent, value } from './api'
import type { Texts } from './i18n'
import { ProfileCard } from './ui'
import type { Run } from './Worker'
import type { User } from './main'

type HomeProps = { t: Texts; run: Run; revision: number; busy: boolean; names: Record<string, string>; stage: string; me: any; user: User; lang?: string }

// Unverified is never shown as a negative state.
const CHIP_STATE: Record<string, 'Positive' | 'Information' | 'None' | 'Critical'> = { verified: 'Positive', work_records: 'Positive', self_reported: 'Information', needs_evidence: 'None', missing_for_role: 'Critical' }
const chipText = (status: string, t: Texts) => t[status as 'verified' | 'work_records' | 'self_reported' | 'needs_evidence' | 'missing_for_role'] ?? t.needs_evidence
// Strongest first: proven, then what the records show, then what they said.
const SKILL_ORDER = ['verified', 'work_records', 'self_reported', 'needs_evidence']
const dateOf = (iso: string) => new Date(iso).toLocaleDateString()

export function Skills({ t, run, revision, busy, names }: HomeProps) {
  const [skills, setSkills] = useState<any[]>([])
  const [ewm, setEwm] = useState<Record<string, any>>({})
  const [requests, setRequests] = useState<any[]>([])

  useEffect(() => {
    list('/worker/MySkills').then(setSkills).catch(() => setSkills([]))
    parsed('/worker/myEwmSupport()').then(setEwm).catch(() => setEwm({}))
    list('/worker/MyRequests?$orderby=createdAt desc').then(setRequests).catch(() => setRequests([]))
  }, [revision])

  const groups = [
    { key: 'verified', title: t.groupVerified, rows: skills.filter(s => s.status === 'verified') },
    { key: 'records', title: t.groupRecords, rows: skills.filter(s => s.status === 'work_records') },
    { key: 'said', title: t.groupSaid, rows: skills.filter(s => s.status !== 'verified' && s.status !== 'work_records') }
  ].filter(g => g.rows.length)
  return (
    <Card header={<CardHeader titleText={t.yourSkills} subtitleText={t.skillsChecked} />}>
      {!skills.length && <div className="card-body"><Text>{t.noSkills}</Text></div>}
      {groups.map(g => (
      <section key={g.key} className="skill-group">
      <h3 className="group-title">{g.title} <span>{g.rows.length}</span></h3>
      <ul className="skill-rows">
        {[...g.rows].sort((a, b) => SKILL_ORDER.indexOf(a.status) - SKILL_ORDER.indexOf(b.status)).map(s => {
          const latest = requests.find(r => r.skill_ID === s.skill_ID)
          const support = ewm[s.skill_ID]
          return (
            <li key={s.ID}>
              <div className="skill-row-head">
                <span>{names[s.skill_ID] ?? s.skill_ID}</span>
                <ObjectStatus state={CHIP_STATE[s.status] ?? 'None'}>{chipText(s.status, t)}{s.status === 'verified' ? ` · ${t.level} ${s.proficiency}` : ''}</ObjectStatus>
              </div>
              {s.status !== 'verified' && (
                <>
                  {s.basis ? <Text className="fine-print">{t.youSaid(s.basis)}</Text> : s.source === 'work_records' && <Text className="fine-print">{t.notMentioned}</Text>}
                  <Text className="fine-print">{support ? t.ewmFound(support.tasks, support.lastDate) : t.ewmNone}</Text>
                  {latest?.status === 'not_yet' && <MessageStrip design="Information" hideCloseButton>{t.decisionNotYet} <strong>{latest.note}</strong></MessageStrip>}
                  {latest?.status === 'pending'
                    ? <ObjectStatus state="Information">{t.requestSent}</ObjectStatus>
                    : <Button disabled={busy} onClick={() => run(() => sendEvent('verification_requested', { skill: s.skill_ID }))}>{t.requestVerify}</Button>}
                </>
              )}
            </li>
          )
        })}
      </ul>
      </section>
      ))}
    </Card>
  )
}

export function Jobs({ t, run, revision, busy, names, stage }: HomeProps) {
  const [matches, setMatches] = useState<any[]>([])
  const [vacancies, setVacancies] = useState<any[]>([])
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [optIn, setOptIn] = useState(false)
  const [market, setMarket] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [certificates, setCertificates] = useState<any[]>([])
  const [joined, setJoined] = useState(true)

  useEffect(() => {
    value<boolean>('/worker/marketplace()').then(v => setJoined(Boolean(v))).catch(() => setJoined(false))
    list('/worker/MyMatches').then(setMatches).catch(() => setMatches([]))
    list('/worker/Vacancies').then(setVacancies).catch(() => setVacancies([]))
    list('/worker/Roles').then(rows => setRoles(Object.fromEntries(rows.map(r => [r.ID, r.title])))).catch(() => setRoles({}))
    list('/worker/Me').then(rows => setOptIn(Boolean(rows[0]?.outsideOptIn))).catch(() => setOptIn(false))
    parsed('/worker/marketSignal()').then(setMarket).catch(() => setMarket([]))
    list('/worker/MyApplications').then(setApplications).catch(() => setApplications([]))
    list('/passport/MyCredentials').then(setCertificates).catch(() => setCertificates([]))
  }, [revision])

  const withVacancy = matches.map(m => ({ ...m, vacancy: vacancies.find(v => v.ID === m.vacancy_ID) }))
  const internal = withVacancy.filter(m => !m.vacancy?.isExternal)
  const external = withVacancy.filter(m => m.vacancy?.isExternal)

  return (
    <>
      {internal.map(m => <MatchCard key={m.ID} m={m} t={t} names={names} title={roles[m.vacancy?.role_ID]} />)}
      {stage === 'ACTIVE' && (
        <Button design="Emphasized" disabled={busy} onClick={() => run(() => sendEvent('review_requested'))}>{t.requestReview}</Button>
      )}

      <Title level="H2" size="H5">{t.otherJobs}</Title>
      {!joined && <MessageStrip design="Information" hideCloseButton>{t.marketplaceOff}</MessageStrip>}
      {joined && <Text className="fine-print">{t.privateNote}</Text>}
      {joined && stage !== 'SHORTLISTED' && (
        <CheckBox wrappingType="Normal" text={t.outsideToggle} checked={optIn} disabled={busy} onChange={e => run(() => sendEvent('outside_opt_in', { optIn: e.target.checked }))} />
      )}
      {joined && optIn && external.map(m => {
        const application = applications.find(a => a.vacancy_ID === m.vacancy_ID)
        return (
          <MatchCard key={m.ID} m={m} t={t} names={names} title={`${roles[m.vacancy?.role_ID]} · ${m.vacancy?.employer}${m.vacancy?.source === 'posted' ? ` (${t.newRole})` : ''}`}>
            {application && (
              <>
                <ObjectStatus state={application.status === 'interview' ? 'Positive' : 'Information'}>{t[application.status as 'applied' | 'interview' | 'closed'] ?? application.status}</ObjectStatus>
                {application.message && <MessageStrip design="Information" hideCloseButton><strong>{m.vacancy?.employer}:</strong> {application.message}</MessageStrip>}
              </>
            )}
            {!application && !certificates.length && <Text className="fine-print">{t.needCert}</Text>}
            {!application && certificates.length > 0 && (
              <>
                <Button
                  design="Emphasized"
                  disabled={busy}
                  onClick={() => run(() => sendEvent('application_submitted', { vacancy: m.vacancy_ID, skills: certificates.map(c => c.skill_ID) }))}
                >
                  {t.apply}
                </Button>
                <Text className="fine-print">{t.applyNote}</Text>
              </>
            )}
          </MatchCard>
        )
      })}
      {joined && optIn && market.length > 0 && (
        <Card header={<CardHeader titleText={t.inDemand} />}>
          <List separators="Inner">
            {market.map(s => <ListItemStandard key={s.skill} additionalText={`${s.demandCount} ${t.jobs}`}>{names[s.skill] ?? s.skill}</ListItemStandard>)}
          </List>
        </Card>
      )}
    </>
  )
}

function MatchCard({ m, t, names, title, children }: { m: any; t: Texts; names: Record<string, string>; title?: string; children?: React.ReactNode }) {
  const strengths = parseJson<string[]>(m.strengths, [])
  const gaps = parseJson<any[]>(m.gaps, [])
  const trace = parseJson<any[]>(m.ruleTrace, [])
  return (
    <Card header={<CardHeader titleText={title ?? t.opportunity} subtitleText={t.opportunity} />}>
      <div className="card-body">
        <p className="score"><strong>{m.score}%</strong> {t.skillMatch} <small>({t.illustrative})</small></p>
        <ProgressIndicator value={m.score} accessibleName={t.skillMatch} displayValue=" " />
        <Title level="H3" size="H6">{t.whyMatch}</Title>
        <ul className="plain">{strengths.map(s => <li key={s}>{names[s] ?? s}</li>)}</ul>
        <Title level="H3" size="H6">{t.gaps}</Title>
        <ul className="plain">
          {gaps.map(g => <li key={g.skill}>{names[g.skill] ?? g.skill} <ObjectStatus state={CHIP_STATE[g.status] ?? 'None'}>{chipText(g.status, t)}</ObjectStatus></li>)}
        </ul>
        <Panel headerText={t.rules} collapsed>
          <ul className="plain">
            {trace.map(r => <li key={r.skill}>{names[r.skill] ?? r.skill}: {t.weight} {r.weight} × {t.credit} {r.credit}</li>)}
          </ul>
        </Panel>
        {children}
      </div>
    </Card>
  )
}

/** The worker's permissions: who is asking, and who can see their certificates right now. */
export function Requests({ t, run, revision, busy, names }: HomeProps) {
  const [data, setData] = useState<{ requests: any[]; access: any[] }>({ requests: [], access: [] })
  const [certificates, setCertificates] = useState<any[]>([])
  const [chosen, setChosen] = useState<Record<string, string[]>>({})

  useEffect(() => {
    parsed<any>('/worker/myHireRequests()').then(setData).catch(() => setData({ requests: [], access: [] }))
    list('/passport/MyCredentials').then(setCertificates).catch(() => setCertificates([]))
  }, [revision])

  const pending = data.requests.filter(r => r.status === 'pending')
  const toggle = (id: string, skill: string) => setChosen(old => {
    const now = old[id] ?? []
    return { ...old, [id]: now.includes(skill) ? now.filter(s => s !== skill) : [...now, skill] }
  })

  return (
    <>
      <Card header={<CardHeader titleText={t.permissionTitle} />}>
        <div className="card-body">
          <ol className="plain">
            {t.permissionSteps.map(step => <li key={step}>{step}</li>)}
          </ol>
        </div>
      </Card>

      {!pending.length && <Text>{t.noRequests}</Text>}
      {pending.map(r => (
        <Card key={r.ID} header={<CardHeader titleText={t.wantsToConnect(r.company)} subtitleText={`${r.role} · ${r.site}`} />}>
          <div className="card-body">
            <p className="score"><strong>{r.score}%</strong> {t.skillMatch} <small>({t.illustrative})</small></p>
            {r.message && <MessageStrip design="Information" hideCloseButton><strong>{r.company}:</strong> {r.message}</MessageStrip>}
            <Title level="H3" size="H6">{t.chooseCerts}</Title>
            {!certificates.length && <Text className="fine-print">{t.needCert}</Text>}
            {certificates.map(c => (
              <CheckBox key={c.ID} wrappingType="Normal" text={names[c.skill_ID] ?? c.skill_ID} checked={(chosen[r.ID] ?? []).includes(c.skill_ID)} onChange={() => toggle(r.ID, c.skill_ID)} />
            ))}
            <Text className="fine-print">{t.onlyThisCompany(r.company)}</Text>
            <div className="actions">
              <Button design="Emphasized" disabled={busy || !chosen[r.ID]?.length} onClick={() => run(() => sendEvent('hire_interest_answered', { interest: r.ID, grant: true, skills: chosen[r.ID] }))}>{t.shareConnect}</Button>
              <Button disabled={busy} onClick={() => run(() => sendEvent('hire_interest_answered', { interest: r.ID, grant: false }))}>{t.notNow}</Button>
            </div>
          </div>
        </Card>
      ))}

      <Card header={<CardHeader titleText={t.whoCanSee} subtitleText={t.privateNote} />}>
        {!data.access.length && <div className="card-body"><Text>{t.noOneCanSee}</Text></div>}
        <ul className="skill-rows">
          {data.access.map(a => (
            <li key={a.ID}>
              <div className="skill-row-head">
                <span>{a.company} · {a.role}</span>
                <ObjectStatus state={a.cancelled ? 'None' : 'Positive'}>{a.cancelled ? t.accessCancelled : t.canSee}</ObjectStatus>
              </div>
              <Text className="fine-print">{a.skills.map((s: string) => names[s] ?? s).join(', ')}</Text>
              {!a.cancelled && <Button design="Negative" disabled={busy} onClick={() => run(() => value('/passport/cancelLink', { token: a.token }))}>{t.takeBack}</Button>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

const GUIDE_ORDER = ['missing_for_role', 'needs_evidence', 'self_reported', 'work_records']

/** For each skill not yet verified: show it at work, learn it, then ask the manager. */
export function Learning(props: HomeProps) {
  const { t, run, revision, busy, names } = props
  const [guide, setGuide] = useState<any>(null)
  useEffect(() => { parsed('/worker/skillGuide()').then(setGuide).catch(() => setGuide(null)) }, [revision])
  if (!guide) return <Text>{t.working}</Text>
  const name = (s: any) => names[s.skill_ID] ?? s.name
  const open = guide.skills.filter((s: any) => s.status !== 'verified').sort((a: any, b: any) => GUIDE_ORDER.indexOf(a.status) - GUIDE_ORDER.indexOf(b.status))
  const forRole = guide.skills.filter((s: any) => s.neededForRole)
  return (
    <>
      {guide.targetRole && (
        <Card header={<CardHeader titleText={t.goalRole(guide.targetRole)} subtitleText={t.goalHint} />}>
          <div className="card-body chips">
            {forRole.map((s: any) => <ObjectStatus key={s.skill_ID} state={CHIP_STATE[s.status] ?? 'None'}>{name(s)}: {chipText(s.status, t)}</ObjectStatus>)}
          </div>
        </Card>
      )}
      <Title level="H2" size="H5">{t.guideTitle}</Title>
      {!open.length && <Text>{t.allVerified}</Text>}
      {open.map((s: any) => {
        const ewm = s.ewm ?? { tasks: 0, days: 0 }
        const shown = s.trackable && ewm.tasks >= guide.threshold.tasks && ewm.days >= guide.threshold.days
        return (
          <Card key={s.skill_ID} header={<CardHeader titleText={name(s)} subtitleText={s.neededForRole ? t.neededForRole : chipText(s.status, t)} />}>
            <ol className="guide-steps">
              <li className={shown ? 'done' : ''}>
                <strong>{t.stepShow}</strong>
                {s.trackable ? (
                  <>
                    <Text className="fine-print">{t.ewmProgress(ewm.tasks, ewm.days, guide.threshold.tasks, guide.threshold.days)}</Text>
                    <ProgressIndicator value={Math.min(100, Math.round((Math.min(ewm.tasks / guide.threshold.tasks, 1) + Math.min(ewm.days / guide.threshold.days, 1)) * 50))} displayValue=" " accessibleName={t.stepShow} />
                  </>
                ) : <Text className="fine-print">{t.notTrackable}</Text>}
              </li>
              <li>
                <strong>{t.stepLearn}</strong>
                {s.module
                  ? <Link href={s.module.url} target="_blank">{t.openLesson}: {t.moduleText[s.module.ID]?.title ?? s.module.title} ({s.module.durationMin} {t.minutes}, SAP Learning)</Link>
                  : s.escoUri
                    ? <>
                        {s.description && <Text className="fine-print">{s.description}</Text>}
                        <Link href={s.escoUri} target="_blank">{t.readAbout}</Link>
                      </>
                    : <Text className="fine-print">{s.description || t.askManagerHow}</Text>}
              </li>
              <li className={s.request === 'pending' ? 'done' : ''}>
                <strong>{t.stepAsk}</strong>
                {s.request === 'pending'
                  ? <ObjectStatus state="Information">{t.requestSent}</ObjectStatus>
                  : s.status === 'missing_for_role'
                    ? <Text className="fine-print">{t.recordFirst}</Text>
                    : <Button disabled={busy} onClick={() => run(() => sendEvent('verification_requested', { skill: s.skill_ID }))}>{t.requestVerify}</Button>}
              </li>
            </ol>
          </Card>
        )
      })}
      <Title level="H2" size="H5">{t.lessonsForRole}</Title>
      <Learn {...props} />
    </>
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
      {result === true && <MessageStrip design="Positive" hideCloseButton>{t.passed}</MessageStrip>}
      {result === false && <MessageStrip design="Information" hideCloseButton>{t.tryAgain}</MessageStrip>}
      {!order.length && <Text>{t.noGaps}</Text>}
      {order.map(id => modules.find(m => m.ID === id)).filter(Boolean).map((m: any) => {
        const isDone = completed.includes(m.ID)
        return (
          <Card key={m.ID} header={<CardHeader titleText={t.moduleText[m.ID]?.title ?? m.title} subtitleText={`${m.durationMin} ${t.minutes}${isDone ? ` · ${t.done}` : ''}`} />}>
            <div className="card-body">
              <Link href={m.url} target="_blank">{t.openLesson} (SAP Learning)</Link>
              {!isDone && <Button disabled={busy} onClick={() => run(() => sendEvent('module_completed', { module: m.ID }))}>{t.markDone}</Button>}
              {isDone && m.practiceQuestion && (
                <>
                  <Title level="H3" size="H6">{t.practice}</Title>
                  <Text>{t.moduleText[m.ID]?.question ?? m.practiceQuestion}</Text>
                  <Input accessibleName={t.yourAnswer} placeholder={t.yourAnswer} value={answers[m.ID] ?? ''} onInput={e => { const next = e.target.value; setAnswers(a => ({ ...a, [m.ID]: next })) }} />
                  <Button design="Emphasized" disabled={busy || !answers[m.ID]?.trim()} onClick={() => submit(m.ID)}>{t.submit}</Button>
                </>
              )}
            </div>
          </Card>
        )
      })}
    </>
  )
}

function usePrint() {
  const page = useRef<HTMLElement | null>(null)
  const print = () => {
    page.current?.classList.add('printing')
    window.print()
    page.current?.classList.remove('printing')
  }
  return { page, print }
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

function Certificate({ c, t, name, skill }: { c: any; t: Texts; name: string; skill: string }) {
  const { page, print } = usePrint()
  return (
    <div className="certificate-wrap">
      <article className="certificate" ref={page}>
        <div className="cert-frame">
          <header className="cert-head">
            <span className="cert-brand"><span className="cert-logo">FS</span> Frontline Shift</span>
            <span className="cert-no">{t.certNo} {c.ID.slice(0, 8).toUpperCase()}</span>
          </header>
          <p className="cert-kicker">{t.certTitle}</p>
          <p className="cert-line">{t.certThis}</p>
          <p className="cert-name">{name}</p>
          <p className="cert-line">{t.certShown}</p>
          <p className="cert-skill">{skill}</p>
          <p className="cert-level">{t.levelOf(c.proficiency)} · {t.proof}: {t.proofNames[c.proofType] ?? c.proofType}</p>
          <footer className="cert-foot">
            <div className="cert-sign">
              <span className="cert-signature">{c.verifiedBy}</span>
              <span>{[c.verifierTitle, c.company].filter(Boolean).join(', ')}</span>
              <small>{t.verifiedBy}</small>
            </div>
            <div className="cert-seal" aria-hidden="true"><span>✓</span><small>{t.certSeal}</small></div>
            <div className="cert-sign">
              <span className="cert-date">{longDate(c.issuedAt)}</span>
              <span>&nbsp;</span>
              <small>{t.issued}</small>
            </div>
          </footer>
          <p className="cert-fine">{t.certFine}</p>
        </div>
      </article>
      <div className="actions"><Button design="Transparent" icon="print" onClick={print}>{t.print}</Button></div>
    </div>
  )
}

export function Certificates({ t, run, revision, busy, names, me }: HomeProps) {
  const [certificates, setCertificates] = useState<any[]>([])
  const [links, setLinks] = useState<any[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  useEffect(() => {
    list('/passport/MyCredentials').then(setCertificates).catch(() => setCertificates([]))
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
      <Title level="H2" size="H4">{t.passportTitle}</Title>
      <Text>{t.passportHint}</Text>
      {!certificates.length && <Text>{t.noVerified}</Text>}
      {certificates.map(c => <Certificate key={c.ID} c={c} t={t} name={me.name} skill={names[c.skill_ID] ?? c.skill_ID} />)}
      <OtherCertificates t={t} revision={revision} />
      {certificates.length > 0 && (
        <Card header={<CardHeader titleText={t.shareCerts} />}>
          <div className="card-body">
            {certificates.map(c => (
              <CheckBox key={c.ID} wrappingType="Normal" text={names[c.skill_ID] ?? c.skill_ID} checked={chosen.has(c.skill_ID)} onChange={() => toggle(c.skill_ID)} />
            ))}
            <Button design="Emphasized" disabled={busy || !chosen.size} onClick={() => run(async () => {
              await value('/passport/createLink', { skills: [...chosen] })
              setChosen(new Set())
            })}>{t.createLink}</Button>
          </div>
        </Card>
      )}
      {links.length > 0 && <Title level="H2" size="H5">{t.activeLinks}</Title>}
      {links.map(link => <ShareLink key={link.ID} link={link} t={t} run={run} busy={busy} names={names} />)}
    </>
  )
}

function OtherCertificates({ t, revision }: { t: Texts; revision: number }) {
  const [others, setOthers] = useState<any[]>([])
  useEffect(() => { list('/worker/MyOtherCertificates').then(setOthers).catch(() => setOthers([])) }, [revision])
  if (!others.length) return null
  return (
    <Card header={<CardHeader titleText={t.otherCerts} subtitleText={t.otherCertsNote} />}>
      <List separators="Inner">
        {others.map(c => <ListItemStandard key={c.ID} wrappingType="Normal" description={`${c.issuer} · ${dateOf(c.issuedOn)}`}>{c.title}</ListItemStandard>)}
      </List>
    </Card>
  )
}

function ShareLink({ link, t, run, busy, names }: { link: any; t: Texts; run: Run; busy: boolean; names: Record<string, string> }) {
  const [qr, setQr] = useState('')
  const url = `${location.origin}/check.html#${link.token}`
  useEffect(() => { QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setQr).catch(() => setQr('')) }, [url])
  const shared = parseJson<string[]>(link.skills, [])
  return (
    <Card>
      <div className="card-body">
        <Text>{shared.map(s => names[s] ?? s).join(', ')}</Text>
        {qr && <img src={qr} width={200} height={200} alt="QR code for this share link" />}
        <div className="actions">
          <Link href={url} target="_blank">{t.openLink}</Link>
          <Button design="Negative" disabled={busy} onClick={() => run(() => value('/passport/cancelLink', { token: link.token }))}>{t.cancelLink}</Button>
        </div>
      </div>
    </Card>
  )
}

// Only manager-verified skills reach the resume. What someone said in a recording is never printed here.
export function Resume({ t, revision, names, me, user }: HomeProps) {
  const [certificates, setCertificates] = useState<any[]>([])
  const [others, setOthers] = useState<any[]>([])
  const { page, print } = usePrint()

  useEffect(() => {
    list('/passport/MyCredentials?$orderby=proficiency desc').then(setCertificates).catch(() => setCertificates([]))
    list('/worker/MyOtherCertificates').then(setOthers).catch(() => setOthers([]))
  }, [revision])

  return (
    <>
    <ProfileCard person={me} company={user.company} labels={t.profile} />
    <article className="resume" ref={page}>
      <header className="resume-head">
        <p className="resume-name">{me.name}</p>
        <p>{[me.jobTitle, user.company, me.site].filter(Boolean).join(' · ')}</p>
      </header>
      <MessageStrip design="Information" hideCloseButton>{t.resumeRule}</MessageStrip>
      {!certificates.length && <Text>{t.resumeEmpty}</Text>}
      {certificates.length > 0 && (
        <section>
          <h3 className="resume-section">{t.verifiedSkills}</h3>
          <ul className="resume-skills">
            {certificates.map(c => (
              <li key={c.ID}>
                <div className="resume-skill-head">
                  <strong>{names[c.skill_ID] ?? c.skill_ID}</strong>
                  <span className="level-dots" aria-label={t.levelOf(c.proficiency)}>{[1, 2, 3].map(n => <i key={n} className={n <= c.proficiency ? 'on' : ''} />)}</span>
                </div>
                <span className="fine-print">{t.verifiedBy} {[c.verifiedBy, c.verifierTitle, c.company].filter(Boolean).join(', ')} · {t.proofNames[c.proofType] ?? c.proofType} · {dateOf(c.issuedAt)} · {t.certNo} {c.ID.slice(0, 8).toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {others.length > 0 && (
        <section>
          <h3 className="resume-section">{t.otherCerts}</h3>
          <ul className="plain">{others.map(c => <li key={c.ID}>{c.title}, {c.issuer}, {dateOf(c.issuedOn)}</li>)}</ul>
        </section>
      )}
      <div className="actions"><Button icon="print" onClick={print}>{t.print}</Button></div>
    </article>
    </>
  )
}
