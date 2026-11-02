// The only code that runs agents, changes a worker's stage or writes the audit trail.
const cds = require('@sap/cds')
const discover = require('./agents/discover')
const verify = require('./agents/verify')
const match = require('./agents/match')
const pathway = require('./agents/pathway')
const { sign, newToken } = require('./lib/credential')

const PROOF_TYPES = ['ewm_records', 'observed_on_shift', 'training_record']

// These can happen at any point once a profile exists, and none of them move the journey on.
const stayIn = stage => Object.fromEntries(
  ['verification_requested', 'verification_decided', 'outside_opt_in', 'application_submitted', 'application_answered'].map(type => [type, stage])
)

const TRANSITIONS = {
  NOT_STARTED: { consent_granted: 'DISCOVERING' },
  HALTED: { consent_granted: 'DISCOVERING' },
  DISCOVERING: { input_submitted: 'AWAITING_READBACK' },
  AWAITING_READBACK: { input_submitted: 'AWAITING_READBACK', readback_confirmed: 'ACTIVE' },
  ACTIVE: {
    ...stayIn('ACTIVE'),
    assessment_submitted: 'ACTIVE',
    module_completed: 'ACTIVE',
    outside_opt_in: 'ACTIVE',
    review_requested: 'AWAITING_MANAGER'
  },
  AWAITING_MANAGER: { ...stayIn('AWAITING_MANAGER'), manager_decided: 'ACTIVE' },
  SHORTLISTED: stayIn('SHORTLISTED')
}

// Events a worker may send. Verifications and decisions only arrive through ManagerService.
const WORKER_EVENTS = new Set([
  'consent_granted', 'consent_revoked', 'input_submitted', 'readback_confirmed',
  'assessment_submitted', 'module_completed', 'outside_opt_in', 'review_requested',
  'verification_requested', 'application_submitted'
])

const ACTOR_ROLE = type => (WORKER_EVENTS.has(type) ? 'worker' : 'manager')

function fail(status, message) {
  throw Object.assign(new Error(message), { status, code: String(status) })
}

function nextStage(stage, type) {
  if (type === 'consent_revoked') return 'HALTED'
  return TRANSITIONS[stage]?.[type] ?? fail(409, `Event ${type} is not valid in stage ${stage}`)
}

const db = () => cds.entities('frontline')

// Re-run matching and the learning plan after anything that changes evidence.
async function refresh(worker) {
  const { SkillClaims, Vacancies, RoleSkills, RoleMatches, LearningModules, LearningPlans } = db()
  const claims = await SELECT.from(SkillClaims).where({ worker_ID: worker.ID })
  const vacancies = await SELECT.from(Vacancies)
  const inScope = vacancies.filter(v => !v.isExternal || worker.outsideOptIn)

  await DELETE.from(RoleMatches).where({ worker_ID: worker.ID })
  let targetGaps = []
  for (const v of inScope) {
    const requirements = await SELECT.from(RoleSkills).where({ role_ID: v.role_ID })
    const result = match(requirements, claims)
    const eligibility = v.isExternal
      ? { eligible: true, reasons: ['Worker opted in to outside jobs'] }
      : { eligible: v.site === worker.site, reasons: [v.site === worker.site ? 'Same site' : `Vacancy is at ${v.site}`] }
    await INSERT.into(RoleMatches).entries({
      worker_ID: worker.ID,
      vacancy_ID: v.ID,
      score: result.score,
      strengths: JSON.stringify(result.strengths),
      gaps: JSON.stringify(result.gaps),
      eligibility: JSON.stringify(eligibility),
      ruleTrace: JSON.stringify(result.ruleTrace)
    })
    if (!v.isExternal && v.role_ID === worker.targetRole_ID) targetGaps = result.gaps
  }

  const modules = pathway(targetGaps, await SELECT.from(LearningModules))
  const plan = await SELECT.one.from(LearningPlans).where({ worker_ID: worker.ID })
  if (plan) await UPDATE(LearningPlans, plan.ID).with({ modules: JSON.stringify(modules) })
  else await INSERT.into(LearningPlans).entries({ worker_ID: worker.ID, modules: JSON.stringify(modules), completed: '[]' })
}

