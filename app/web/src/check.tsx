import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Card, CardHeader, List, ListItemStandard, MessageStrip, ShellBar, Text, ThemeProvider } from '@ui5/webcomponents-react'
import './styles.css'

const PROOF: Record<string, string> = { ewm_records: 'EWM records', observed_on_shift: 'Observed on shift', training_record: 'Training record', assessment: 'Practice assessment' }

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
    <ThemeProvider>
      <ShellBar primaryTitle="Skill certificate check" secondaryTitle="Frontline Shift · sample data" />
      <main className="worker-main">
        {!result && !failed && <Text>Checking…</Text>}
        {failed && <MessageStrip design="Negative" hideCloseButton>This check could not be completed. Please try again.</MessageStrip>}
        {result?.status === 'unknown' && <MessageStrip design="Negative" hideCloseButton>Link not found.</MessageStrip>}
        {result?.status === 'cancelled' && <MessageStrip design="Critical" hideCloseButton>Cancelled by the worker.</MessageStrip>}
        {result?.status === 'altered' && <MessageStrip design="Negative" hideCloseButton>Could not be verified.</MessageStrip>}
        {result?.status === 'genuine' && (
          <>
            <MessageStrip design="Positive" hideCloseButton><strong>Genuine, not altered.</strong></MessageStrip>
            <Card header={<CardHeader titleText={result.worker} subtitleText="Certificates this worker chose to share" />}>
              <List separators="Inner">
                {result.skills.map((s: any) => (
                  <ListItemStandard
                    key={s.skill}
                    wrappingType="Normal"
                    description={`Level ${s.proficiency} · Verified by ${[s.verifiedBy, s.verifierTitle, s.company].filter(Boolean).join(', ')} · ${PROOF[s.proofType] ?? 'Proof on file'} · ${new Date(s.issuedAt).toLocaleDateString()}`}
                  >
                    {s.skill}
                  </ListItemStandard>
                ))}
              </List>
            </Card>
            <Text>Please interview and assess as usual.</Text>
          </>
        )}
      </main>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Check />)
