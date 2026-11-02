const cds = require('@sap/cds')
const workerIdOf = require('./lib/worker-id')
const { staffLogin } = require('./lib/demo-worker')

const ROLES = ['Worker', 'Manager', 'Supervisor', 'HRAdmin']

module.exports = cds.service.impl(function () {
  this.on('me', async req => {
    const { Staff, Workers, Companies } = cds.entities('frontline')
    const roles = ROLES.filter(role => req.user.is(role))
    const staff = roles.some(r => r !== 'Worker') ? await SELECT.one.from(Staff).where({ login: staffLogin(req.user.id) }) : null
    const worker = workerIdOf(req) ? await SELECT.one.from(Workers).where({ ID: workerIdOf(req) }) : null
    const company_ID = staff?.company_ID ?? worker?.company_ID
    const company = company_ID ? await SELECT.one.from(Companies).where({ ID: company_ID }) : null
    return JSON.stringify({ name: staff?.name ?? worker?.name ?? req.user.id, title: staff?.title ?? '', company: company?.name ?? '', roles })
  })
})
