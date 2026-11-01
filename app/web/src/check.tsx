import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

// Public page: no login, and it shows only what the check function returns.
function Check() {
  const [result, setResult] = useState<any>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token = location.hash.slice(1).replace(/[^a-f0-9]/gi, '')
    fetch(`/passport/check(token='${token}')`)
      .then(res => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      })
      .then(body => setResult(JSON.parse(body.value)))
      .catch(() => setFailed(true))
  }, [])

  return (
    <main className="phone">
      <header className="bar"><strong>Skill Passport check</strong></header>
      <div className="demo-badge">DEMO · All data is fictional</div>
      <section className="stack">
        {!result && !failed && <p>Checking…</p>}
        {failed && <p className="alert" role="alert">This check could not be completed. Please try again.</p>}
        {result?.status === 'unknown' && <p className="alert">Link not found.</p>}
        {result?.status === 'cancelled' && <p className="notice">Cancelled by the worker.</p>}
        {result?.status === 'altered' && <p className="alert">Could not be verified.</p>}
        {result?.status === 'genuine' && (
          <>
            <p className="success"><strong>Genuine, not altered.</strong></p>
            <h1>{result.worker}</h1>
            <ul className="cards">
              {result.skills.map((s: any) => (
                <li key={s.skill}>
                  <strong>{s.skill}</strong>
                  <small>Level {s.proficiency} · {s.method === 'supervisor_attestation' ? 'Supervisor attestation' : 'Assessment'} · {new Date(s.issuedAt).toLocaleDateString()}</small>
                </li>
              ))}
            </ul>
            <p>The worker chose to share these skills. Please interview and assess as usual.</p>
          </>
        )}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Check />)
