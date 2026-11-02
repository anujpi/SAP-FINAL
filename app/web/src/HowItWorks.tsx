import { useEffect, useState } from 'react'
import { Button, Card, CardHeader, MessageStrip, ObjectStatus, Text, Title } from '@ui5/webcomponents-react'
import { parsed, setPersona } from './api'
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
    who: 'Other company', title: 'Posts a role and finds anonymous candidates', persona: 'arjun', hash: '#/manager/hire', open: 'Open as Arjun', status: 'Sample data',
    what: 'Arjun at Meridian Freight posts a new role and sees who matches: verified skills and a score, with no name and no employer. He asks to connect.',
    behind: 'Only people who turned on other companies appear. Each company gets its own candidate reference, so companies can\'t compare notes.'
  },
  {
    who: 'Worker', title: 'Decides who can see them', persona: 'ravi', hash: '#/worker', open: 'Open as Ravi', status: 'Live',
    what: 'Ravi sees who asked and for which role, picks which certificates to share, or says no. He can take it back at any time.',
    behind: 'His yes is stored as a consent record in HANA. His employer\'s screens and audit log never show any of this.'
  },
  {
    who: 'Other company', title: 'Checks the certificates and replies', persona: 'arjun', hash: '#/manager/applicants', open: 'Open as Arjun', status: 'Live',
    what: 'Only now does Arjun see Ravi\'s name and chosen certificates, checked as genuine. He can invite him to interview.',
    behind: 'If Ravi takes back permission, his name and certificates disappear from this screen straight away.'
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

const PERMISSIONS = [
  ['Worker', 'Starts a profile', 'Worker gives consent', 'Their company can see their skills'],
  ['Worker', 'Turns on other companies', 'Worker chooses', 'Other companies see skills and score only: no name, no employer'],
  ['Other company', 'Asks to connect', 'Worker says yes or no', 'That one company sees their name and the certificates they picked'],
  ['Worker', 'Takes back permission', 'Worker chooses', 'That company loses access straight away'],
  ['Manager', 'Verifies a skill', 'Signed-in Manager role, same company', 'A certificate, and the skill goes into SuccessFactors'],
  ['Anyone', 'Opens a shared link', 'Worker created the link', 'Only what that link shares, until it is cancelled']
]

const SAP_PERMISSIONS = [
  ['Sign-in and roles', 'XSUAA role collections decide which screens and actions each person gets', 'Live'],
  ['SAP HANA Cloud', 'People never connect to the database. The app reads it through its own HDI container user, and checks each person\'s role and company first', 'Live'],
  ['SAP S/4HANA EWM', 'A read-only communication arrangement (SAP_COM_0353), set up by the customer\'s SAP admin', 'Planned'],
  ['SAP SuccessFactors', 'An OAuth client with a read-only permission role for employee data. Writing skills needs Skills Partner status or file import', 'Planned']
]

function LiveData() {
  const [source, setSource] = useState<any>(null)
  useEffect(() => { parsed('/user/dataSource()').then(setSource).catch(() => setSource(null)) }, [])
  if (!source) return null
  const counts = Object.entries(source.counts).map(([label, n]) => `${n} ${label}`).join(' · ')
  return (
    <MessageStrip design={source.kind === 'hana' ? 'Positive' : 'Critical'} hideCloseButton>
      <strong>{source.kind === 'hana' ? 'Read live from SAP HANA Cloud just now:' : `Local test database (${source.kind}), not HANA:`}</strong> {counts}
    </MessageStrip>
  )
}

export function HowItWorks({ user }: { user: User }) {
  return (
    <main className="page how">
      <Title level="H1" size="H3">How it works</Title>
      <Text>The work people already do becomes skills they can prove. AI recommends, people decide. Follow the steps in order, and each button opens that screen as the right person.</Text>

      <LiveData />

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

      <Title level="H2" size="H4">Who gives permission for what</Title>
      <Text>Nobody sees a worker's data unless a rule below allows it. Each permission is logged.</Text>
      <Card>
        <DataTable columns={['Who acts', 'What happens', 'Permission needed', 'What it unlocks']} rows={PERMISSIONS} />
      </Card>
      <Card header={<CardHeader titleText="Permissions in SAP" subtitleText="What a customer's SAP admin would set up" />}>
        <DataTable columns={['System', 'How access works', 'Status']} rows={SAP_PERMISSIONS} />
      </Card>

      <Title level="H2" size="H4">The seven agents</Title>
      <Text>Only two use AI. Anything that affects someone's job is plain code a person can check, or a person's own decision.</Text>
      <Card>
        <DataTable columns={['Agent', 'Name', 'What it does', 'Runs on']} rows={AGENTS} />
      </Card>

      <p className="fine-print">"Live" runs on SAP BTP now. "Sample data" is fictional data in SAP's format. "Mock" means a local table stands in for that system. No customer SAP system is connected.</p>
    </main>
  )
}
