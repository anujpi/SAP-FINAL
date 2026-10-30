const cds = require('@sap/cds')
const { handle, resetWorker } = require('./orchestrator')
const review = require('./agents/review')
const audit = require('./agents/audit')

module.exports = cds.service.impl(function () {
  this.on('reviewPacket', async req => {
    const { Workers, SkillClaims, EvidenceItems, RoleMatches, LearningPlans } = cds.entities('frontline')
    const worker_ID = req.data.worker
    const worker = await SELECT.one.from(Workers).where({ ID: worker_ID })
    if (!worker) return req.reject(404, 'Worker not found')
    return JSON.stringify(review({
      worker,
      claims: await SELECT.from(SkillClaims).where({ worker_ID }),
      evidence: await SELECT.from(EvidenceItems).where({ worker_ID }),
      matches: await SELECT.from(RoleMatches).where({ worker_ID }),
      plan: await SELECT.one.from(LearningPlans).where({ worker_ID })
    }))
  })

  this.on('decide', async req => {
    const { worker, outcome, reasons } = req.data
    return JSON.stringify(await handle(worker, 'manager_decided', { outcome, reasons }, req.user.id))
  })

  this.on('attest', async req => {
    const { worker, skill, proficiency } = req.data
    return JSON.stringify(await handle(worker, 'evidence_added', { skill, proficiency }, req.user.id))
  })

  this.on('fairnessReport', async () => {
    const { Workers, RoleMatches, ReviewDecisions } = cds.entities('frontline')
    const workers = new Map((await SELECT.from(Workers)).map(w => [w.ID, w]))
    const decisions = new Map((await SELECT.from(ReviewDecisions)).map(d => [d.worker_ID, d.outcome]))
    const rows = (await SELECT.from(RoleMatches))
      .filter(m => workers.has(m.worker_ID))
      .map(m => ({ ...workers.get(m.worker_ID), score: m.score, outcome: decisions.get(m.worker_ID) }))
    return JSON.stringify(audit(rows))
  })

  this.on('resetDemo', async req => {
    await resetWorker(req.data.worker)
    return true
  })
})
