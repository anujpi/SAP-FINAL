import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  Button, Card, CardHeader, CheckBox, Input, Link, List, ListItemStandard, MessageStrip, ObjectStatus,
  Panel, ProgressIndicator, Text, Title
} from '@ui5/webcomponents-react'
import { list, parseJson, parsed, sendEvent, value } from './api'
import type { Texts } from './i18n'
import type { Run } from './Worker'
import type { User } from './main'

type HomeProps = { t: Texts; run: Run; revision: number; busy: boolean; names: Record<string, string>; stage: string; me: any; user: User }

// Unverified is never shown as a negative state.
const CHIP_STATE: Record<string, 'Positive' | 'Information' | 'None'> = { verified: 'Positive', self_reported: 'Information', needs_evidence: 'None' }
const chipText = (status: string, t: Texts) => t[status as 'verified' | 'self_reported' | 'needs_evidence'] ?? t.needs_evidence
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

  return (
    <Card header={<CardHeader titleText={t.yourSkills} subtitleText={t.verifiedMeans} />}>
      {!skills.length && <div className="card-body"><Text>{t.noSkills}</Text></div>}
      <ul className="skill-rows">
        {skills.map(s => {
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

  useEffect(() => {
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
      <Text className="fine-print">{t.privateNote}</Text>
      {stage !== 'SHORTLISTED' && (
        <CheckBox wrappingType="Normal" text={t.outsideToggle} checked={optIn} disabled={busy} onChange={e => run(() => sendEvent('outside_opt_in', { optIn: e.target.checked }))} />
      )}
      {optIn && external.map(m => {
        const application = applications.find(a => a.vacancy_ID === m.vacancy_ID)
        return (
          <MatchCard key={m.ID} m={m} t={t} names={names} title={`${roles[m.vacancy?.role_ID]} · ${m.vacancy?.employer}`}>
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
      {optIn && market.length > 0 && (
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

export function Learn({ t, run, revision, busy }: HomeProps) {
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
      <Title level="H2" size="H4">{t.pathway}</Title>
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

function Certificate({ c, t, name, skill }: { c: any; t: Texts; name: string; skill: string }) {
  const { page, print } = usePrint()
  return (
    <article className="certificate" ref={page}>
      <span className="certificate-mark">{t.certTitle}</span>
      <Title level="H3" size="H4">{skill}</Title>
      <Text>{t.certBody(name, skill, c.proficiency)}</Text>
      <dl>
        <dt>{t.verifiedBy}</dt>
        <dd>{[c.verifiedBy, c.verifierTitle, c.company].filter(Boolean).join(', ')}</dd>
        <dt>{t.proof}</dt>
        <dd>{t.proofNames[c.proofType] ?? c.proofType}</dd>
        <dt>{t.issued}</dt>
        <dd>{dateOf(c.issuedAt)}</dd>
      </dl>
      <div className="actions"><Button design="Transparent" onClick={print}>{t.print}</Button></div>
    </article>
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

export function Resume({ t, revision, names, me, user }: HomeProps) {
  const [tasks, setTasks] = useState<any[]>([])
  const [certificates, setCertificates] = useState<any[]>([])
  const { page, print } = usePrint()

  useEffect(() => {
    list('/worker/MyTasks').then(setTasks).catch(() => setTasks([]))
    list('/passport/MyCredentials').then(setCertificates).catch(() => setCertificates([]))
  }, [revision])

  return (
    <article className="resume" ref={page}>
      <Title level="H2" size="H3">{me.name}</Title>
      <Text>{[user.company, me.site].filter(Boolean).join(' · ')}</Text>
      {!tasks.length && !certificates.length && <Text>{t.resumeEmpty}</Text>}
      {certificates.length > 0 && (
        <>
          <Title level="H3" size="H5">{t.verifiedSkills}</Title>
          <ul className="plain">
            {certificates.map(c => (
              <li key={c.ID}>
                <strong>{names[c.skill_ID] ?? c.skill_ID}</strong> ({t.level} {c.proficiency}). {t.verifiedBy}: {[c.verifiedBy, c.verifierTitle, c.company].filter(Boolean).join(', ')}, {dateOf(c.issuedAt)}
              </li>
            ))}
          </ul>
        </>
      )}
      {tasks.length > 0 && (
        <>
          <Title level="H3" size="H5">{t.whatIDo}</Title>
          <ul className="plain">{tasks.map(x => <li key={x.ID}>{x.task}</li>)}</ul>
        </>
      )}
      <div className="actions"><Button onClick={print}>{t.print}</Button></div>
    </article>
  )
}
