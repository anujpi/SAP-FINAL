import { createRoot } from 'react-dom/client'
import { setDevUser, signIn } from './api'
import './welcome.css'

const devLogin = (user: string) => {
  setDevUser(user)
  signIn()
}

function SignIn({ className = '' }: { className?: string }) {
  return <a className={`signin ${className}`} href="/index.html">Sign in with SAP</a>
}

const BENEFITS = [
  ['Fill roles from inside', 'Search your own people by what they have proven, before you pay an agency to look outside.'],
  ['Proof, not a CV', 'Every verified skill is backed by EWM records and the name of the manager who confirmed it.'],
  ['Fits the SAP you run', 'It runs on SAP BTP and is designed to feed SuccessFactors, so HR works where it already works.'],
  ['People who don\'t type can join', 'Workers talk or type in English or Hindi, and check what was understood before it is saved.'],
  ['Decisions you can defend', 'A manager decides, never the AI. Every step is logged, and an audit flags gaps between groups for HR.']
]

type Status = 'Live' | 'Sample data' | 'Stand-in'

// Each step: who acts, what happens, how to try it after signing in, and what runs behind it.
const STEPS: { who: string; title: string; what: string; tryIt: string; behind: string; status: Status }[] = [
  {
    who: 'Employee', title: 'Says what they do', status: 'Live',
    what: 'In their own words and language, by talking or typing. They check what was understood before anything is saved.',
    tryIt: 'Sign in as an employee. On My Career Journey, tap Record a new skill, then Talk or Type instead. Check the read-back and tap Yes, this is correct.',
    behind: 'SAP Generative AI Hub, with data masking, matches what they said by meaning to a real skills library: 13 company skills and 185 from ESCO, the EU\'s free skills library. Anything with no match is shown as not in the library, never guessed.'
  },
  {
    who: 'Warehouse', title: 'EWM shows the work really happened', status: 'Sample data',
    what: 'Each day the confirmed warehouse tasks are loaded. Every skill then shows how many real tasks back it up, on how many days.',
    tryIt: 'As a manager, open EWM daily upload, tap Use today\'s sample, then Load into HANA. The employee\'s Skills tab now shows the counts.',
    behind: 'Plain code, not AI, compares the skills with the records in SAP HANA Cloud: 5 tasks over 2 days counts as seen. Nothing is verified by records alone. No live EWM system is connected.'
  },
  {
    who: 'Employee', title: 'Asks their manager', status: 'Live',
    what: 'The employee picks which skills to put forward. The Learning tab shows, for each skill, how to get it verified.',
    tryIt: 'On the Skills or Learning tab, tap Ask my manager to verify.',
    behind: 'Requests go only to managers and supervisors at the employee\'s own company.'
  },
  {
    who: 'Manager', title: 'Confirms it with proof, or says not yet', status: 'Live',
    what: 'The manager sees what the employee said and what EWM shows, then verifies with proof, or says not yet with a reason. The AI never makes this call.',
    tryIt: 'As a manager, Team overview shows what is waiting. Open Verification requests, choose the proof, then Verify and issue certificate.',
    behind: 'Proof upload is not connected yet, so only its type and reference are stored. Only verified skills count towards a job match, and the score is plain code.'
  },
  {
    who: 'Employee', title: 'Gets a certificate they own', status: 'Live',
    what: 'Each verified skill becomes a certificate naming the manager and the company, and a line on their resume.',
    tryIt: 'Open the Certificates tab, tick a skill, Create share link, then open it. Anyone can check it with no login. The Resume tab is ready to print.',
    behind: 'Each certificate is signed, so any change is detected. The employee can cancel a link at any time.'
  },
  {
    who: 'Other company', title: 'Posts a role and finds anonymous candidates', status: 'Sample data',
    what: 'Another company sees who matches its role: verified skills and a score, with no name and no employer. It asks to connect.',
    tryIt: 'Sign in as a manager at the other company and open Hire from outside. Candidates appear only if their company joined the job marketplace and they turned on other companies in Jobs.',
    behind: 'Each company gets its own candidate reference, so companies can\'t compare notes.'
  },
  {
    who: 'Employee', title: 'Decides who sees them', status: 'Live',
    what: 'They see who asked and for which role, pick which certificates to share, or say no. They can take it back at any time, and their employer never finds out.',
    tryIt: 'Open the Requests tab and tap Share and connect, or Say no.',
    behind: 'A yes is stored as a consent record. Taking it back removes their name from the other company\'s screens straight away.'
  },
  {
    who: 'HR', title: 'Finds people for better roles', status: 'Stand-in',
    what: 'Verified skills go into SuccessFactors, so HR can filter people by what they have proven. HR also decides who can sign in.',
    tryIt: 'As HR, open Find talent and pick a skill. Under People and settings, register or remove people and join the job marketplace.',
    behind: 'A table in SAP HANA stands in for SuccessFactors today. A real tenant replaces only that one step.'
  }
]

