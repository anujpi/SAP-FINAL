const cds = require('@sap/cds')
const workerIdOf = require('./lib/worker-id')
const { ALL_ROLES } = require('./lib/identity')

const COUNTED = { Workers: 'employees', SkillClaims: 'skills', Skills: 'skills in the library', EwmTaskRecords: 'EWM records', SkillCredentials: 'certificates', Vacancies: 'open roles', HireInterests: 'hiring requests', AuditEvents: 'audit events' }

module.exports = cds.service.impl(function () {
  this.on('dataSource', async () => {
    const entities = cds.entities('frontline')
    const counts = {}
    for (const [name, label] of Object.entries(COUNTED)) counts[label] = (await SELECT.one.from(entities[name]).columns('count(*) as n')).n
    return JSON.stringify({ kind: cds.db.kind, counts })
  })

  this.on('me', async req => {
    const { Staff, Workers, Companies } = cds.entities('frontline')
    const attr = req.user.attr ?? {}
    // Only registered people get a role. Anyone else is signed in to SAP but not to this app.
    if (!attr.registered) return JSON.stringify({ registered: false, name: req.user.id, title: '', company: '', roles: [], persona: '', canSwitch: false })
    const roles = ALL_ROLES.filter(r => req.user.is(r))
    const staff = attr.staffLogin && roles.some(r => r !== 'Worker') ? await SELECT.one.from(Staff).where({ login: attr.staffLogin }) : null
    const worker = workerIdOf(req) ? await SELECT.one.from(Workers).where({ ID: workerIdOf(req) }) : null
    const company_ID = staff?.company_ID ?? worker?.company_ID
    const company = company_ID ? await SELECT.one.from(Companies).where({ ID: company_ID }) : null
    return JSON.stringify({
      registered: true, name: staff?.name ?? worker?.name ?? req.user.id, title: staff?.title ?? worker?.jobTitle ?? '',
      company: company?.name ?? '', roles, persona: attr.persona ?? '', canSwitch: Boolean(attr.presenter)
    })
  })
})