// A proven skill gets evidence, a signed certificate, a place in SuccessFactors and a fresh match.
async function addEvidence(worker, skill_ID, type, proficiency, verifier, proof = {}) {
  const { Skills, EvidenceItems, SkillClaims, SkillCredentials, SuccessFactorsSkills, Companies } = db()
  if (!(await SELECT.one.from(Skills).where({ ID: skill_ID }))) fail(400, `Unknown skill ${skill_ID}`)
  await INSERT.into(EvidenceItems).entries({ worker_ID: worker.ID, skill_ID, type, attestedBy: verifier.name, proofType: proof.type, proofRef: proof.ref })
  await DELETE.from(SkillClaims).where({ worker_ID: worker.ID, skill_ID })
  await INSERT.into(SkillClaims).entries({
    worker_ID: worker.ID, skill_ID, source: type, confidence: 1, status: 'verified', proficiency
  })

  const company = await SELECT.one.from(Companies).where({ ID: worker.company_ID })
  const credential = {
    worker_ID: worker.ID, skill_ID, proficiency, method: type, issuedAt: new Date().toISOString(),
    verifiedBy: verifier.name, verifierTitle: verifier.title ?? '', company: company?.name ?? '', proofType: proof.type ?? ''
  }
  await DELETE.from(SkillCredentials).where({ worker_ID: worker.ID, skill_ID })
  await INSERT.into(SkillCredentials).entries({ ...credential, signature: sign(credential) })

  // ponytail: writes to a local table standing in for SuccessFactors. Swap this for a Destination call when a tenant exists.
  await DELETE.from(SuccessFactorsSkills).where({ worker_ID: worker.ID, skill_ID })
  await INSERT.into(SuccessFactorsSkills).entries({
    company_ID: worker.company_ID, worker_ID: worker.ID, userName: worker.name, skill_ID, proficiency, verifiedBy: verifier.name, syncedAt: credential.issuedAt
  })

  await refresh(worker)
}

async function eraseWorkerData(workerId) {
  const d = db()
  for (const e of [d.TaskExperiences, d.SkillClaims, d.EvidenceItems, d.RoleMatches, d.LearningPlans, d.SkillCredentials, d.ShareLinks, d.ReviewDecisions, d.VerificationRequests, d.Applications, d.SuccessFactorsSkills])
    await DELETE.from(e).where({ worker_ID: workerId })
}

