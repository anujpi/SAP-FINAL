const cds = require('@sap/cds')
const { handle, WORKER_EVENTS } = require('./orchestrator')
const market = require('./agents/market')
const askJson = require('./lib/llm')
const workerIdOf = require('./lib/worker-id')
const { ewmSupport } = require('./lib/ewm')

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

  this.on('myHireRequests', async req => {
    const { HireInterests, Vacancies, Roles, RoleMatches, Applications, ShareLinks } = cds.entities('frontline')
    const worker_ID = workerIdOf(req)
    const roles = new Map((await SELECT.from(Roles)).map(r => [r.ID, r.title]))
    const vacancies = new Map((await SELECT.from(Vacancies)).map(v => [v.ID, v]))
    const scores = new Map((await SELECT.from(RoleMatches).where({ worker_ID })).map(m => [m.vacancy_ID, m.score]))
    const job = id => ({ company: vacancies.get(id)?.employer, role: roles.get(vacancies.get(id)?.role_ID), site: vacancies.get(id)?.site })
    const links = new Map((await SELECT.from(ShareLinks).where({ worker_ID })).map(l => [l.token, l]))
    return JSON.stringify({
      requests: (await SELECT.from(HireInterests).where({ worker_ID }).orderBy('createdAt desc')).map(i => ({
        ID: i.ID, status: i.status, message: i.message, score: scores.get(i.vacancy_ID) ?? 0, ...job(i.vacancy_ID)
      })),
      access: (await SELECT.from(Applications).where({ worker_ID }).orderBy('createdAt desc')).map(a => ({
        ID: a.ID, status: a.status, token: a.token, cancelled: Boolean(links.get(a.token)?.revokedAt),
        skills: JSON.parse(links.get(a.token)?.skills ?? '[]'), ...job(a.vacancy_ID)
      }))
    })
  })

  this.on('myEwmSupport', async req => {
    const { EwmTaskRecords } = cds.entities('frontline')
    return JSON.stringify(ewmSupport(await SELECT.from(EwmTaskRecords).where({ worker_ID: workerIdOf(req) })))
  })

  this.on('marketSignal', async () => {
    const { Vacancies, RoleSkills } = cds.entities('frontline')
    const external = await SELECT.from(Vacancies).where({ isExternal: true })
    return JSON.stringify(market(external, await SELECT.from(RoleSkills)))
  })
})
