const cds = require('@sap/cds')
const workerIdOf = require('./lib/worker-id')
const { staffLogin, personaOf, personaHeader, PERSONA_ROLES } = require('./lib/demo-worker')

const ROLES = ['Worker', 'Manager', 'Supervisor', 'HRAdmin']

const COUNTED = { Workers: 'employees', SkillClaims: 'skills', EwmTaskRecords: 'EWM records', SkillCredentials: 'certificates', OtherCertificates: 'other certificates', Vacancies: 'open roles', HireInterests: 'hiring requests', AuditEvents: 'audit events' }

module.exports = cds.service.impl(function () {
  this.on('dataSource', async () => {
    const entities = cds.entities('frontline')
    const counts = {}
    for (const [name, label] of Object.entries(COUNTED)) counts[label] = (await SELECT.one.from(entities[name]).columns('count(*) as n')).n
    return JSON.stringify({ kind: cds.db.kind, counts })
  })

  this.on('me', async req => {
    const { Staff, Workers, Companies } = cds.entities('frontline')
    const persona = personaOf(req.user, personaHeader(req))
    const roles = ROLES.filter(role => req.user.is(role) && (!persona || PERSONA_ROLES[persona].includes(role)))
    const staff = roles.some(r => r !== 'Worker') ? await SELECT.one.from(Staff).where({ login: staffLogin(req.user.id, process.env, persona) }) : null
    const worker = workerIdOf(req) ? await SELECT.one.from(Workers).where({ ID: workerIdOf(req) }) : null
    const company_ID = staff?.company_ID ?? worker?.company_ID
    const company = company_ID ? await SELECT.one.from(Companies).where({ ID: company_ID }) : null
    return JSON.stringify({ name: staff?.name ?? worker?.name ?? req.user.id, title: staff?.title ?? '', company: company?.name ?? '', roles, persona: persona ?? '', canSwitch: Boolean(process.env.DEMO_WORKER_ID) && req.user.is('Manager') })
  })
})
