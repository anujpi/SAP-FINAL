import { Button, Card, ObjectStatus, Text, Title } from '@ui5/webcomponents-react'
import { setPersona } from './api'
import { DataTable } from './ui'
import type { User } from './main'

type Status = 'Live' | 'Sample data' | 'Mock'
const STATE: Record<Status, 'Positive' | 'Critical' | 'Information'> = { Live: 'Positive', 'Sample data': 'Critical', Mock: 'Information' }

type Step = { who: string; title: string; what: string; behind: string; status: Status; persona: 'ravi' | 'meera' | 'arjun'; hash: string; open: string }

const STEPS: Step[] = [
  {
    who: 'Worker', title: 'Says what they do', persona: 'ravi', hash: '#/worker', open: 'Open as Ravi', status: 'Live',
    what: 'Ravi gives consent, then talks or types about his work, in English or Hindi. He checks the read-back before anything is saved.',
    behind: 'SAP Generative AI Hub, with data masking, turns his words into tasks and a list of skills (agents A and B). HANA Cloud stores them.'
  },
  {
    who: 'Warehouse', title: 'EWM shows the work really happened', persona: 'meera', hash: '#/manager/ewm', open: 'Open as Meera', status: 'Sample data',
    what: 'Each day, someone at the warehouse loads the confirmed tasks from EWM. Each skill then shows how many real tasks back it up.',
    behind: 'A daily extract goes into HANA Cloud. Later, SAP Integration Suite can run this on a schedule. No live EWM system is connected.'
  },
  {
    who: 'Manager', title: 'Sees their people', persona: 'meera', hash: '#/manager/team', open: 'Open as Meera', status: 'Live',
    what: 'Meera signs in under her own company and sees only her employees, each with a full profile and skills.',
    behind: 'SAP sign-in and roles (XSUAA) decide what she can see, and each company sees only its own people.'
  },
  {
    who: 'Manager', title: 'Confirms a skill with proof', persona: 'meera', hash: '#/manager/verify', open: 'Open as Meera', status: 'Live',
    what: 'Ravi asks. Meera reads what EWM shows, then verifies with proof, or says "not yet" with a reason. The AI never decides this.',
    behind: 'Only verified skills count towards a job match, and the score is plain code (agents C and D). The proof itself is mocked for now.'
  },
  {
    who: 'Worker', title: 'Gets a certificate and resume', persona: 'ravi', hash: '#/worker', open: 'Open as Ravi', status: 'Live',
    what: 'Each verified skill becomes a certificate naming the manager and the company, and a line on his resume. He owns them and chooses what to share.',
    behind: 'Each certificate is signed, so any change is detected. Anyone can check a shared link with no login, and Ravi can cancel it.'
  },
  {
    who: 'Other company', title: 'Trusts it and replies', persona: 'arjun', hash: '#/manager/applicants', open: 'Open as Arjun', status: 'Sample data',
    what: 'Ravi applies to another company with his certificates. Arjun at Meridian Freight sees they are genuine and can invite him. Ravi\'s employer can\'t see any of this.',
    behind: 'A worker\'s outside job search stays out of their employer\'s screens and audit log. The companies and jobs are fictional.'
  },
  {
    who: 'HR', title: 'Finds people for better roles', persona: 'meera', hash: '#/manager/talent', open: 'Open as Meera', status: 'Mock',
    what: 'Verified skills go into SuccessFactors, so HR can filter people by what they\'ve proven. This is why a company already on SAP would buy it.',
    behind: 'A local table stands in for SuccessFactors today. A real tenant replaces only that one step. See the SAP Landscape for what\'s needed.'
  }
]

const AGENTS = [
  ['A', 'Discovery', 'Turns what the worker said into tasks', 'SAP Generative AI Hub'],
  ['B', 'Verification', 'Maps tasks to skills. Self-reported only, until a person confirms', 'SAP Generative AI Hub'],
  ['C', 'Matching', 'Works out the job match from verified skills', 'Plain code, no AI'],
  ['D', 'Pathway', 'Picks SAP Learning courses for each gap', 'Plain code, no AI'],
  ['E', 'Review', 'Gathers everything a manager needs for a role review', 'Plain code, no AI'],
  ['F', 'Market', 'Shows which skills other companies ask for', 'Plain code, no AI'],
  ['G', 'Audit', 'Checks for unfair gaps between groups, for HR to review', 'Plain code, no AI']
]

const open = (step: Step, canSwitch: boolean) => {
  if (canSwitch) setPersona(step.persona, step.hash)
  else location.hash = step.hash
}

export function HowItWorks({ user }: { user: User }) {
  return (
    <main className="page how">
      <Title level="H1" size="H3">How it works</Title>
      <Text>The work people already do becomes skills they can prove. AI recommends, people decide. Follow the steps in order, and each button opens that screen as the right person.</Text>

      <ol className="how-steps">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="how-number" aria-hidden="true">{i + 1}</span>
            <Card>
              <div className="card-body">
                <div className="how-head">
                  <span className="how-who">{step.who}</span>
                  <ObjectStatus state={STATE[step.status]}>{step.status}</ObjectStatus>
                </div>
                <Title level="H2" size="H5">{step.title}</Title>
                <Text>{step.what}</Text>
                <Text className="fine-print">{step.behind}</Text>
                <Button onClick={() => open(step, user.canSwitch)}>{user.canSwitch ? step.open : 'Open this screen'}</Button>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Title level="H2" size="H4">The seven agents</Title>
      <Text>Only two use AI. Anything that affects someone's job is plain code a person can check, or a person's own decision.</Text>
      <Card>
        <DataTable columns={['Agent', 'Name', 'What it does', 'Runs on']} rows={AGENTS} />
      </Card>

      <p className="fine-print">"Live" runs on SAP BTP now. "Sample data" is fictional data in SAP's format. "Mock" means a local table stands in for that system. No customer SAP system is connected.</p>
    </main>
  )
}
