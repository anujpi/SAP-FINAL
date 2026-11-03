import { useEffect, useState } from 'react'
import { Button, Card, CardHeader, Input, Label, Link, MessageStrip, ObjectStatus, Option, Select, Switch, Text, Title } from '@ui5/webcomponents-react'
import { list, parsed, value } from './api'
import { DataTable, Empty } from './ui'
import type { User } from './main'

type Props = {
  names: Record<string, string>
  revision: number
  run: (action: () => Promise<unknown>, done: string) => Promise<void>
  busy: boolean
  user: User
}

const EVENT: Record<string, string> = {
  consent_granted: 'An employee started their profile',
  input_submitted: 'An employee described their work',
  recording_cancelled: 'An employee cancelled a recording',
  readback_confirmed:'Skills recorded and checked against EWM',
  verification_requested: 'A skill was sent to you for verification',
  verification_decided: 'A skill was verified or answered',
  assessment_submitted: 'A practice task was taken',
  review_requested: 'Someone asked for a role review',
  manager_decided: 'A role review was decided',
  ewm_imported: 'The daily EWM extract was loaded',
  person_registered: 'HR registered someone',
  person_removed: 'HR removed someone',
  marketplace_changed: 'The job marketplace setting changed',
  role_posted: 'A role was posted'
}

// A request left for a week is flagged, so nobody's progress quietly stalls with one manager.
const waited = (at: string) => Math.floor((Date.now() - new Date(at).getTime()) / 864e5)
const waitedText = (at: string) => { const d = waited(at); return d < 1 ? 'asked today' : `waiting ${d} day${d === 1 ? '' : 's'}` }

