// Demo only: with DEMO_WORKER_ID set, a Worker login with no workerId attribute acts as that fictional worker.
// It sets the attribute itself because the @restrict rules read $user.workerId. Unset, it does nothing.
function applyDemoWorker(user, demoId) {
  if (demoId && user?.is('Worker') && !user.attr.workerId?.length) user.attr.workerId = demoId
}

module.exports = { applyDemoWorker }
