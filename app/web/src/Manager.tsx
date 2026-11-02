import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, CardHeader, Input, Label, Link, List, ListItemStandard, MessageStrip, ObjectStatus, Option, Panel, RadioButton, Select,
  SideNavigation, SideNavigationItem, Text, TextArea, Title
} from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/group.js'
import '@ui5/webcomponents-icons/dist/validate.js'
import '@ui5/webcomponents-icons/dist/workflow-tasks.js'
import '@ui5/webcomponents-icons/dist/search.js'
import '@ui5/webcomponents-icons/dist/upload.js'
import '@ui5/webcomponents-icons/dist/customer-briefing.js'
import '@ui5/webcomponents-icons/dist/history.js'
import '@ui5/webcomponents-icons/dist/shield.js'
import { list, parseJson, parsed, value } from './api'
import { DataTable, Empty, STAGE, StageStatus } from './ui'
import { EmployeeProfile } from './Employee'
import type { User } from './main'

export const SECTIONS = [
  { id: 'team', label: 'My employees', icon: 'group', roles: ['Manager', 'Supervisor', 'HRAdmin'] },
  { id: 'verify', label: 'Verification requests', icon: 'validate', roles: ['Manager', 'Supervisor'] },
  { id: 'review', label: 'Role reviews', icon: 'workflow-tasks', roles: ['Manager', 'HRAdmin'] },
  { id: 'talent', label: 'Find talent', icon: 'search', roles: ['Manager', 'HRAdmin'] },
  { id: 'ewm', label: 'EWM daily upload', icon: 'upload', roles: ['Manager', 'Supervisor'] },
  { id: 'applicants', label: 'Outside applicants', icon: 'customer-briefing', roles: ['Manager', 'HRAdmin'] },
  { id: 'audit', label: 'Audit log', icon: 'history', roles: ['Manager', 'HRAdmin'] },
  { id: 'fairness', label: 'Fairness audit', icon: 'shield', roles: ['HRAdmin'] }
]

const OUTCOMES = [
  { id: 'shortlist', label: 'Shortlist for interview' },
  { id: 'request_evidence', label: 'Request more evidence' },
  { id: 'not_yet', label: 'Not yet' }
]

const PROOFS = [
  { id: 'ewm_records', label: 'EWM records' },
  { id: 'observed_on_shift', label: 'Observed on shift' },
  { id: 'training_record', label: 'Training record' }
]

const NOTE_MOCK_SF = 'Mock SuccessFactors: a table standing in for it, because no customer system is connected. Connecting a real tenant replaces only this one step.'

export function ManagerApp({ user, section, detail }: { user: User; section?: string; detail?: string }) {
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

  const allowed = SECTIONS.filter(s => s.roles.some(role => user.roles.includes(role)))
  const current = allowed.find(s => s.id === section)?.id ?? allowed[0]?.id
  const props = { names, revision, run, busy }

  return (
    <div className="with-nav">
      <SideNavigation
        collapsed={matchMedia('(max-width: 700px)').matches}
        onSelectionChange={e => { location.hash = `#/manager/${e.detail.item.dataset.id}` }}
      >
        {allowed.map(s => <SideNavigationItem key={s.id} data-id={s.id} text={s.label} icon={s.icon} selected={s.id === current} />)}
      </SideNavigation>
      <main className="page">
        {error && <MessageStrip design="Negative" onClose={() => setError('')}>{error}</MessageStrip>}
        {message && <MessageStrip design="Positive" onClose={() => setMessage('')}>{message}</MessageStrip>}
        {current === 'team' && !detail && <Team {...props} company={user.company} />}
        {current === 'team' && detail && <EmployeeProfile worker={detail} names={names} revision={revision} />}
        {current === 'verify' && <Verify {...props} />}
        {current === 'review' && <Review {...props} canDecide={user.roles.includes('Manager')} />}
        {current === 'talent' && <Talent {...props} />}
        {current === 'ewm' && <EwmUpload {...props} />}
        {current === 'applicants' && <Applicants {...props} canAnswer={user.roles.includes('Manager')} />}
        {current === 'audit' && <Audit revision={revision} />}
        {current === 'fairness' && <Fairness revision={revision} />}
        <p className="fine-print">All people, companies and scores are fictional. No live SAP system is connected. The manager decides, not the AI.</p>
      </main>
    </div>
  )
}