/** The manager's first screen: what needs attention, and how the team's skills look. */
export function Overview({ names, revision, user }: Props) {
  const [team, setTeam] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const canAudit = user.roles.includes('Manager') || user.roles.includes('HRAdmin')

  useEffect(() => {
    parsed<any[]>('/manager/teamSkills()').then(setTeam).catch(() => setTeam([]))
    if (user.roles.includes('Manager') || user.roles.includes('Supervisor')) parsed<any[]>('/manager/verificationRequests()').then(setRequests).catch(() => setRequests([]))
    if (canAudit) list('/manager/AuditEvents?$orderby=occurredAt desc&$top=6').then(setEvents).catch(() => setEvents([]))
  }, [revision])

  const skills = team.flatMap(w => w.skills)
  const verified = skills.filter(s => s.status === 'verified')
  const seen = skills.filter(s => s.status === 'work_records')
  const perSkill: Record<string, number> = {}
  for (const s of verified) perSkill[s.skill_ID] = (perSkill[s.skill_ID] ?? 0) + 1
  const coverage = Object.entries(perSkill).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const most = coverage[0]?.[1] ?? 1

  return (
    <>
      <div className="page-head">
        <Title level="H1" size="H3">Good to see you, {user.name.split(' ')[0]}</Title>
        <Text>{user.company}. Here's what needs you today.</Text>
      </div>

      <div className="kpis four">
        <a className="kpi" href="#/manager/team"><strong>{team.length}</strong><span>Employees</span></a>
        <a className="kpi attention" href="#/manager/verify"><strong>{requests.length}</strong><span>Waiting for you</span></a>
        <a className="kpi" href="#/manager/team"><strong>{verified.length}</strong><span>Verified skills</span></a>
        <a className="kpi" href="#/manager/team"><strong>{seen.length}</strong><span>Seen in EWM, not yet verified</span></a>
      </div>

      <div className="overview-grid">
        <Card header={<CardHeader titleText="Waiting for you" subtitleText="Skills your people asked you to verify" />}>
          {!requests.length && <div className="card-body"><Text>Nothing waiting. You're up to date.</Text></div>}
          <ul className="waiting">
            {requests.slice(0, 5).map(r => (
              <li key={r.ID}>
                <div>
                  <strong>{r.workerName}</strong>
                  <span>{names[r.skill_ID] ?? r.skill_ID} · <span className={waited(r.requestedAt) >= 7 ? 'overdue' : ''}>{waitedText(r.requestedAt)}</span></span>
                </div>
                {r.ewm ? <ObjectStatus state="Positive">{r.ewm.tasks} tasks in EWM</ObjectStatus> : <ObjectStatus state="None">No EWM records</ObjectStatus>}
              </li>
            ))}
          </ul>
          {requests.length > 0 && <div className="card-body"><Link href="#/manager/verify">Answer requests</Link></div>}
        </Card>

        <Card header={<CardHeader titleText="Skills across your team" subtitleText="How many people are verified in each" />}>
          {!coverage.length && <div className="card-body"><Text>No verified skills yet.</Text></div>}
          <ul className="bars">
            {coverage.map(([id, n]) => (
              <li key={id}>
                <span className="bar-label">{names[id] ?? id}</span>
                <span className="bar"><span style={{ width: `${(n / most) * 100}%` }} /></span>
                <span className="bar-value">{n}</span>
              </li>
            ))}
          </ul>
        </Card>

        {canAudit && (
          <Card header={<CardHeader titleText="Recent activity" subtitleText="From the audit log" />}>
            {!events.length && <div className="card-body"><Text>No activity yet.</Text></div>}
            <ul className="activity">
              {events.map(e => (
                <li key={e.ID}>
                  <span>{EVENT[e.type] ?? e.type.replace(/_/g, ' ')}</span>
                  <time>{new Date(e.occurredAt).toLocaleString()}</time>
                </li>
              ))}
            </ul>
            <div className="card-body"><Link href="#/manager/audit">Open the audit log</Link></div>
          </Card>
        )}
      </div>
    </>
  )
}

/** HR: who can sign in, and whether the company joins the job marketplace. */
export function People({ revision, run, busy }: Props) {
  const [data, setData] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', kind: 'Worker', jobTitle: '', site: '', ewmUser: '' })
  useEffect(() => { parsed('/manager/people()').then(setData).catch(() => setData(null)) }, [revision])
  if (!data) return <Text>Loading…</Text>
  const set = (k: keyof typeof form) => (e: any) => { const v = e.target.value; setForm(f => ({ ...f, [k]: v })) }

  return (
    <>
      <div className="page-head">
        <Title level="H1" size="H3">People and settings</Title>
        <Text>Only people registered here can sign in. Everyone else who signs in to SAP sees a "not registered" page.</Text>
      </div>

      <Card header={<CardHeader titleText="Job marketplace" subtitleText={data.company.name} />}>
        <div className="card-body">
          <div className="switch-row">
            <Switch
              checked={data.company.marketplace}
              disabled={busy}
              accessibleName="Join the job marketplace"
              onChange={e => { const on = e.target.checked; run(() => value('/manager/setMarketplace', { on }), on ? 'Joined the job marketplace.' : 'Left the job marketplace.') }}
            />
            <Text>{data.company.marketplace ? 'Joined' : 'Not joined'}</Text>
          </div>
          <Text className="fine-print">
            When joined, your employees can see jobs at other companies, and other companies can find them, anonymously and only if they choose. Their certificates are theirs either way.
          </Text>
        </div>
      </Card>

      <Card header={<CardHeader titleText="Register someone" subtitleText="They sign in with this email" />}>
        <div className="card-body form-grid">
          <div><Label for="p-name" required>Name</Label><Input id="p-name" maxlength={100} value={form.name} onInput={set('name')} /></div>
          <div><Label for="p-email" required>Email</Label><Input id="p-email" type="Email" maxlength={120} value={form.email} onInput={set('email')} /></div>
          <div>
            <Label for="p-kind">Role</Label>
            <Select id="p-kind" value={form.kind} onChange={set('kind')}>
              <Option value="Worker">Worker</Option>
              <Option value="Supervisor">Supervisor</Option>
              <Option value="Manager">Manager</Option>
            </Select>
          </div>
          <div><Label for="p-job">Job title</Label><Input id="p-job" maxlength={100} value={form.jobTitle} onInput={set('jobTitle')} /></div>
          <div><Label for="p-site">Site</Label><Input id="p-site" maxlength={50} value={form.site} onInput={set('site')} /></div>
          <div><Label for="p-ewm">EWM user code</Label><Input id="p-ewm" maxlength={20} placeholder="For example, BLR1-OP042" value={form.ewmUser} onInput={set('ewmUser')} /></div>
          <div className="actions">
            <Button
              design="Emphasized"
              disabled={busy || !form.name.trim() || !form.email.trim()}
              onClick={() => run(() => value('/manager/registerPerson', form), `Registered ${form.name}. They can sign in now.`).then(() => setForm({ name: '', email: '', kind: 'Worker', jobTitle: '', site: '', ewmUser: '' }))}
            >
              Register
            </Button>
          </div>
        </div>
      </Card>

      <Card header={<CardHeader titleText="Managers and supervisors" subtitleText={`${data.staff.length} people`} />}>
        <DataTable columns={['Name', 'Email', 'Title', 'Roles']} rows={data.staff.map((s: any) => [s.name, s.email, s.title, s.roles])} />
      </Card>

      <Card header={<CardHeader titleText="Employees" subtitleText={`${data.workers.length} people`} />}>
        {!data.workers.length && <Empty title="Nobody registered yet" />}
        {data.workers.length > 0 && (
          <DataTable
            columns={['Name', 'Email', 'Job', 'EWM user', '']}
            rows={data.workers.map((w: any) => [
              w.name, w.email, w.jobTitle || '–', w.ewmUser || <ObjectStatus state="Critical">Missing: EWM can't be checked</ObjectStatus>,
              <Button design="Transparent" disabled={busy} onClick={() => confirm(`Remove ${w.name}'s access? They won't be able to sign in until you register them again.`) && run(() => value('/manager/removePerson', { email: w.email }), `Removed ${w.name}'s access.`)}>Remove access</Button>
            ])}
          />
        )}
      </Card>
      <MessageStrip design="Information" hideCloseButton>Removing someone stops them signing in. Their certificates stay theirs, and registering the same email again restores their profile.</MessageStrip>
    </>
  )
}
