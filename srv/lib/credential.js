// Certificates: signing them, and checking a share link that holds them.
const cds = require('@sap/cds')
const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto')

function secret() {
  const s = process.env.PASSPORT_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') throw new Error('PASSPORT_SECRET must be set in production')
  return 'local-development-only'
}

const sign = c =>
  createHmac('sha256', secret())
    // Databases format timestamps differently, so normalise before signing and checking.
    .update([c.worker_ID, c.skill_ID, c.proficiency, c.method, new Date(c.issuedAt).toISOString(), c.verifiedBy, c.verifierTitle, c.company, c.proofType].join('|'))
    .digest('hex')

function isGenuine(c) {
  const expected = Buffer.from(sign(c))
  const actual = Buffer.from(c.signature ?? '')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const newToken = () => randomBytes(32).toString('hex')

/** Returns only what the worker chose to share. Used by the public check and by employers reading an application. */
async function checkShare(token) {
  const { ShareLinks, SkillCredentials, Skills, Workers } = cds.entities('frontline')
  const link = await SELECT.one.from(ShareLinks).where({ token })
  if (!link) return { status: 'unknown' }
  if (link.revokedAt) return { status: 'cancelled' }

  const shared = JSON.parse(link.skills)
  const credentials = await SELECT.from(SkillCredentials).where({ worker_ID: link.worker_ID, skill_ID: { in: shared } })
  if (credentials.length !== shared.length || !credentials.every(isGenuine)) return { status: 'altered' }

  const worker = await SELECT.one.from(Workers).columns('name').where({ ID: link.worker_ID })
  const names = new Map((await SELECT.from(Skills).columns('ID', 'name').where({ ID: { in: shared } })).map(s => [s.ID, s.name]))
  return {
    status: 'genuine',
    worker: worker?.name,
    skills: credentials.map(c => ({
      skill: names.get(c.skill_ID),
      proficiency: c.proficiency,
      method: c.method,
      issuedAt: c.issuedAt,
      verifiedBy: c.verifiedBy,
      verifierTitle: c.verifierTitle,
      company: c.company,
      proofType: c.proofType
    }))
  }
}

module.exports = { sign, isGenuine, newToken, checkShare }
