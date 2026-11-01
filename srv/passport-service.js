const cds = require('@sap/cds')
const { randomBytes, createHmac, timingSafeEqual } = require('node:crypto')
const workerIdOf = require('./lib/worker-id')

function secret() {
  const s = process.env.PASSPORT_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') throw new Error('PASSPORT_SECRET must be set in production')
  return 'local-development-only'
}

const sign = c =>
  createHmac('sha256', secret())
    // Databases format timestamps differently, so normalise before signing and checking.
    .update([c.worker_ID, c.skill_ID, c.proficiency, c.method, new Date(c.issuedAt).toISOString()].join('|'))
    .digest('hex')

function isGenuine(c) {
  const expected = Buffer.from(sign(c))
  const actual = Buffer.from(c.signature ?? '')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

module.exports = cds.service.impl(function () {
  this.on('createLink', async req => {
    const { SkillClaims, SkillCredentials, ShareLinks } = cds.entities('frontline')
    const worker_ID = workerIdOf(req)
    const skills = [...new Set(req.data.skills ?? [])]
    if (!worker_ID) return req.reject(403, 'This login is not linked to a worker')
    if (!skills.length) return req.reject(400, 'Choose at least one skill to share')

    // Only proven skills can leave the system.
    const claims = await SELECT.from(SkillClaims).where({ worker_ID, status: 'verified', skill_ID: { in: skills } })
    if (claims.length !== skills.length) return req.reject(400, 'Only verified skills can be shared')

    await DELETE.from(SkillCredentials).where({ worker_ID, skill_ID: { in: skills } })
    const issuedAt = new Date().toISOString()
    await INSERT.into(SkillCredentials).entries(claims.map(c => {
      const credential = { worker_ID, skill_ID: c.skill_ID, proficiency: c.proficiency, method: c.source, issuedAt }
      return { ...credential, signature: sign(credential) }
    }))

    const token = randomBytes(32).toString('hex')
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

  this.on('check', async req => {
    const { ShareLinks, SkillCredentials, Skills, Workers } = cds.entities('frontline')
    const link = await SELECT.one.from(ShareLinks).where({ token: req.data.token })
    if (!link) return JSON.stringify({ status: 'unknown' })
    if (link.revokedAt) return JSON.stringify({ status: 'cancelled' })

    const shared = JSON.parse(link.skills)
    const credentials = await SELECT.from(SkillCredentials).where({ worker_ID: link.worker_ID, skill_ID: { in: shared } })
    if (credentials.length !== shared.length || !credentials.every(isGenuine)) return JSON.stringify({ status: 'altered' })

    const worker = await SELECT.one.from(Workers).columns('name').where({ ID: link.worker_ID })
    const names = new Map((await SELECT.from(Skills).columns('ID', 'name').where({ ID: { in: shared } })).map(s => [s.ID, s.name]))
    return JSON.stringify({
      status: 'genuine',
      worker: worker?.name,
      skills: credentials.map(c => ({ skill: names.get(c.skill_ID), proficiency: c.proficiency, method: c.method, issuedAt: c.issuedAt }))
    })
  })
})
