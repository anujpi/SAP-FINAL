// Who someone is in this app. Signing in proves an email address. Only people a company has
// registered (an employee or a member of staff) get any role here, so any other account sees nothing.
const cds = require('@sap/cds')

const ALL_ROLES = ['Worker', 'Manager', 'Supervisor', 'HRAdmin']
// Presenter logins can show each person on one laptop. Nobody else can switch.
const PERSONAS = { ravi: ['Worker'], meera: ['Manager', 'Supervisor', 'HRAdmin'], arjun: ['Manager'] }
const RAVI = '00000000-0000-4000-8000-000000000001'

const presenters = (env = process.env) => [
  ...String(env.DEMO_PRESENTERS ?? '').split(','),
  // The local test login, only outside production.
  ...(env.NODE_ENV === 'production' ? [] : ['presenter'])
].map(s => s.trim().toLowerCase()).filter(Boolean)

// Fixed sign-ins for showing the app: DEMO_LOGINS="you@x.com=meera,other@y.com=ravi". Each listed
// account always signs in as that one person, with no switch, so two windows show two people.
const fixedLogins = (env = process.env) => new Map(String(env.DEMO_LOGINS ?? '').split(',')
  .map(pair => pair.split('=').map(s => s.trim().toLowerCase()))
  .filter(([key, as]) => key && Object.hasOwn(PERSONAS, as ?? '')))

const as = (who, demoWorkerId) => ({
  roles: PERSONAS[who],
  workerId: who === 'ravi' ? demoWorkerId : undefined,
  staffLogin: who === 'ravi' ? undefined : who
})

/** Pure: works out roles and links from the sign-in keys, the registered people and the presenter list. */
function resolve({ keys, directory, persona, presenterKeys, fixed = new Map(), demoWorkerId = RAVI }) {
  const pinned = keys.map(k => fixed.get(k)).find(Boolean)
  if (pinned) return { registered: true, presenter: false, persona: pinned, ...as(pinned, demoWorkerId) }
  if (keys.some(k => presenterKeys.includes(k))) {
    const chosen = Object.hasOwn(PERSONAS, persona ?? '') ? persona : ''
    if (chosen) return { registered: true, presenter: true, persona: chosen, ...as(chosen, demoWorkerId) }
    return { registered: true, presenter: true, persona: '', roles: ALL_ROLES, workerId: demoWorkerId, staffLogin: 'meera' }
  }
  for (const k of keys) {
    const staff = directory.staff.get(k)
    const worker = directory.workers.get(k)
    if (staff || worker) {
      return {
        registered: true,
        presenter: false,
        persona: '',
        roles: [...new Set([...(staff?.roles ?? []), ...(worker ? ['Worker'] : [])])],
        workerId: worker?.ID,
        staffLogin: staff?.login
      }
    }
  }
  return { registered: false, presenter: false, persona: '', roles: [] }
}

// Registered people, kept for 15 seconds so each request doesn't read the table again.
let cache
let loadedAt = 0
async function directory() {
  if (cache && Date.now() - loadedAt < 15_000) return cache
  const { Workers, Staff } = cds.entities('frontline')
  const [workers, staff] = await cds.tx(async tx => [
    await tx.run(SELECT.from(Workers).columns('ID', 'email', 'login').where({ active: true })),
    await tx.run(SELECT.from(Staff).columns('login', 'email', 'roles'))
  ])
  const byKey = (rows, value) => {
    const map = new Map()
    for (const r of rows) for (const k of [r.email, r.login]) if (k) map.set(String(k).toLowerCase(), value(r))
    return map
  }
  cache = {
    workers: byKey(workers, w => ({ ID: w.ID })),
    staff: byKey(staff, s => ({ login: s.login, roles: String(s.roles ?? '').split(',').map(r => r.trim()).filter(Boolean) }))
  }
  loadedAt = Date.now()
  return cache
}
const forget = () => { cache = undefined }

/** Express middleware, after sign-in: replaces the user with one whose roles come from registration. */
async function identify(req, res, next) {
  try {
    const user = cds.context?.user
    if (!user || user._is_anonymous) return next()
    const keys = [user.id, user.attr?.email].filter(Boolean).map(k => String(k).toLowerCase())
    const who = resolve({ keys, directory: await directory(), persona: req.headers['x-demo-persona'], presenterKeys: presenters(), fixed: fixedLogins(), demoWorkerId: process.env.DEMO_WORKER_ID || RAVI })
    // A new object each time: the signed-in user can be shared between requests, so it must never be changed.
    const next_user = new cds.User({
      id: user.id,
      roles: who.roles,
      attr: { ...(user.attr ?? {}), workerId: who.workerId, staffLogin: who.staffLogin, registered: who.registered, presenter: who.presenter, persona: who.persona }
    })
    cds.context.user = req.user = next_user
    next()
  } catch (e) {
    next(e)
  }
}

module.exports = { resolve, presenters, fixedLogins, identify, forget, PERSONAS, ALL_ROLES }