const PERMISSIONS = [
  ['Employee starts a profile', 'Their consent', 'Their company sees their skills'],
  ['Employee turns on other companies', 'Their choice, and their company joined the marketplace', 'Skills and score only: no name, no employer'],
  ['Other company asks to connect', 'The employee says yes', 'That one company sees their name and the certificates they picked'],
  ['Employee takes back permission', 'Their choice', 'That company loses access straight away'],
  ['Manager verifies a skill', 'Manager role at the same company', 'A certificate, and the skill goes into SuccessFactors'],
  ['Anyone opens a shared link', 'The employee made the link', 'Only what that link shares, until it is cancelled']
]

const AGENTS = [
  ['Discovery', 'Splits what the worker said into tasks', 'SAP Generative AI Hub'],
  ['Verification', 'Matches tasks to skills in the library, by meaning', 'SAP Generative AI Hub'],
  ['Matching', 'Works out the job match from verified skills', 'Plain code'],
  ['Pathway', 'Picks SAP Learning lessons for each gap', 'Plain code'],
  ['Review', 'Gathers what a manager needs for a role review', 'Plain code'],
  ['Market', 'Shows which skills other companies ask for', 'Plain code'],
  ['Audit', 'Flags gaps between groups for HR to review', 'Plain code']
]

const SAP_NOW = ['SAP Business Technology Platform', 'SAP HANA Cloud', 'SAP sign-in and roles (XSUAA)', 'SAP Generative AI Hub']
const SAP_ROLLOUT = ['SAP S/4HANA EWM', 'SAP SuccessFactors', 'SAP Integration Suite', 'SAP Build Work Zone']

