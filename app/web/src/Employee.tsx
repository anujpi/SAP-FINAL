import { useEffect, useState } from 'react'
import { Button, Card, CardHeader, Link, MessageStrip, ObjectStatus, Text } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/nav-back.js'
import '@ui5/webcomponents-icons/dist/video.js'
import { parsed, value } from './api'
import { DataTable, Empty, ProfileCard, StageStatus } from './ui'

const PROOF: Record<string, string> = { ewm_records: 'EWM records', observed_on_shift: 'Observed on shift', training_record: 'Training record', assessment: 'Practice assessment', video: 'Video of the work' }
const dateOf = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '–')

// Loads the clip only when asked: it can be a few MB.
function ProofClip({ request }: { request: string }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  if (src) return <video className="proof-clip" src={src} controls aria-label="Proof clip" />
  return <Button design="Transparent" icon="video" onClick={() => value<string>(`/manager/proofClip(request=${request})`).then(setSrc).catch(() => setFailed(true))}>{failed ? "Couldn't load the clip" : 'Watch clip'}</Button>
}

/** What a manager sees for one person in their own company. Their outside job search is never part of this. */
export function EmployeeProfile({ worker, names, revision }: { worker: string; names: Record<string, string>; revision: number }) {
  const [profile, setProfile] = useState<any>(null)
  const [failed, setFailed] = useState('')

  useEffect(() => { scrollTo(0, 0) }, [worker])

  useEffect(() => {
    parsed(`/manager/employeeProfile(worker=${worker})`).then(setProfile).catch(e => setFailed(e.message))
  }, [worker, revision])

  const back = <Link href="#/manager/team">Back to My Employees</Link>
  if (failed) return <>{back}<MessageStrip design="Negative" hideCloseButton>{failed}</MessageStrip></>
  if (!profile) return <Text>Loading…</Text>

  const skillName = (id: string) => names[id] ?? id
  const verified = profile.skills.filter((s: any) => s.status === 'verified')
  const others = profile.skills.filter((s: any) => s.status !== 'verified')
  const open = others.filter((s: any) => s.request === 'pending').length

  return (
    <>
      {back}
      <ProfileCard person={profile.worker} company={profile.worker.company} action={<StageStatus stage={profile.worker.stage} />} />

      <div className="kpis">
        <div className="kpi"><strong>{verified.length}</strong><span>Verified skills</span></div>
        <div className="kpi"><strong>{others.length}</strong><span>Not yet verified</span></div>
        <div className="kpi"><strong>{profile.bestScore === null ? '–' : `${profile.bestScore}%`}</strong><span>Match to {profile.targetRole} (sample data)</span></div>
      </div>

      {open > 0 && (
        <MessageStrip design="Critical" hideCloseButton>
          {profile.worker.name} is waiting for you to answer {open} verification {open === 1 ? 'request' : 'requests'}. <Link href="#/manager/verify">Answer now</Link>
        </MessageStrip>
      )}

      <Card header={<CardHeader titleText="Verified skills" subtitleText="Proven, and added to the SuccessFactors stand-in" />}>
        {!verified.length && <div className="card-body"><Text>Nothing verified yet.</Text></div>}
        {verified.length > 0 && (
          <DataTable
            columns={['Skill', 'Level', 'Verified by', 'Proof', 'Date']}
            rows={verified.map((s: any) => [
              skillName(s.skill_ID), s.proficiency, s.verifiedBy ?? '–',
              <>{[PROOF[s.proofType], s.proofRef].filter(Boolean).join(' · ') || 'On file'}{s.clipRequest && <ProofClip request={s.clipRequest} />}</>, dateOf(s.verifiedOn)
            ])}
          />
        )}
      </Card>

      <Card header={<CardHeader titleText="Not yet verified" subtitleText="What they told us, and what EWM shows. This is not a judgement of their ability." />}>
        {!others.length && <div className="card-body"><Text>Nothing here.</Text></div>}
        {others.length > 0 && (
          <DataTable
            columns={['Skill', 'What EWM shows', 'Request']}
            rows={others.map((s: any) => [
              skillName(s.skill_ID),
              s.ewm ? `${s.ewm.tasks} confirmed tasks, latest ${s.ewm.lastDate}` : 'No records yet',
              s.request === 'pending'
                ? <ObjectStatus state="Critical">Waiting for you</ObjectStatus>
                : s.request === 'not_yet' ? `Not yet: ${s.requestNote}` : 'Not requested'
            ])}
          />
        )}
      </Card>

      <Card header={<CardHeader titleText="Other certificates on record" subtitleText="Sample data. Not verified by a manager, and they don't count towards a match." />}>
        {!profile.otherCertificates.length && <div className="card-body"><Text>None on record.</Text></div>}
        {profile.otherCertificates.length > 0 && <DataTable columns={['Certificate', 'Issued by', 'Date']} rows={profile.otherCertificates.map((c: any) => [c.title, c.issuer, dateOf(c.issuedOn)])} />}
      </Card>

      <Card header={<CardHeader titleText="What they do" subtitleText="In their own words, confirmed by them. Never used for appraisal or discipline." />}>
        {!profile.tasks.length && <div className="card-body"><Text>They haven't described their work yet.</Text></div>}
        {profile.tasks.length > 0 && <DataTable columns={['Task', 'Tool', 'How often']} rows={profile.tasks.map((t: any) => [t.task, t.tool || '–', t.frequency || '–'])} />}
      </Card>

      <Card header={<CardHeader titleText="Latest EWM records" subtitleText="From the daily upload (sample data)" />}>
        {!profile.ewmRecords.length && <Empty title="No EWM records yet" />}
        {profile.ewmRecords.length > 0 && <DataTable columns={['Date', 'Task type', 'Confirmed tasks']} rows={profile.ewmRecords.map((r: any) => [r.workDate, r.taskType, r.confirmedTasks])} />}
      </Card>

      <p className="fine-print">Applications to other companies are private to the employee and never show here.</p>
      <div><Button icon="nav-back" design="Transparent" onClick={() => { location.hash = '#/manager/team' }}>Back to My Employees</Button></div>
    </>
  )
}
