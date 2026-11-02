import { createRoot } from 'react-dom/client'
import { Button, Text, ThemeProvider, Title } from '@ui5/webcomponents-react'
import { setDevUser, signIn } from './api'
import './styles.css'

const devLogin = (user: string) => {
  setDevUser(user)
  signIn()
}

// Public page. The real sign-in happens on the SAP identity page that the Approuter redirects to.
function Welcome() {
  return (
    <ThemeProvider>
      <main className="welcome">
        <section className="welcome-card">
          <div className="brand-mark" aria-hidden="true">FS</div>
          <Title level="H1" size="H2">Frontline Shift</Title>
          <Text>Turn the work people already do into verified skills, explained job matches and a Skill Passport they control.</Text>
          {import.meta.env.DEV ? (
            <div className="welcome-actions">
              <Button design="Emphasized" onClick={() => devLogin('ravi')}>Local: Ravi (Worker)</Button>
              <Button onClick={() => devLogin('meera')}>Local: Meera (Manager, Supervisor, HR)</Button>
              <Button onClick={() => devLogin('sunil')}>Local: Sunil (Supervisor)</Button>
            </div>
          ) : (
            <div className="welcome-actions">
              <Button design="Emphasized" onClick={signIn}>Sign in with SAP</Button>
            </div>
          )}
          <Text className="fine-print">Demo tenant on SAP BTP. All people and data are fictional.</Text>
        </section>
      </main>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Welcome />)
