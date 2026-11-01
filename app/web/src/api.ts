// Talks only to our own backend. Locally it logs in as a mocked user; on BTP the Approuter session handles login.
let devUser = 'ravi'
export const actAs = (user: 'ravi' | 'meera' | 'sunil') => { devUser = user }

let csrfToken: string | null = null

function authHeaders(): Record<string, string> {
  return import.meta.env.DEV ? { Authorization: `Basic ${btoa(`${devUser}:${devUser}`)}` } : {}
}

async function getCsrfToken() {
  if (import.meta.env.DEV) return ''
  if (!csrfToken) {
    const res = await fetch('/worker/', { headers: { 'x-csrf-token': 'fetch' } })
    csrfToken = res.headers.get('x-csrf-token') ?? ''
  }
  return csrfToken
}

async function request(path: string, body?: unknown) {
  const headers: Record<string, string> = { ...authHeaders() }
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
