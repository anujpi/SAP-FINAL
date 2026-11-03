const cds = require('@sap/cds')
const { handle, WORKER_EVENTS } = require('./orchestrator')
const market = require('./agents/market')
const askJson = require('./lib/llm')
const workerIdOf = require('./lib/worker-id')
const { ewmSupport, TASK_SKILL, MIN_TASKS, MIN_DAYS } = require('./lib/ewm')

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
        ID: i.ID, status: i.status, message: i.message, at: i.createdAt, score: scores.get(i.vacancy_ID) ?? 0, ...job(i.vacancy_ID)
      })),
      access: (await SELECT.from(Applications).where({ worker_ID }).orderBy('createdAt desc')).map(a => ({
        ID: a.ID, status: a.status, at: a.modifiedAt, token: a.token, cancelled: Boolean(links.get(a.token)?.revokedAt),
        skills: JSON.parse(links.get(a.token)?.skills ?? '[]'), ...job(a.vacancy_ID)
      }))
    })
  })

  this.on('marketplace', async req => {
    const { Workers, Companies } = cds.entities('frontline')
    const me = await SELECT.one.from(Workers).columns('company_ID').where({ ID: workerIdOf(req) })
    return Boolean((await SELECT.one.from(Companies).where({ ID: me?.company_ID }))?.marketplace)
  })

  this.on('skillGuide', async req => {
    const { SkillClaims, Skills, EwmTaskRecords, LearningModules, VerificationRequests, Workers, RoleSkills, Roles } = cds.entities('frontline')
    const worker_ID = workerIdOf(req)
    const me = await SELECT.one.from(Workers).where({ ID: worker_ID })
    const claims = await SELECT.from(SkillClaims).where({ worker_ID })
    const support = ewmSupport(await SELECT.from(EwmTaskRecords).where({ worker_ID }))
    const needed = me?.targetRole_ID ? await SELECT.from(RoleSkills).where({ role_ID: me.targetRole_ID }) : []
    const role = me?.targetRole_ID ? await SELECT.one.from(Roles).where({ ID: me.targetRole_ID }) : null
    const ids = [...new Set([...claims.map(c => c.skill_ID), ...needed.map(n => n.skill_ID)])]
    const skills = new Map((await SELECT.from(Skills).where({ ID: { in: ids.length ? ids : ['-'] } })).map(s => [s.ID, s]))
    const modules = await SELECT.from(LearningModules).columns('ID', 'skill_ID', 'title', 'url', 'durationMin')
    const requests = await SELECT.from(VerificationRequests).where({ worker_ID }).orderBy('createdAt desc')
    const trackable = new Set(Object.values(TASK_SKILL))
    return JSON.stringify({
      targetRole: role?.title ?? null,
      threshold: { tasks: MIN_TASKS, days: MIN_DAYS },
      skills: ids.map(id => {
        const claim = claims.find(c => c.skill_ID === id)
        const skill = skills.get(id)
        return {
          skill_ID: id,
          name: skill?.name ?? id,
          description: skill?.description ?? '',
          escoUri: skill?.escoUri || null,
          status: claim?.status ?? 'missing_for_role',
          neededForRole: needed.some(n => n.skill_ID === id),
          trackable: trackable.has(id),
          ewm: support[id] ?? null,
          module: modules.find(m => m.skill_ID === id) ?? null,
          request: requests.find(r => r.skill_ID === id)?.status ?? null
        }
      })
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
