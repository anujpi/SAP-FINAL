import { useEffect, useState } from 'react'
import { Button, Card, CardHeader, Input, Label, MessageStrip, ObjectStatus, Option, Select, Text, TextArea, Title } from '@ui5/webcomponents-react'
import { list, parsed, value } from './api'
import { DataTable, Empty } from './ui'

const STATUS: Record<string, { label: string; state: 'Critical' | 'Positive' | 'None' }> = {
  pending: { label: 'Waiting for their answer', state: 'Critical' },
  granted: { label: 'Said yes', state: 'Positive' },
  declined: { label: 'Said no', state: 'None' },
  withdrawn: { label: 'Took back permission', state: 'None' }
}
const Status = ({ status }: { status: string }) => <ObjectStatus state={STATUS[status]?.state ?? 'None'}>{STATUS[status]?.label ?? status}</ObjectStatus>

type Props = {
  names: Record<string, string>
  revision: number
  run: (action: () => Promise<unknown>, done: string) => Promise<void>
  busy: boolean
  canAct: boolean
}

/** A company hiring from outside: post a role, see anonymous candidates, ask to connect. */
export function Hiring({ names, revision, run, busy, canAct }: Props) {
  const [roles, setRoles] = useState<any[]>([])
  const [open, setOpen] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [people, setPeople] = useState<any[]>([])
  const [sent, setSent] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [site, setSite] = useState('')
  const [message, setMessage] = useState('We think you would be a good fit for this role. Can we talk?')

  useEffect(() => { list('/manager/Roles').then(rows => { setRoles(rows); setRole(r => r || rows[0]?.ID || '') }).catch(() => setRoles([])) }, [])

  useEffect(() => {
    parsed<any[]>('/manager/openRoles()').then(rows => {
      setOpen(rows)
      setSelected(current => rows.some(r => r.ID === current) ? current : rows[0]?.ID ?? '')
    }).catch(() => setOpen([]))
    parsed<any[]>('/manager/outreach()').then(setSent).catch(() => setSent([]))
  }, [revision])

  useEffect(() => {
    if (!selected) { setPeople([]); return }
    parsed<any[]>(`/manager/candidates(vacancy='${encodeURIComponent(selected)}')`).then(setPeople).catch(() => setPeople([]))
  }, [selected, revision])

  const roleTitle = (v: any) => `${v.title}, ${v.site}${v.isNew ? ' (new)' : ''}`

  return (
    <>
      <Title level="H1" size="H3">Hire from outside</Title>
      <Text>Post a role and see who at other companies matches it. Candidates stay anonymous until they say yes.</Text>
      <MessageStrip design="Information" hideCloseButton>
        You see only verified skills and a match score. No name, no employer, nothing until that person gives permission. Their current employer never knows.
      </MessageStrip>

      {canAct && (
        <Card header={<CardHeader titleText="Post a new role" subtitleText="It goes straight to people open to other companies" />}>
          <div className="card-body">
            <Label for="post-role">Role</Label>
            <Select id="post-role" value={role} onChange={e => setRole(e.target.value)}>
              {roles.map(r => <Option key={r.ID} value={r.ID}>{r.title}</Option>)}
            </Select>
            <Label for="post-site" required>Site</Label>
            <Input id="post-site" maxlength={50} placeholder="For example, Hosur" value={site} onInput={e => setSite(e.target.value)} />
            <Button
              design="Emphasized"
              disabled={busy || !role || !site.trim()}
              // Show the candidates for the role just posted, so the manager sees who matches straight away.
              onClick={() => run(async () => setSelected(await value<string>('/manager/postRole', { role, site })), 'Role posted. Candidates for it are shown below.').then(() => setSite(''))}
            >
              Post role
            </Button>
          </div>
        </Card>
      )}

      <Card header={<CardHeader titleText="Candidates" subtitleText="Open to other companies, with at least one verified skill" />}>
        {!open.length && <Empty title="No open roles yet" subtitle="Post a role to see who matches it." />}
        {open.length > 0 && (
          <div className="card-body">
            <Label for="pick-role">For this role</Label>
            <Select id="pick-role" value={selected} onChange={e => setSelected(e.target.value)}>
              {open.map(v => <Option key={v.ID} value={v.ID}>{roleTitle(v)}</Option>)}
            </Select>
            {canAct && (
              <>
                <Label for="ask-message">Message they'll see</Label>
                <TextArea id="ask-message" rows={2} maxlength={500} value={message} onInput={e => setMessage(e.target.value)} />
              </>
            )}
          </div>
        )}
        {open.length > 0 && !people.length && <Empty title="No candidates right now" subtitle="People appear here when they turn on other companies and have a verified skill." />}
        {people.length > 0 && (
          <DataTable
            columns={['Candidate', 'Match', 'Verified skills', '']}
            rows={people.map(p => [
              `Candidate ${p.ref}`,
              `${p.score}%`,
              p.skills.map((s: any) => `${names[s.skill_ID] ?? s.skill_ID} (level ${s.proficiency})`).join(', '),
              p.status
                ? <Status status={p.status} />
                : canAct && (
                  <Button
                    disabled={busy}
                    onClick={() => run(() => value('/manager/askToConnect', { vacancy: selected, candidate: p.ref, message }), `Request sent to candidate ${p.ref}.`)}
                  >
                    Ask to connect
                  </Button>
                )
            ])}
          />
        )}
      </Card>

      <Card header={<CardHeader titleText="Requests you've sent" subtitleText="A name appears only after someone says yes" />}>
        {!sent.length && <div className="card-body"><Text>None yet.</Text></div>}
        {sent.length > 0 && <DataTable columns={['Who', 'Role', 'Answer']} rows={sent.map(o => [o.who, o.role, <Status status={o.status} />])} />}
      </Card>
      {sent.some(o => o.status === 'granted') && (
        <div><Button design="Emphasized" onClick={() => { location.hash = '#/manager/applicants' }}>See their certificates</Button></div>
      )}
    </>
  )
}