type Props = {
  names: Record<string, string>
  revision: number
  run: (action: () => Promise<unknown>, done: string) => Promise<void>
  busy: boolean
}

function Team({ names, revision, company }: Props & { company: string }) {
  const [team, setTeam] = useState<any[]>([])
  useEffect(() => { parsed<any[]>('/manager/teamSkills()').then(setTeam).catch(() => setTeam([])) }, [revision])
  const skillText = (w: any, status: (s: any) => boolean) => w.skills.filter(status).map((s: any) => names[s.skill_ID] ?? s.skill_ID).join(', ') || '–'
  return (
    <>
      <Title level="H1" size="H3">My employees</Title>
      <Text>{company} · {team.length} people. Click a name to see their profile.</Text>
      <Card>
        <DataTable
          columns={['Name', 'Job', 'Verified skills', 'Not yet verified', 'Open requests', 'Status']}
          rows={team.map(w => [
            <Link href={`#/manager/team/${w.ID}`}>{w.name}</Link>,
            w.jobTitle,
            skillText(w, s => s.status === 'verified'),
            skillText(w, s => s.status !== 'verified'),
            w.pending.length ? <ObjectStatus state="Critical">{w.pending.length}</ObjectStatus> : '–',
            <StageStatus stage={w.stage} />
          ])}
        />
      </Card>
    </>
  )
}