const HANDLERS = {
  async consent_granted(worker) {
    await INSERT.into(db().ConsentRecords).entries({ worker_ID: worker.ID, purpose: 'skills_profile', granted: true })
    return { contract: 'ConsentRecord' }
  },

  async consent_revoked(worker) {
    await UPDATE(db().ConsentRecords).set({ granted: false, revokedAt: new Date().toISOString() }).where({ worker_ID: worker.ID, granted: true })
    await eraseWorkerData(worker.ID)
    return { contract: 'ConsentRecord' }
  },

  async input_submitted(worker, { text }) {
    if (typeof text !== 'string' || !text.trim() || text.length > 4000) fail(400, 'Answer must be 1 to 4000 characters')
    const { TaskExperiences } = db()
    const { tasks, degraded } = await discover(text)
    await DELETE.from(TaskExperiences).where({ worker_ID: worker.ID })
    await INSERT.into(TaskExperiences).entries(tasks.map(t => ({ ...t, worker_ID: worker.ID, confirmed: false })))
    return { contract: 'TaskExperience[]', degraded, tasks }
  },

  async readback_confirmed(worker) {
    const { TaskExperiences, Skills, SkillClaims } = db()
    await UPDATE(TaskExperiences).set({ confirmed: true }).where({ worker_ID: worker.ID })
    const tasks = await SELECT.from(TaskExperiences).where({ worker_ID: worker.ID })
    const { claims, degraded } = await verify(tasks, await SELECT.from(Skills))
    await DELETE.from(SkillClaims).where({ worker_ID: worker.ID, status: { '!=': 'verified' } })
    const verified = await SELECT.from(SkillClaims).where({ worker_ID: worker.ID })
    const fresh = claims.filter(c => !verified.some(v => v.skill_ID === c.skill_ID))
    if (fresh.length) await INSERT.into(SkillClaims).entries(fresh.map(c => ({ ...c, worker_ID: worker.ID })))
    await refresh(worker)
    return { contract: 'SkillClaim[]', degraded }
  },

  // Scored on the server, so a worker cannot simply claim a pass. A wrong answer costs nothing.
  async assessment_submitted(worker, { module, answer }) {
    const m = await SELECT.one.from(db().LearningModules).where({ ID: module })
    if (!m?.answerKey) fail(400, `Module ${module} has no practice task`)
    // answerKey lists accepted answers separated by |, one per language.
    const passed = m.answerKey.toLowerCase().split('|').includes(String(answer).trim().toLowerCase())
    if (passed) await addEvidence(worker, m.skill_ID, 'assessment', m.proficiency, { name: 'Frontline Shift assessment' }, { type: 'assessment' })
    return { contract: 'EvidenceItem', passed }
  },

  async verification_requested(worker, { skill }) {
    const { Skills, SkillClaims, VerificationRequests } = db()
    if (!(await SELECT.one.from(Skills).where({ ID: skill }))) fail(400, `Unknown skill ${skill}`)
    const claim = await SELECT.one.from(SkillClaims).where({ worker_ID: worker.ID, skill_ID: skill })
    if (claim?.status === 'verified') fail(409, 'This skill is already verified')
    const open = await SELECT.one.from(VerificationRequests).where({ worker_ID: worker.ID, skill_ID: skill, status: 'pending' })
    if (!open) await INSERT.into(VerificationRequests).entries({ worker_ID: worker.ID, skill_ID: skill, status: 'pending' })
    return { contract: 'VerificationRequest' }
  },

  // The manager's yes needs proof, and their no needs a reason. Only the service can send this event.
  async verification_decided(worker, { request, approved, proofType, proofRef, proficiency, note, staff }) {
    const { VerificationRequests } = db()
    const open = await SELECT.one.from(VerificationRequests).where({ ID: request, worker_ID: worker.ID, status: 'pending' })
    if (!open) fail(404, 'This request is not open')
    const decided = { decidedByName: staff.name, decidedAt: new Date().toISOString() }
    if (approved) {
      if (!PROOF_TYPES.includes(proofType)) fail(400, `Proof must be one of ${PROOF_TYPES.join(', ')}`)
      if (!proofRef?.trim() || proofRef.length > 100) fail(400, 'A proof reference of up to 100 characters is required')
      if (!Number.isInteger(proficiency) || proficiency < 1 || proficiency > 3) fail(400, 'Proficiency must be 1, 2 or 3')
      await addEvidence(worker, open.skill_ID, 'manager_verification', proficiency, staff, { type: proofType, ref: proofRef })
      await UPDATE(VerificationRequests, request).with({ ...decided, status: 'verified', proofType, proofRef })
    } else {
      if (!note?.trim() || note.length > 500) fail(400, 'A reason of up to 500 characters is required')
      await UPDATE(VerificationRequests, request).with({ ...decided, status: 'not_yet', note })
    }
    return { contract: 'VerificationRequest' }
  },

  async application_submitted(worker, { vacancy, skills }) {
    const { Vacancies, SkillCredentials, ShareLinks, Applications } = db()
    if (!worker.outsideOptIn) fail(409, 'Turn on outside jobs first')
    const job = await SELECT.one.from(Vacancies).where({ ID: vacancy, isExternal: true })
    if (!job) fail(404, 'This job is not open to outside applicants')
    if (await SELECT.one.from(Applications).where({ worker_ID: worker.ID, vacancy_ID: vacancy })) fail(409, 'You have already applied for this job')
    const shared = [...new Set(skills ?? [])]
    const held = await SELECT.from(SkillCredentials).where({ worker_ID: worker.ID, skill_ID: { in: shared } })
    if (!shared.length || held.length !== shared.length) fail(400, 'Only verified skills can be sent with an application')
    const token = newToken()
    await INSERT.into(ShareLinks).entries({ worker_ID: worker.ID, token, skills: JSON.stringify(shared) })
    await INSERT.into(Applications).entries({ worker_ID: worker.ID, vacancy_ID: vacancy, token, status: 'applied' })
    return { contract: 'Application' }
  },

  async application_answered(worker, { application, status, message }) {
    if (!['interview', 'closed'].includes(status)) fail(400, `Unknown status ${status}`)
    if (message?.length > 500) fail(400, 'Message must be 500 characters or fewer')
    await UPDATE(db().Applications, application).with({ status, message })
    return { contract: 'Application' }
  },

  // Finishing a lesson unlocks practice. It never verifies a skill by itself.
  async module_completed(worker, { module }) {
    const { LearningPlans } = db()
    const plan = await SELECT.one.from(LearningPlans).where({ worker_ID: worker.ID })
    if (!plan) fail(409, 'No learning plan yet')
    if (!(await SELECT.one.from(db().LearningModules).where({ ID: module }))) fail(400, `Unknown module ${module}`)
    const completed = new Set(JSON.parse(plan.completed ?? '[]')).add(module)
    await UPDATE(LearningPlans, plan.ID).with({ completed: JSON.stringify([...completed]) })
    return { contract: 'LearningPlan' }
  },

  async outside_opt_in(worker, { optIn }) {
    await UPDATE(db().Workers, worker.ID).with({ outsideOptIn: Boolean(optIn) })
    await refresh({ ...worker, outsideOptIn: Boolean(optIn) })
    return { contract: 'RoleMatch' }
  },

  async review_requested() {
    return { contract: 'ReviewPacket' }
  },

  async manager_decided(worker, { outcome, reasons }, actor) {
    if (!['shortlist', 'request_evidence', 'not_yet'].includes(outcome)) fail(400, `Unknown outcome ${outcome}`)
    if (outcome !== 'shortlist' && !reasons?.trim()) fail(400, 'A reason is required for this decision')
    if (reasons?.length > 1000) fail(400, 'Reason must be 1000 characters or fewer')
    await INSERT.into(db().ReviewDecisions).entries({ worker_ID: worker.ID, outcome, reasons, decidedBy: actor })
    return { contract: 'ReviewDecision', stage: outcome === 'shortlist' ? 'SHORTLISTED' : 'ACTIVE' }
  }
}

async function handle(workerId, type, payload = {}, actor) {
  const { Workers, AuditEvents } = db()
  const worker = await SELECT.one.from(Workers).where({ ID: workerId })
  if (!worker) fail(404, 'Worker not found')

  const planned = nextStage(worker.stage, type)
  const { stage = planned, contract, degraded = false, ...result } = await HANDLERS[type](worker, payload, actor)

  await UPDATE(Workers, workerId).with({ stage })
  // The trail records the role, not the login, so it holds no personal content.
  await INSERT.into(AuditEvents).entries({ worker_ID: workerId, company_ID: worker.company_ID, type, stage, actor: ACTOR_ROLE(type), contract, degraded })
  return { stage, contract, degraded, ...result }
}

// Demo only: puts a worker back on the first screen.
async function resetWorker(workerId) {
  await eraseWorkerData(workerId)
  await DELETE.from(db().ConsentRecords).where({ worker_ID: workerId })
  await UPDATE(db().Workers, workerId).with({ stage: 'NOT_STARTED', outsideOptIn: false })
}

module.exports = { handle, nextStage, resetWorker, WORKER_EVENTS, TRANSITIONS }
