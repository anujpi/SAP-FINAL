import { useEffect, useState } from 'react'
import { Card, CardHeader, Label, Link, MessageStrip, ObjectStatus, Option, Select, Text, Title } from '@ui5/webcomponents-react'
import { AI_ROUTE, list, parsed } from './api'

type Status = 'Live' | 'Sample data' | 'Mock' | 'Planned'
type System = { id: string; name: string; status: Status; does: string; api?: string; note?: string; data?: (c: any) => unknown }

const STATE: Record<Status, 'Positive' | 'Critical' | 'Information' | 'None'> = { Live: 'Positive', 'Sample data': 'Critical', Mock: 'Information', Planned: 'None' }

const EXISTING: System[] = [
  {
    id: 'ewm', name: 'SAP S/4HANA EWM', status: 'Sample data',
    does: 'Holds confirmed warehouse tasks. A daily extract loads them into HANA, so what a worker says can be checked against what they actually did. The records support a manager\'s decision and never add to the score by themselves.',
    api: 'Daily extract now. Later: API_WAREHOUSE_ORDER_TASK_2, read only',
    data: c => c.warehouseTasks
  },
  {
    id: 'ec', name: 'SAP SuccessFactors Employee Central', status: 'Sample data',
    does: 'The employee record, so people don\'t retype who they are, where they work or their current job.',
    api: 'OData: EmpJob, read only',
    data: c => c.empJob
  },
  {
    id: 'tih', name: 'SAP SuccessFactors skills', status: 'Mock',
    does: 'Every skill a manager verifies goes into SuccessFactors, so HR can filter employees for better roles by proven skill. This is why a company that already runs SAP would buy it. Try it in Find Talent.',
    api: 'Talent Intelligence Hub: Growth Portfolio REST API',
    note: 'SAP limits this API to designated Skills Partners (KBA 3774098). Without that status, the route is a file-based import. In this demo a local table stands in.',
    data: c => c.writeBack.skills
  },
  {
    id: 'rec', name: 'SAP SuccessFactors Recruiting', status: 'Sample data',
    does: 'Open internal roles come in. A manager\'s shortlist goes back as an application. A "not yet" never leaves this system.',
    api: 'OData: JobRequisition (read), JobApplication (write)',
    data: c => ({ JobRequisition: c.requisitions, JobApplication: c.writeBack.jobApplication })
  },
  {
    id: 'learn', name: 'SAP Learning', status: 'Live',
    does: 'Learning pathways link to real SAP Learning courses for each skill gap.',
    api: 'Links to learning.sap.com'
  }
]

const CONNECT: System[] = [
  { id: 'is', name: 'SAP Integration Suite', status: 'Planned', does: 'Runs the daily EWM load on a schedule and moves skills to SuccessFactors, so the app\'s own logic doesn\'t change.' },
  { id: 'dest', name: 'Destination service and Cloud Connector', status: 'Planned', does: 'Reach an on-premise EWM system securely. Credentials stay out of the code.' },
  { id: 'wz', name: 'SAP Build Work Zone', status: 'Planned', does: 'Puts these tiles on the launchpad people already use, with single sign-on through SAP Cloud Identity Services.' }
]

const ours = (c: any): System[] => [
  { id: 'cap', name: 'Frontline Shift (CAP on SAP BTP)', status: 'Live', does: 'The app, the seven agents and the orchestrator, running now on Cloud Foundry.' },
  { id: 'hana', name: 'SAP HANA Cloud', status: 'Live', does: 'Stores skills, EWM records, requests, certificates, decisions and the audit trail. Each company sees only its own people.' },
  { id: 'xsuaa', name: 'SAP Authorization and Trust Management (XSUAA)', status: 'Live', does: 'Sign-in and roles. Worker, Supervisor, Manager and HR Admin each see only their own apps.' },
  {
    id: 'ai', name: 'SAP Generative AI Hub', status: c?.aiRoute === 'generative-ai-hub' ? 'Live' : 'Planned',
    does: `Turns what workers say into tasks and skills, with SAP data masking. Active AI route right now: ${AI_ROUTE[c?.aiRoute] ?? 'checking…'}.`
  }
]