function Welcome() {
  return (
    <div className="product">
      <header className="hero">
        <div className="hero-copy">
          <nav className="topnav" aria-label="Page">
            <span className="brand">Frontline Shift</span>
            <a href="#how-it-works">How it works</a>
            <a href="#price">Pricing</a>
          </nav>
          <h1>The people you need next are already on your floor.</h1>
          <p className="lede">
            Frontline Shift finds the skills your warehouse staff already use, checks them against SAP EWM, and has their manager verify them.
            You get a searchable record of who can do what. They get proof they own.
          </p>
          {import.meta.env.DEV ? (
            <div className="dev-logins">
              <button type="button" onClick={() => devLogin('presenter')}>Local: Presenter (all roles)</button>
              <button type="button" onClick={() => devLogin('ravi')}>Local: Ravi (Worker)</button>
              <button type="button" onClick={() => devLogin('meera')}>Local: Meera (Manager, Supervisor, HR)</button>
              <button type="button" onClick={() => devLogin('sunil')}>Local: Sunil (Supervisor)</button>
            </div>
          ) : <SignIn />}
        </div>

        <figure className="example" aria-label="Example with sample data">
          <blockquote lang="hi">मैं बिन की दोबारा गिनती करता हूँ, फिर अंतर के लिए सुपरवाइज़र के साथ एडजस्टमेंट करता हूँ।</blockquote>
          <p className="translation">"I recount the bin, then raise an adjustment for the difference with my supervisor."</p>
          <div className="tape" aria-hidden="true" />
          <div className="verified">
            <strong>Cycle counting, level 2</strong>
            <span>46 confirmed tasks in EWM</span>
            <span>Verified by the warehouse operations manager</span>
          </div>
          <figcaption>Example with sample data</figcaption>
        </figure>
      </header>

      <main className="body">
        <section aria-labelledby="gets">
          <h2 id="gets">What your company gets</h2>
          <dl className="benefits">
            {BENEFITS.map(([title, text]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how-it-works" aria-labelledby="how">
          <h2 id="how">How it works</h2>
          <div className="start-box">
            <h3>Before you start</h3>
            <p>
              Sign in with SAP. Only people a company has registered can get in. What you see depends on your role: employees see My Career Journey,
              managers and supervisors see their team, and HR also sees People and settings. Every screen labels what is sample data.
            </p>
          </div>
          <ol className="steps-lane">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="marker" aria-hidden="true">{i + 1}</span>
                <p className="step-who">{step.who} <span className={`status ${step.status === 'Live' ? 'live' : ''}`}>{step.status}</span></p>
                <h3>{step.title}</h3>
                <p>{step.what}</p>
                <p className="try"><strong>Try it:</strong> {step.tryIt}</p>
                <p className="behind">{step.behind}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="perm">
          <h2 id="perm">Who gives permission for what</h2>
          <p className="note">Nobody sees a worker's data unless a rule below allows it. Each permission is logged.</p>
          <div className="table-wrap">
            <table className="pricing">
              <thead><tr><th scope="col">What happens</th><th scope="col">Permission needed</th><th scope="col">What it unlocks</th></tr></thead>
              <tbody>{PERMISSIONS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="agents">
          <h2 id="agents">Seven agents, two use AI</h2>
          <p className="note">Anything that affects someone's job is plain code a person can check, or a person's own decision.</p>
          <div className="table-wrap">
            <table className="pricing">
              <thead><tr><th scope="col">Agent</th><th scope="col">What it does</th><th scope="col">Runs on</th></tr></thead>
              <tbody>{AGENTS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="note">"Live" runs on SAP BTP now. "Sample data" is fictional data in SAP's format. "Stand-in" means a table in SAP HANA does that system's job for now.</p>
        </section>

        <section className="promise" aria-labelledby="promise">
          <h2 id="promise">Workers stay in charge</h2>
          <p>
            Their answers are never used for appraisal or discipline. They choose what to share, and with which company. If another company wants to reach them,
            it sees only skills and a score until they say yes, and their employer never finds out. They can take back permission or delete their data at any time.
          </p>
        </section>

        <section aria-labelledby="fits">
          <h2 id="fits">How it fits your SAP</h2>
          <div className="fits">
            <div>
              <h3>Runs on today</h3>
              <ul>{SAP_NOW.map(s => <li key={s}>{s}</li>)}</ul>
            </div>
            <div>
              <h3>Connected during rollout</h3>
              <ul>{SAP_ROLLOUT.map(s => <li key={s}>{s}</li>)}</ul>
              <p className="note">Not connected yet: this needs a customer's SAP system. Writing skills into SuccessFactors also needs SAP Skills Partner status, or SAP's file import.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="price">
          <h2 id="price">How it's priced</h2>
          <table className="pricing">
            <tbody>
              <tr><th scope="row">Subscription</th><td>₹150 to ₹300 per enrolled worker, per month</td></tr>
              <tr><th scope="row">Site setup</th><td>₹5 to ₹15 lakh, one time</td></tr>
              <tr><th scope="row">Optional success fee</th><td>₹10,000 to ₹20,000 per internal move</td></tr>
            </tbody>
          </table>
          <p className="note">Planned pricing, to be confirmed in a pilot. Workers never pay, and their data is never sold.</p>
          <p className="pilot">Start with one site. We run the first pilot at cost, in exchange for measured results.</p>
        </section>
      </main>

      <footer className="foot">
        {!import.meta.env.DEV && <SignIn className="on-dark" />}
        <p>
          Frontline Shift is by Team NOVESTACK, built on SAP BTP for the SAP Hackfest 2026. It is not made or endorsed by SAP.
          The app uses sample company data for now.
        </p>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Welcome />)
// The page renders after load, so jump to a link like #how-it-works once it exists.
setTimeout(() => { if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView() })
