// Talks only to our own backend. Locally the welcome page picks a mocked user; on BTP the Approuter session handles login.
const DEV_USER = 'fs-dev-user'
export const devUser = () => {
  if (!import.meta.env.DEV) return ''
  try { return sessionStorage.getItem(DEV_USER) ?? '' } catch { return '' }
}
export const setDevUser = (user: string) => {
  try { sessionStorage.setItem(DEV_USER, user) } catch { /* the mocked login just won't stick */ }
}

// Demo only: which person this browser tab is showing. Each tab keeps its own, so three tabs can show three people.
const PERSONA = 'fs-persona'
export const persona = () => {
  try { return sessionStorage.getItem(PERSONA) ?? '' } catch { return '' }
}
export function setPersona(next: string, hash = '#/') {
  try { sessionStorage.setItem(PERSONA, next) } catch { /* the switch just won't stick */ }
  location.hash = hash
  location.reload()
}

export const signIn = () => location.assign('/index.html')
export function signOut() {
  if (import.meta.env.DEV) {
    setDevUser('')
    location.assign('/welcome.html')
  } else {
    location.assign('/do/logout')
  }
}

// Reloading sends the browser through sign-in. Once a minute at most, so a bad proxy can't cause a reload loop.
function signInAgain() {
  try {
    const last = Number(sessionStorage.getItem('fs-signed-in-again') ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem('fs-signed-in-again', String(Date.now()))
    location.reload()
    return true
  } catch {
    return false
  }
}

let csrfToken: string | null = null

function authHeaders(): Record<string, string> {
  const user = devUser()
  return import.meta.env.DEV ? { Authorization: `Basic ${btoa(`${user}:${user}`)}` } : {}
}

async function getCsrfToken() {
  if (import.meta.env.DEV) return ''
  if (!csrfToken) {
    const res = await fetch('/user/', { headers: { 'x-csrf-token': 'fetch' } })
    csrfToken = res.headers.get('x-csrf-token') ?? ''
  }
  return csrfToken
}

async function request(path: string, body?: unknown) {
  const headers: Record<string, string> = { ...authHeaders() }
  if (persona()) headers['x-demo-persona'] = persona()
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    headers['x-csrf-token'] = await getCsrfToken()
  }
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* a login page or proxy error, reported below */ }
  // When a session ends, the Approuter answers with its login page or refuses the CSRF token.
  const sessionEnded = !import.meta.env.DEV && (
    res.status === 401 || res.headers.get('x-csrf-token')?.toLowerCase() === 'required' || (res.ok && Boolean(text) && json === null)
  )
  if (sessionEnded) {
    if (signInAgain()) return new Promise(() => {}) // the page is reloading, so leave the screen as it is
    throw new Error('Your session ended. Please sign in again.')
  }
  if (!res.ok) {
    const message = json?.error?.message ?? `The server answered ${res.status}. Please try again.`
    // Screens treat a failed read as empty, so raise it here rather than show a misleading blank.
    if (body === undefined) dispatchEvent(new CustomEvent('api-load-error', { detail: message }))
    throw new Error(message)
  }
  return json
}

/** Reads an entity set. */
export const list = async <T = any>(path: string): Promise<T[]> => (await request(path)).value

/** Calls an OData function or action and returns its plain value. */
export const value = async <T = any>(path: string, body?: unknown): Promise<T> => (await request(path, body))?.value

/** Calls a function or action whose value is a JSON string. */
export const parsed = async <T = any>(path: string, body?: unknown): Promise<T> => JSON.parse(await value<string>(path, body))

/** Sends one journey event through the orchestrator. */
export const sendEvent = (type: string, payload?: unknown) =>
  parsed('/worker/sendEvent', { type, payload: payload === undefined ? null : JSON.stringify(payload) })

export const parseJson = <T,>(text: string | null | undefined, fallback: T): T => {
  try { return text ? JSON.parse(text) : fallback } catch { return fallback }
}

export const AI_ROUTE: Record<string, string> = {
  'generative-ai-hub': 'SAP Generative AI Hub',
  'direct-anthropic': 'Anthropic API (not SAP)',
  'direct-gemini': 'Google Gemini (not SAP)',
  offline: 'Offline backup (no AI)'
}