function Node({ system, on, select }: { system: System; on: boolean; select: (s: System) => void }) {
  return (
    <button type="button" className={on ? 'node on' : 'node'} aria-pressed={on} onClick={() => select(system)}>
      <span className="node-name">{system.name}</span>
      <ObjectStatus state={STATE[system.status]}>{system.status}</ObjectStatus>
    </button>
  )
}

export function Landscape() {
  const [workers, setWorkers] = useState<any[]>([])
  const [worker, setWorker] = useState('')
  const [context, setContext] = useState<any>(null)
  const [selectedId, setSelectedId] = useState('ewm')

  useEffect(() => {
    list('/manager/Team?$orderby=name').then(rows => {
      setWorkers(rows)
      setWorker((rows.find(w => w.name.startsWith('Ravi')) ?? rows[0])?.ID ?? '')
    }).catch(() => setWorkers([]))
  }, [])

  useEffect(() => {
    if (worker) parsed(`/manager/sapContext(worker=${worker})`).then(setContext).catch(() => setContext(null))
  }, [worker])

  const platform = ours(context)
  const current = [...EXISTING, ...CONNECT, ...platform].find(s => s.id === selectedId) ?? EXISTING[0]
  const payload = context && current.data?.(context)
  const select = (s: System) => setSelectedId(s.id)

  return (
    <main className="page">
      <Title level="H1" size="H3">SAP landscape</Title>
      <Text>How Frontline Shift fits around the SAP systems a company already runs. It adds to them and doesn't replace them.</Text>
      <MessageStrip design="Information" hideCloseButton>
        No customer SAP system is connected in this demo. "Sample data" means our data in that SAP format. "Mock" means a local table stands in for that system.
      </MessageStrip>

      <div className="landscape">
        <section aria-label="Existing SAP systems">
          <Title level="H2" size="H5">Your existing SAP systems</Title>
          {EXISTING.map(s => <Node key={s.id} system={s} on={current.id === s.id} select={select} />)}
        </section>
        <div className="flow-arrow" aria-hidden="true">⇄</div>
        <section aria-label="Connection layer">
          <Title level="H2" size="H5">Connection layer</Title>
          {CONNECT.map(s => <Node key={s.id} system={s} on={current.id === s.id} select={select} />)}
        </section>
        <div className="flow-arrow" aria-hidden="true">⇄</div>
        <section aria-label="Frontline Shift on SAP BTP">
          <Title level="H2" size="H5">Frontline Shift on SAP BTP</Title>
          {platform.map(s => <Node key={s.id} system={s} on={current.id === s.id} select={select} />)}
        </section>
      </div>

      <Card header={<CardHeader titleText={current.name} subtitleText={current.api ?? 'Platform service'} />}>
        <div className="card-body">
          <ObjectStatus state={STATE[current.status]}>{current.status}</ObjectStatus>
          <Text>{current.does}</Text>
          {current.note && <MessageStrip design="Critical" hideCloseButton>{current.note}</MessageStrip>}
          {current.id === 'learn' && <Link href="https://learning.sap.com" target="_blank">Open SAP Learning</Link>}
          {current.data && (
            <>
              <Label for="landscape-worker">Show the record for</Label>
              <Select id="landscape-worker" value={worker} onChange={e => setWorker(e.target.value)}>
                {workers.map(w => <Option key={w.ID} value={w.ID}>{w.name}</Option>)}
              </Select>
              <Title level="H3" size="H6">Current record, in this format</Title>
              <pre className="payload" tabIndex={0}>{JSON.stringify(payload ?? null, null, 2)}</pre>
            </>
          )}
        </div>
      </Card>
    </main>
  )
}