function Verify({ names, revision, run, busy }: Props) {
  const [requests, setRequests] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [proofType, setProofType] = useState('ewm_records')
  const [proofRef, setProofRef] = useState('')
  const [proficiency, setProficiency] = useState('2')
  const [note, setNote] = useState('')

  useEffect(() => {
    parsed<any[]>('/manager/verificationRequests()').then(rows => {
      setRequests(rows)
      setSelected(current => rows.some(r => r.ID === current) ? current : rows[0]?.ID ?? '')
    }).catch(() => setRequests([]))
  }, [revision])

  const open = requests.find(r => r.ID === selected)
  useEffect(() => {
    setProofType(open?.ewm ? 'ewm_records' : 'observed_on_shift')
    setProofRef(open?.ewm ? `EWM-BLR1-${open.ewm.lastDate}` : '')
    setProficiency('2')
    setNote('')
  }, [open?.ID, open?.ewm])

  if (!requests.length) return <Empty title="No verification requests" subtitle="When an employee asks you to confirm a skill, it appears here." />

  const decide = (approved: boolean) => {
    const skill = names[open.skill_ID] ?? open.skill_ID
    return run(
      () => value('/manager/decideVerification', { request: open.ID, approved, proofType, proofRef, proficiency: Number(proficiency), note }),
      approved ? `Verified ${skill} for ${open.workerName}: certificate issued and added to SuccessFactors (mock).` : `Your answer has gone to ${open.workerName}`
    )
  }

  return (
    <>
      <Title level="H1" size="H3">Verification requests</Title>
      <div className="master-detail">
        <Card header={<CardHeader titleText="Waiting for you" subtitleText={`${requests.length} open`} />}>
          <List selectionMode="Single" onSelectionChange={e => setSelected(e.detail.selectedItems[0]?.dataset.id ?? '')}>
            {requests.map(r => (
              <ListItemStandard key={r.ID} data-id={r.ID} selected={r.ID === selected} wrappingType="Normal" description={names[r.skill_ID] ?? r.skill_ID}>{r.workerName}</ListItemStandard>
            ))}
          </List>
        </Card>
        {open && (
          <div className="detail">
            <Card header={<CardHeader titleText={names[open.skill_ID] ?? open.skill_ID} subtitleText={`${open.workerName} · ${open.site}`} />}>
              <div className="card-body">
                <Title level="H3" size="H6">What EWM shows</Title>
                {open.ewm
                  ? <MessageStrip design="Positive" hideCloseButton>{open.ewm.tasks} confirmed tasks over {open.ewm.days} days. Latest: {open.ewm.lastDate}. From the daily EWM upload (sample data).</MessageStrip>
                  : <MessageStrip design="Information" hideCloseButton>No EWM records for this skill. You can still confirm it if you have other proof.</MessageStrip>}

                <Title level="H3" size="H6">Your proof</Title>
                <Text className="fine-print">Proof is mocked for this demo: only its type and reference are stored.</Text>
                <Label for="proof-type">Type of proof</Label>
                <Select id="proof-type" value={proofType} onChange={e => setProofType(e.target.value)}>
                  {PROOFS.map(p => <Option key={p.id} value={p.id}>{p.label}</Option>)}
                </Select>
                <Label for="proof-ref" required>Proof reference</Label>
                <Input id="proof-ref" maxlength={100} value={proofRef} onInput={e => setProofRef(e.target.value)} />
                <Label for="proof-level">Level</Label>
                <Select id="proof-level" value={proficiency} onChange={e => setProficiency(e.target.value)}>
                  {['1', '2', '3'].map(l => <Option key={l} value={l}>Level {l}</Option>)}
                </Select>
                <Button design="Emphasized" disabled={busy || !proofRef.trim()} onClick={() => decide(true)}>Verify and issue certificate</Button>

                <Title level="H3" size="H6">Not ready yet?</Title>
                <Label for="not-yet" required>Reason the employee will see</Label>
                <TextArea id="not-yet" rows={2} maxlength={500} value={note} onInput={e => setNote(e.target.value)} />
                <Button disabled={busy || !note.trim()} onClick={() => decide(false)}>Not yet</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}

function Review({ names, revision, run, busy, canDecide }: Props & { canDecide: boolean }) {
  const [queue, setQueue] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [packet, setPacket] = useState<any>(null)
  const [sap, setSap] = useState<any>(null)
  const [outcome, setOutcome] = useState('not_yet')
  const [reasons, setReasons] = useState('')

  useEffect(() => {
    list('/manager/ReviewQueue').then(rows => {
      setQueue(rows)
      setSelected(current => rows.some(r => r.ID === current) ? current : rows[0]?.ID ?? '')
    }).catch(() => setQueue([]))
  }, [revision])

  useEffect(() => {
    if (!selected) { setPacket(null); setSap(null); return }
    parsed(`/manager/reviewPacket(worker=${selected})`).then(setPacket).catch(() => setPacket(null))
    parsed(`/manager/sapContext(worker=${selected})`).then(setSap).catch(() => setSap(null))
  }, [selected, revision])

  if (!queue.length) return <Empty title="No role reviews" subtitle="Employees ask for a review from their Jobs screen. New requests appear here." />

  const best = packet?.matches?.[0]
  const reasonNeeded = outcome !== 'shortlist'

  return (
    <>
      <Title level="H1" size="H3">Role reviews</Title>
      <div className="master-detail">
        <Card header={<CardHeader titleText="Waiting for you" subtitleText={`${queue.length} open`} />}>
          <List selectionMode="Single" onSelectionChange={e => setSelected(e.detail.selectedItems[0]?.dataset.id ?? '')}>
            {queue.map(w => <ListItemStandard key={w.ID} data-id={w.ID} selected={w.ID === selected} description={w.site}>{w.name}</ListItemStandard>)}
          </List>
        </Card>
        {packet && (
          <div className="detail">
            <Card header={<CardHeader titleText={packet.worker.name} subtitleText={sap?.requisitions?.[0] ? `${sap.requisitions[0].jobTitle} · ${sap.requisitions[0].jobReqId}` : packet.worker.site} />}>
              <div className="card-body">
                {best && <p className="score"><strong>{best.score}%</strong> skill match <small>(demo data)</small></p>}
                <Title level="H3" size="H6">Verified skills</Title>
                <ul className="plain">{packet.verified.map((c: any) => <li key={c.ID}>{names[c.skill_ID] ?? c.skill_ID} · level {c.proficiency}</li>)}</ul>
                <Title level="H3" size="H6">Self-reported or needs evidence</Title>
                <ul className="plain">{packet.needsEvidence.map((c: any) => <li key={c.ID}>{names[c.skill_ID] ?? c.skill_ID}</li>)}</ul>
                <Title level="H3" size="H6">Evidence</Title>
                <ul className="plain">{packet.evidence.map((e: any) => <li key={e.ID}>{names[e.skill_ID] ?? e.skill_ID}: {e.attestedBy}{e.proofRef ? ` (${e.proofRef})` : ''}</li>)}</ul>
                {best && (
                  <Panel headerText="How the score was worked out" collapsed>
                    <ul className="plain">{parseJson<any[]>(best.ruleTrace, []).map(r => <li key={r.skill}>{names[r.skill] ?? r.skill}: weight {r.weight} × credit {r.credit}</li>)}</ul>
                  </Panel>
                )}
              </div>
            </Card>

            {sap && (
              <Card header={<CardHeader titleText="From your SAP systems" subtitleText="Sample data in SAP's format. No live system is connected." />}>
                <div className="card-body">
                  <Text><strong>SuccessFactors employee record:</strong> {sap.empJob.jobTitle}, {sap.empJob.location}, {sap.empJob.employmentType}</Text>
                  <Title level="H3" size="H6">Latest EWM records</Title>
                  <DataTable
                    columns={['Date', 'Warehouse', 'Task type', 'Confirmed tasks']}
                    rows={sap.warehouseTasks.map((w: any) => [w.date, w.EWMWarehouse, w.taskType, w.confirmedTasks])}
                  />
                  <Text className="fine-print">These records help you judge a skill. They never change the score.</Text>
                </div>
              </Card>
            )}

            {canDecide && (
              <Card header={<CardHeader titleText="Your decision" subtitleText="Logged with your reason. You decide, not the AI." />}>
                <div className="card-body">
                  <div className="radios" role="radiogroup" aria-label="Decision">
                    {OUTCOMES.map(o => <RadioButton key={o.id} name="outcome" text={o.label} checked={outcome === o.id} onChange={() => setOutcome(o.id)} />)}
                  </div>
                  <Label for="reason" required={reasonNeeded}>Reason</Label>
                  <TextArea id="reason" rows={3} maxlength={1000} value={reasons} onInput={e => setReasons(e.target.value)} />
                  <Button
                    design="Emphasized"
                    disabled={busy || (reasonNeeded && !reasons.trim())}
                    onClick={() => run(() => value('/manager/decide', { worker: selected, outcome, reasons }), 'Decision recorded.').then(() => setReasons(''))}
                  >
                    Record decision
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function Talent({ names, revision }: Props) {
  const [skill, setSkill] = useState('')
  const [people, setPeople] = useState<any[]>([])
  const ids = Object.keys(names)
  const current = skill || ids[0] || ''

  useEffect(() => {
    if (!current) return
    parsed<any[]>(`/manager/findTalent(skill='${encodeURIComponent(current)}')`).then(setPeople).catch(() => setPeople([]))
  }, [current, revision])

  return (
    <>
      <Title level="H1" size="H3">Find talent</Title>
      <Text>Search your employees by verified skill, so the next role goes to someone who has already proven they can do it.</Text>
      <MessageStrip design="Information" hideCloseButton>{NOTE_MOCK_SF}</MessageStrip>
      <Card>
        <div className="card-body">
          <Label for="talent-skill">Verified skill</Label>
          <Select id="talent-skill" value={current} onChange={e => setSkill(e.target.value)}>
            {ids.map(id => <Option key={id} value={id}>{names[id]}</Option>)}
          </Select>
        </div>
        {!people.length && <Empty title="No one verified yet" subtitle="Skills appear here when a manager verifies them." />}
        {people.length > 0 && (
          <DataTable
            columns={['Name', 'Level', 'Verified by', 'Added to SuccessFactors']}
            rows={people.map(p => [p.userName, p.proficiency, p.verifiedBy, new Date(p.syncedAt).toLocaleDateString()])}
          />
        )}
      </Card>
    </>
  )
}

function EwmUpload({ revision, run, busy }: Props) {
  const [records, setRecords] = useState<any[]>([])
  const [csv, setCsv] = useState('')

  useEffect(() => { parsed<any[]>('/manager/ewmRecent()').then(setRecords).catch(() => setRecords([])) }, [revision])

  const fillSample = async () => {
    const team = await list('/manager/Team?$orderby=name')
    const worker = (team.find(w => w.name.startsWith('Ravi')) ?? team[0])?.ID
    const today = new Date().toISOString().slice(0, 10)
    setCsv(`workerId,workDate,taskType,confirmedTasks\n${worker},${today},PHYSICAL_INVENTORY,6\n${worker},${today},PICK,18`)
  }

  const readFile = async (file?: File) => { if (file) setCsv(await file.text()) }

  return (
    <>
      <Title level="H1" size="H3">EWM daily upload</Title>
      <Text>Each day, someone at the warehouse loads the day's confirmed tasks from EWM. These records are how a skill gets checked against real work. Later, SAP Integration Suite can do this on a schedule.</Text>
      <MessageStrip design="Information" hideCloseButton>Sample data. No live EWM system is connected.</MessageStrip>
      <Card header={<CardHeader titleText="Load today's extract" subtitleText="CSV: workerId, workDate, taskType, confirmedTasks" />}>
        <div className="card-body">
          <input type="file" accept=".csv,text/csv" aria-label="Choose an EWM extract file" onChange={e => readFile(e.target.files?.[0])} />
          <TextArea accessibleName="EWM extract" rows={5} value={csv} onInput={e => setCsv(e.target.value)} />
          <div className="actions">
            <Button onClick={fillSample}>Use today's sample</Button>
            <Button design="Emphasized" disabled={busy || !csv.trim()} onClick={() => run(() => value('/manager/importEwmExtract', { csv }), 'Extract loaded into HANA.').then(() => setCsv(''))}>Load into HANA</Button>
          </div>
        </div>
      </Card>
      <Card header={<CardHeader titleText="Latest records" />}>
        <DataTable
          columns={['Date', 'Employee', 'Task type', 'Confirmed tasks', 'Source']}
          rows={records.map(r => [r.workDate, r.workerName, r.taskType, r.confirmedTasks, r.importedBy])}
        />
      </Card>
    </>
  )
}

const APPLICATION_STATUS: Record<string, string> = { applied: 'New', interview: 'Invited to interview', closed: 'Closed' }

function Applicants({ revision, run, busy, canAnswer }: Props & { canAnswer: boolean }) {
  const [applicants, setApplicants] = useState<any[]>([])
  const [messages, setMessages] = useState<Record<string, string>>({})

  useEffect(() => { parsed<any[]>('/manager/applicants()').then(setApplicants).catch(() => setApplicants([])) }, [revision])

  const answer = (id: string, status: string, done: string) => run(() => value('/manager/answerApplication', { application: id, status, message: messages[id] ?? '' }), done)

  if (!applicants.length) return <Empty title="No outside applicants" subtitle="People at other companies who apply with their certificates appear here." />

  return (
    <>
      <Title level="H1" size="H3">Outside applicants</Title>
      <Text>People from other companies applying to your jobs. Each certificate is checked before you see it.</Text>
      {applicants.map(a => (
        <Card key={a.ID} header={<CardHeader titleText={a.applicant} subtitleText={`${a.role} · ${a.site}`} />}>
          <div className="card-body">
            <ObjectStatus state={a.status === 'interview' ? 'Positive' : 'Information'}>{APPLICATION_STATUS[a.status] ?? a.status}</ObjectStatus>
            {a.certificates.status === 'genuine'
              ? <MessageStrip design="Positive" hideCloseButton>Certificates are genuine and not altered.</MessageStrip>
              : <MessageStrip design="Critical" hideCloseButton>The applicant has cancelled these certificates, or they could not be verified.</MessageStrip>}
            {a.certificates.status === 'genuine' && (
              <DataTable
                columns={['Skill', 'Level', 'Verified by', 'Company', 'Issued']}
                rows={a.certificates.skills.map((s: any) => [s.skill, s.proficiency, [s.verifiedBy, s.verifierTitle].filter(Boolean).join(', '), s.company, new Date(s.issuedAt).toLocaleDateString()])}
              />
            )}
            {a.message && <Text>Your message: {a.message}</Text>}
            {canAnswer && a.status === 'applied' && (
              <>
                <Label for={`msg-${a.ID}`}>Message to the applicant</Label>
                <TextArea id={`msg-${a.ID}`} rows={2} maxlength={500} value={messages[a.ID] ?? ''} onInput={e => { const next = e.target.value; setMessages(m => ({ ...m, [a.ID]: next })) }} />
                <div className="actions">
                  <Button design="Emphasized" disabled={busy} onClick={() => answer(a.ID, 'interview', `${a.applicant} invited to interview.`)}>Invite to interview</Button>
                  <Button disabled={busy} onClick={() => answer(a.ID, 'closed', 'Application closed.')}>Close</Button>
                </div>
              </>
            )}
          </div>
        </Card>
      ))}
    </>
  )
}

function Audit({ revision }: { revision: number }) {
  const [events, setEvents] = useState<any[]>([])
  useEffect(() => {
    list('/manager/AuditEvents?$orderby=occurredAt desc&$top=40').then(setEvents).catch(() => setEvents([]))
  }, [revision])
  return (
    <>
      <Title level="H1" size="H3">Audit log</Title>
      <Text>Every agent hand-off is recorded. The log holds roles and contract names, and no personal content. An employee's outside job search never appears here.</Text>
      {!events.length && <Empty title="No hand-offs yet" />}
      {events.length > 0 && (
        <Card>
          <DataTable
            columns={['Time', 'Event', 'Contract', 'Stage', 'Actor', 'Backup used']}
            rows={events.map(e => [new Date(e.occurredAt).toLocaleTimeString(), e.type, e.contract, STAGE[e.stage]?.label ?? e.stage, e.actor, e.degraded ? 'Yes' : 'No'])}
          />
        </Card>
      )}
    </>
  )
}

function Fairness({ revision }: { revision: number }) {
  const [report, setReport] = useState<any[]>([])
  useEffect(() => { parsed<any[]>('/manager/fairnessReport()').then(setReport).catch(() => setReport([])) }, [revision])
  return (
    <>
      <Title level="H1" size="H3">Fairness audit</Title>
      <MessageStrip design="Information" hideCloseButton>Fictional sample data. This shows how the audit works and is not a real result. HR reviews every flag.</MessageStrip>
      {report.map(r => (
        <Card key={r.dimension} header={<CardHeader titleText={r.dimension === 'lang' ? 'By language' : 'By employment type'} />}>
          <div className="card-body">
            <MessageStrip design={r.flagged ? 'Critical' : 'Positive'} hideCloseButton>
              {r.flagged ? `Flagged for HR: a gap of ${r.gap} points in average score.` : `No flag: a gap of ${r.gap} points.`}
            </MessageStrip>
            <DataTable
              columns={['Group', 'People', 'Average score', 'Shortlisted']}
              rows={r.groups.map((g: any) => [g.group, g.n, g.avgScore, `${g.shortlistRate}%`])}
            />
          </div>
        </Card>
      ))}
    </>
  )
}
