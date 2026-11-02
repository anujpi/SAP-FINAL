const cds = require('@sap/cds')
const { applyDemoWorker } = require('./lib/demo-worker')

cds.middlewares.add((req, res, next) => {
  applyDemoWorker(cds.context.user, process.env.DEMO_WORKER_ID)
  next()
}, { after: 'auth' })
