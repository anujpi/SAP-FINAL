// Demo only: with DEMO_WORKER_ID set, a Worker login that has no workerId attribute acts as that worker.
function applyDemoWorker(user, demoId) {
  if (demoId && user?.is('Worker') && !user.attr.workerId?.length) user.attr.workerId = demoId
}

// Demo only: which Staff row a login is. SAP logins are email addresses, so DEMO_STAFF_MAP maps them
// ({"person@example.com":"arjun"}) and stays out of the code. Any other login is Meera while demo mode is on.
function staffLogin(id, env = process.env) {
  let map = {}
  try { map = JSON.parse(env.DEMO_STAFF_MAP || '{}') } catch { /* a bad map means no mapped logins */ }
  return map[id] ?? (env.DEMO_WORKER_ID ? 'meera' : id)
}

module.exports = { applyDemoWorker, staffLogin }
