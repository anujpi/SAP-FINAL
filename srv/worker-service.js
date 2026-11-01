const cds = require('@sap/cds')
const { handle, WORKER_EVENTS } = require('./orchestrator')
const market = require('./agents/market')
const askJson = require('./lib/llm')
const workerIdOf = require('./lib/worker-id')

function parsePayload(req, payload) {
  if (!payload) return {}
  try {
    return JSON.parse(payload)
  } catch {
    return req.reject(400, 'payload must be valid JSON')
  }
}

module.exports = cds.service.impl(function () {
  this.on('sendEvent', async req => {
    const { type, payload } = req.data
    if (!WORKER_EVENTS.has(type)) return req.reject(403, `Workers cannot send ${type}`)
    const workerId = workerIdOf(req)
    if (!workerId) return req.reject(403, 'This login is not linked to a worker')
    return JSON.stringify(await handle(workerId, type, parsePayload(req, payload), req.user.id))
  })

  this.on('aiStatus', () => askJson.provider())

  this.on('marketSignal', async () => {
    const { Vacancies, RoleSkills } = cds.entities('frontline')
    const external = await SELECT.from(Vacancies).where({ isExternal: true })
    return JSON.stringify(market(external, await SELECT.from(RoleSkills)))
  })
})
