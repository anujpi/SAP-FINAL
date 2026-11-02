import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Avatar, Button, IllustratedMessage, MessageStrip, Popover, ShellBar, ShellBarItem, Text, ThemeProvider, Title } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/activity-items.js'
import '@ui5/webcomponents-fiori/dist/illustrations/UnableToLoad.js'
import { devUser, list, parsed, persona, setPersona, signOut, value } from './api'
import { WorkerApp } from './Worker'
import { ManagerApp } from './Manager'
import { Launchpad } from './Launchpad'
import { Landscape } from './Landscape'
import { HowItWorks } from './HowItWorks'
import { initials } from './ui'
import './styles.css'

export type User = { name: string; title: string; company: string; roles: string[]; persona: string; canSwitch: boolean }

const PEOPLE = [
  { id: 'ravi', label: 'Ravi K., employee' },
  { id: 'meera', label: 'Meera S., manager' },
  { id: 'arjun', label: 'Arjun D., other company' },
  { id: '', label: 'All my roles' }
]

const has = (user: User, ...roles: string[]) => roles.some(role => user.roles.includes(role))

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

function App() {
  const hash = useHash()
  const [user, setUser] = useState<User | null>(null)
  const [authFailed, setAuthFailed] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [trace, setTrace] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const profileRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (import.meta.env.DEV && !devUser()) { location.assign('/welcome.html'); return }
    parsed<User>('/user/me()').then(setUser).catch(() => setAuthFailed(true))
  }, [])

  useEffect(() => {
    const onError = (e: Event) => setLoadError((e as CustomEvent<string>).detail)
    addEventListener('api-load-error', onError)
    return () => removeEventListener('api-load-error', onError)
  }, [])

  // A worker on a phone goes straight to their journey: the home page would be one tile.
  const onlyWorker = user && user.roles.length === 1 && user.roles[0] === 'Worker'
  const path = hash.replace(/^#\/?/, '') || (onlyWorker ? 'worker' : '')
  const [app, section, detail] = path.split('/')

  const resetDemo = async () => {
    setProfileOpen(false)
    const team = await list('/manager/Team?$orderby=name')
    const ravi = team.find(w => w.name.startsWith('Ravi'))
    if (ravi) await value('/manager/resetDemo', { worker: ravi.ID })
    setResetKey(k => k + 1)
  }

  let screen = null
  if (user) {
    if (app === 'worker' && has(user, 'Worker')) screen = <WorkerApp key={resetKey} showTrace={trace} user={user} />
    else if (app === 'manager' && has(user, 'Manager', 'Supervisor', 'HRAdmin')) screen = <ManagerApp key={`${resetKey}-${section}`} user={user} section={section} detail={detail} />
    else if (app === 'landscape' && has(user, 'Manager', 'HRAdmin')) screen = <Landscape />
    else if (app === 'how') screen = <HowItWorks user={user} />
    else if (app === '') screen = <Launchpad user={user} />
    else screen = (
      <IllustratedMessage name="UnableToLoad" titleText="You don't have access to this app" subtitleText="Ask your administrator for the role, or go back to the home page.">
        <Button onClick={() => { location.hash = '#/' }}>Go to home page</Button>
      </IllustratedMessage>
    )
  }

  return (
    <ThemeProvider>
      <ShellBar
        primaryTitle="Frontline Shift"
        secondaryTitle={user?.company || 'Demo tenant'}
        logo={<Avatar shape="Square" size="XS" initials="FS" colorScheme="Accent6" />}
        onLogoClick={() => { location.hash = '#/' }}
        profile={user ? <Avatar initials={initials(user.name)} /> : undefined}
        onProfileClick={e => { profileRef.current = e.detail.targetRef; setProfileOpen(true) }}
      >
        {app === 'worker' && <ShellBarItem icon="activity-items" text="Agent activity" onClick={() => setTrace(on => !on)} />}
      </ShellBar>
      <Popover open={profileOpen} opener={profileRef.current} placement="Bottom" horizontalAlign="End" onClose={() => setProfileOpen(false)}>
        {user && (
          <div className="profile">
            <Title level="H5">{user.name}</Title>
            {user.title && <Text>{user.title}</Text>}
            {user.company && <Text>{user.company}</Text>}
            <Text className="fine-print">Roles: {user.roles.join(', ') || 'none assigned'}</Text>
            <Button design="Transparent" onClick={() => { setProfileOpen(false); location.hash = '#/how' }}>How it works</Button>
            {user.canSwitch && (
              <div className="view-as">
                <Text className="fine-print">Demo: view as</Text>
                {PEOPLE.map(p => (
                  <Button key={p.id} design={persona() === p.id ? 'Emphasized' : 'Default'} onClick={() => setPersona(p.id)}>{p.label}</Button>
                ))}
              </div>
            )}
            {has(user, 'HRAdmin') && <Button design="Transparent" onClick={resetDemo}>Reset demo data</Button>}
            <Button onClick={signOut}>Sign out</Button>
          </div>
        )}
      </Popover>
      {loadError && (
        <MessageStrip design="Negative" onClose={() => setLoadError('')}>Some data couldn't load: {loadError}</MessageStrip>
      )}
      {authFailed && (
        <IllustratedMessage name="UnableToLoad" titleText="We couldn't confirm who you are" subtitleText="Your session may have ended.">
          <Button design="Emphasized" onClick={signOut}>Sign in again</Button>
        </IllustratedMessage>
      )}
      {screen}
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
