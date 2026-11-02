// Demo only: with DEMO_WORKER_ID set, a Worker login that has no workerId attribute acts as that worker.
function applyDemoWorker(user, demoId) {
  if (demoId && user?.is('Worker') && !user.attr.workerId?.length) user.attr.workerId = demoId
}

// Demo only: lets one presenter login show each person on one laptop. It only ever narrows the roles shown
// and picks a fictional Staff row. Unset DEMO_WORKER_ID in a real deployment and this does nothing.
const PERSONA_ROLES = { ravi: ['Worker'], meera: ['Manager', 'Supervisor', 'HRAdmin'], arjun: ['Manager'] }

// Read from each request's header. The user object can be shared between requests, so it can't hold this.
function personaOf(user, header, demoId = process.env.DEMO_WORKER_ID) {
  return demoId && user?.is('Manager') && Object.hasOwn(PERSONA_ROLES, header ?? '') ? header : undefined
}

const personaHeader = req => req.http?.req?.headers?.['x-demo-persona']

// Demo only: which Staff row a login is. SAP logins are email addresses, so DEMO_STAFF_MAP maps them
// ({"person@example.com":"arjun"}) and stays out of the code. Any other login is Meera while demo mode is on.
function staffLogin(id, env = process.env, persona) {
  if (persona === 'meera' || persona === 'arjun') return persona
  let map = {}
  try { map = JSON.parse(env.DEMO_STAFF_MAP || '{}') } catch { /* a bad map means no mapped logins */ }
  return map[id] ?? (env.DEMO_WORKER_ID ? 'meera' : id)
}

module.exports = { applyDemoWorker, personaOf, personaHeader, staffLogin, PERSONA_ROLES }
