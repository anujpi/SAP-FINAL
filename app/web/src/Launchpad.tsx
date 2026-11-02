import { useEffect, useState } from 'react'
import { Icon, Tag, Text, Title } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/employee.js'
import '@ui5/webcomponents-icons/dist/hint.js'
import '@ui5/webcomponents-icons/dist/add-employee.js'
import '@ui5/webcomponents-icons/dist/group.js'
import '@ui5/webcomponents-icons/dist/validate.js'
import '@ui5/webcomponents-icons/dist/workflow-tasks.js'
import '@ui5/webcomponents-icons/dist/search.js'
import '@ui5/webcomponents-icons/dist/upload.js'
import '@ui5/webcomponents-icons/dist/history.js'
import '@ui5/webcomponents-icons/dist/shield.js'
import '@ui5/webcomponents-icons/dist/connected.js'
import '@ui5/webcomponents-icons/dist/shipping-status.js'
import '@ui5/webcomponents-icons/dist/org-chart.js'
import '@ui5/webcomponents-icons/dist/education.js'
import '@ui5/webcomponents-icons/dist/customer-briefing.js'
import { list, parsed } from './api'
import type { User } from './main'

type TileProps = { title: string; subtitle: string; icon: string; href?: string; external?: boolean; kpi?: number; tag?: string }

function Tile({ title, subtitle, icon, href, external, kpi, tag }: TileProps) {
  const body = (
    <>
      <span className="tile-title">{title}</span>
      <span className="tile-sub">{subtitle}</span>
      <span className="tile-foot">
        <Icon name={icon} className="tile-icon" />
        {kpi !== undefined && <span className="tile-kpi">{kpi}</span>}
        {tag && <Tag design="Neutral" hideStateIcon>{tag}</Tag>}
      </span>
    </>
  )
  if (!href) return <div className="tile disabled">{body}</div>
  return <a className="tile" href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{body}</a>
}

export function Launchpad({ user }: { user: User }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const is = (...roles: string[]) => roles.some(role => user.roles.includes(role))
  const leads = is('Manager', 'Supervisor', 'HRAdmin')

  useEffect(() => {
    if (!leads) return
    const count = (key: string, rows: Promise<any[]>) => rows.then(r => setCounts(c => ({ ...c, [key]: r.length }))).catch(() => undefined)
    count('team', list('/manager/Team'))
    count('verify', parsed('/manager/verificationRequests()'))
    if (is('Manager', 'HRAdmin')) {
      count('review', list('/manager/ReviewQueue'))
      count('applicants', parsed('/manager/applicants()'))
    }
  }, [leads])

  return (
    <main className="launchpad">
      <div>
        <Title level="H1" size="H3">Welcome, {user.name}</Title>
        {(user.title || user.company) && <Text>{[user.title, user.company].filter(Boolean).join(', ')}</Text>}
      </div>

      <section>
        <Title level="H2" size="H5">Start here</Title>
        <div className="tiles">
          <Tile title="How It Works" subtitle="The whole flow, step by step" icon="hint" href="#/how" />
        </div>
      </section>

      {is('Worker') && (
        <section>
          <Title level="H2" size="H5">My career</Title>
          <div className="tiles">
            <Tile title="My Career Journey" subtitle="Skills, certificates, jobs, resume" icon="employee" href="#/worker" />
          </div>
        </section>
      )}

      {leads && (
        <section>
          <Title level="H2" size="H5">My team</Title>
          <div className="tiles">
            <Tile title="My Employees" subtitle="Everyone and their skills" icon="group" href="#/manager/team" kpi={counts.team} />
            {is('Manager', 'Supervisor') && <Tile title="Verification Requests" subtitle="Confirm skills with proof" icon="validate" href="#/manager/verify" kpi={counts.verify} />}
            {is('Manager', 'Supervisor') && <Tile title="EWM Daily Upload" subtitle="Load confirmed warehouse tasks" icon="upload" href="#/manager/ewm" />}
            {is('Manager', 'HRAdmin') && <Tile title="Role Reviews" subtitle="Decide on internal moves" icon="workflow-tasks" href="#/manager/review" kpi={counts.review} />}
          </div>
        </section>
      )}

      {is('Manager', 'HRAdmin') && (
        <section>
          <Title level="H2" size="H5">Hiring and compliance</Title>
          <div className="tiles">
            <Tile title="Find Talent" subtitle="Filter by verified skill" icon="search" href="#/manager/talent" />
            <Tile title="Hire From Outside" subtitle="Post a role, find anonymous candidates" icon="add-employee" href="#/manager/hire" />
            <Tile title="Outside Applicants" subtitle="Certificates from other companies" icon="customer-briefing" href="#/manager/applicants" kpi={counts.applicants} />
            <Tile title="Audit Log" subtitle="Every agent hand-off" icon="history" href="#/manager/audit" />
            {is('HRAdmin') && <Tile title="Fairness Audit" subtitle="Fictional sample figures" icon="shield" href="#/manager/fairness" />}
            <Tile title="SAP Landscape" subtitle="How this connects to your SAP systems" icon="connected" href="#/landscape" />
          </div>
        </section>
      )}

      <section>
        <Title level="H2" size="H5">Alongside your existing SAP apps</Title>
        <p className="section-note">An example of how Frontline Shift would sit next to the apps people already use. The first three are not connected in this demo.</p>
        <div className="tiles">
          <Tile title="Warehouse Tasks" subtitle="SAP S/4HANA EWM" icon="shipping-status" tag="Not connected" />
          <Tile title="Employee Profile" subtitle="SAP SuccessFactors" icon="org-chart" tag="Not connected" />
          <Tile title="Job Requisitions" subtitle="SAP SuccessFactors Recruiting" icon="customer-briefing" tag="Not connected" />
          <Tile title="SAP Learning" subtitle="Courses used in pathways" icon="education" href="https://learning.sap.com" external />
        </div>
      </section>
    </main>
  )
}
