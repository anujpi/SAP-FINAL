const cds = require('@sap/cds')
const workerIdOf = require('./lib/worker-id')
const { newToken, checkShare } = require('./lib/credential')

module.exports = cds.service.impl(function () {
  this.on('createLink', async req => {
    const { SkillCredentials, ShareLinks } = cds.entities('frontline')
    const worker_ID = workerIdOf(req)
    const skills = [...new Set(req.data.skills ?? [])]
    if (!worker_ID) return req.reject(403, 'This login is not linked to a worker')
    if (!skills.length) return req.reject(400, 'Choose at least one skill to share')

    // Only proven skills can leave the system, and each one already has its signed certificate.
    const credentials = await SELECT.from(SkillCredentials).where({ worker_ID, skill_ID: { in: skills } })
    if (credentials.length !== skills.length) return req.reject(400, 'Only verified skills can be shared')

    const token = newToken()
    await INSERT.into(ShareLinks).entries({ worker_ID, token, skills: JSON.stringify(skills) })
    return token
  })

  this.on('cancelLink', async req => {
    const { ShareLinks } = cds.entities('frontline')
    const changed = await UPDATE(ShareLinks)
      .set({ revokedAt: new Date().toISOString() })
      .where({ token: req.data.token, worker_ID: workerIdOf(req) })
    return changed > 0
  })

  this.on('check', async req => JSON.stringify(await checkShare(req.data.token)))
})
