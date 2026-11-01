import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { actAs } from './api'
import { WorkerApp } from './Worker'
import { ManagerApp } from './Manager'
import './styles.css'

function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    const onError = (e: Event) => setLoadError((e as CustomEvent<string>).detail)
    addEventListener('api-load-error', onError)
    return () => removeEventListener('api-load-error', onError)
  }, [])

  const isManager = hash.startsWith('#/manager')
  // Set before the screens render, because their first data loads run straight away.
  actAs(isManager ? 'meera' : 'ravi')

  return (
    <>
      {loadError && (
        <p className="alert load-error" role="alert">
          Some data couldn't load: {loadError}{' '}
          <button type="button" onClick={() => setLoadError('')}>Dismiss</button>
        </p>
      )}
      {isManager ? <ManagerApp /> : <WorkerApp />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
