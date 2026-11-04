// The only code that runs agents, changes a worker's stage or writes the audit trail.
const cds = require('@sap/cds')
const discover = require('./agents/discover')
const verify = require('./agents/verify')
const match = require('./agents/match')
const pathway = require('./agents/pathway')
const { randomBytes } = require('node:crypto')
const { sign, newToken } = require('./lib/credential')
const { ewmSupport, sinceJoining, MIN_TASKS, MIN_DAYS } = require('./lib/ewm')

const PROOF_TYPES = ['ewm_records', 'observed_on_shift', 'training_record', 'video']
// ponytail: clips sit in HANA as data URLs; move them to an object store if they grow past a few MB each.
const CLIP_MAX = 11_500_000 // characters of base64, about 8 MB of video

// These can happen at any point once a profile exists, and none of them move the journey on.
const stayIn = stage => Object.fromEntries(
  ['verification_requested', 'verification_decided', 'outside_opt_in', 'application_submitted', 'application_answered', 'hire_interest_sent', 'hire_interest_answered',
    'offer_answered', 'released_early', 'transfer_done', 'input_submitted', 'readback_confirmed', 'recording_cancelled'].map(type => [type, stage])
)

const TRANSITIONS = {
  NOT_STARTED: { consent_granted: 'DISCOVERING' },
  HALTED: { consent_granted: 'DISCOVERING' },
  DISCOVERING: { input_submitted: 'AWAITING_READBACK' },
  AWAITING_READBACK: { input_submitted: 'AWAITING_READBACK', readback_confirmed: 'ACTIVE', recording_cancelled: 'DISCOVERING' },
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
  'verification_requested', 'application_submitted', 'hire_interest_answered', 'offer_answered', 'recording_cancelled'
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
const today = () => new Date().toISOString().slice(0, 10)
const addDays = days => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

// The worker's notice is over: they become an employee of the company that hired them.
// Signed certificates go with them, and their skills move to the new SuccessFactors. The old company's internal
// records (requests, "not yet" notes, review decisions, proof clips) stay behind, so the new employer never sees them.
async function joinNewCompany(worker, application) {
  const { Vacancies, Roles, Staff, Workers, Applications, VerificationRequests, HireInterests, SuccessFactorsSkills, ReviewDecisions, ProofClips, EvidenceItems } = db()
  const job = await SELECT.one.from(Vacancies).where({ ID: application.vacancy_ID })
  const role = await SELECT.one.from(Roles).where({ ID: job.role_ID })
  const manager = (await SELECT.from(Staff).where({ company_ID: job.company_ID })).find(s => s.roles.split(',').includes('Manager'))
  const moved = {
    company_ID: job.company_ID, formerCompany_ID: worker.company_ID, site: job.site, jobTitle: role?.title, targetRole_ID: job.role_ID,
    managerName: manager?.name ?? null, department: null, joinedOn: today(), outsideOptIn: false, ewmUser: null
  }
  await UPDATE(Workers, worker.ID).with(moved)
  await UPDATE(Applications, application.ID).with({ status: 'joined' })
  await UPDATE(Applications).set({ status: 'closed' }).where({ worker_ID: worker.ID, status: { in: ['applied', 'interview', 'offered'] } })
  for (const e of [VerificationRequests, ReviewDecisions, ProofClips, EvidenceItems]) await DELETE.from(e).where({ worker_ID: worker.ID })
  await UPDATE(HireInterests).set({ status: 'declined', decidedAt: new Date().toISOString() }).where({ worker_ID: worker.ID, status: 'pending' })
  await UPDATE(SuccessFactorsSkills).set({ company_ID: job.company_ID }).where({ worker_ID: worker.ID })
  // "Seen in work records" came from the old employer's EWM. At the new one it needs fresh evidence.
  await UPDATE(db().SkillClaims).set({ status: 'needs_evidence' }).where({ worker_ID: worker.ID, status: 'work_records' })
  await refresh({ ...worker, ...moved })
  return { contract: 'Application', stage: 'ACTIVE' }
}

// Moves everyone whose notice has ended. Runs when anyone loads the app, so no scheduler is needed.
async function dueTransfers() {
  const due = await SELECT.from(db().Applications).where({ status: 'accepted', leavesOn: { '<=': today() } })
  for (const a of due) await handle(a.worker_ID, 'transfer_done', { application: a.ID })
}

// Re-run matching and the learning plan after anything that changes evidence.
async function refresh(worker) {
  const { SkillClaims, Vacancies, RoleSkills, RoleMatches, LearningModules, LearningPlans } = db()
  const claims = await SELECT.from(SkillClaims).where({ worker_ID: worker.ID })
  const vacancies = await SELECT.from(Vacancies)
  const inScope = vacancies.filter(v => v.isExternal ? worker.outsideOptIn && v.company_ID !== worker.company_ID : v.company_ID === worker.company_ID)

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
  for (const e of [d.TaskExperiences, d.SkillClaims, d.EvidenceItems, d.RoleMatches, d.LearningPlans, d.SkillCredentials, d.ShareLinks, d.ReviewDecisions, d.VerificationRequests, d.Applications, d.SuccessFactorsSkills, d.HireInterests, d.ProofClips])
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
    const { TaskExperiences, AuditEvents } = db()
    // ponytail: a fixed daily cap per worker keeps AI costs bounded; make it a company setting if 20 proves too low.
    // A full timestamp: HANA rejects a bare date for a TIMESTAMP column.
    const today = new Date(new Date().toISOString().slice(0, 10)).toISOString()
    const recorded = await SELECT.one.from(AuditEvents).columns('count(1) as n').where({ worker_ID: worker.ID, type: 'input_submitted', occurredAt: { '>=': today } })
    if (recorded?.n >= 20) fail(429, "That's 20 recordings today. Please try again tomorrow.")
    const { tasks, degraded } = await discover(text)
    // Only the recording in progress is replaced. Confirmed work from earlier recordings stays.
    await DELETE.from(TaskExperiences).where({ worker_ID: worker.ID, confirmed: false })
    await INSERT.into(TaskExperiences).entries(tasks.map(t => ({ ...t, worker_ID: worker.ID, confirmed: false })))
    return { contract: 'TaskExperience[]', degraded, tasks }
  },

  async readback_confirmed(worker) {
    const { TaskExperiences, Skills, SkillClaims } = db()
    const tasks = await SELECT.from(TaskExperiences).where({ worker_ID: worker.ID, confirmed: false })
    if (!tasks.length) fail(409, 'There is nothing new to confirm')
    // HANA holds what this person actually did, so the skills get checked against it.
    const records = await SELECT.from(db().EwmTaskRecords).where({ worker_ID: worker.ID })
    const { claims, unmatched, degraded } = await verify(tasks, await SELECT.from(Skills), ewmSupport(records))
    await UPDATE(TaskExperiences).set({ confirmed: true }).where({ worker_ID: worker.ID, confirmed: false })
    // Add to what they already have. A verified skill is never touched, and a skill they already had is updated.
    const existing = new Map((await SELECT.from(SkillClaims).where({ worker_ID: worker.ID })).map(c => [c.skill_ID, c]))
    const found = []
    for (const c of claims) {
      const had = existing.get(c.skill_ID)
      if (had?.status === 'verified') continue
      // A skill only the records show, which they already had, isn't news.
      if (had && c.source === 'work_records') continue
      if (had) await DELETE.from(SkillClaims).where({ ID: had.ID })
      await INSERT.into(SkillClaims).entries({ ...c, worker_ID: worker.ID })
      found.push({ skill_ID: c.skill_ID, status: c.status, source: c.source, basis: c.basis ?? '', isNew: !had })
    }
    await refresh(worker)
    return { contract: 'SkillClaim[]', degraded, found, unmatched }
  },

  async recording_cancelled(worker) {
    await DELETE.from(db().TaskExperiences).where({ worker_ID: worker.ID, confirmed: false })
    return { contract: 'TaskExperience[]' }
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
  async verification_decided(worker, { request, approved, proofType, proofRef, proficiency, note, clip, staff }) {
    const { VerificationRequests } = db()
    const open = await SELECT.one.from(VerificationRequests).where({ ID: request, worker_ID: worker.ID, status: 'pending' })
    if (!open) fail(404, 'This request is not open')
    const decided = { decidedByName: staff.name, decidedAt: new Date().toISOString() }
    if (approved) {
      if (!PROOF_TYPES.includes(proofType)) fail(400, `Proof must be one of ${PROOF_TYPES.join(', ')}`)
      if (!proofRef?.trim() || proofRef.length > 100) fail(400, 'A proof reference of up to 100 characters is required')
      if (!Number.isInteger(proficiency) || proficiency < 1 || proficiency > 3) fail(400, 'Proficiency must be 1, 2 or 3')
      if (proofType === 'ewm_records') {
        const shown = ewmSupport(sinceJoining(await SELECT.from(db().EwmTaskRecords).where({ worker_ID: worker.ID }), () => worker.joinedOn))[open.skill_ID]
        if (!shown || shown.tasks < MIN_TASKS || shown.days < MIN_DAYS) fail(400, `EWM doesn't show enough of this work yet (${MIN_TASKS} tasks over ${MIN_DAYS} days). Choose another proof, or wait for more records.`)
      }
      const mimeType = proofType === 'video' && /^data:(video\/[\w.+-]+);base64,/.exec(clip ?? '')?.[1]
      if (proofType === 'video') {
        if (!mimeType) fail(400, 'Attach a short video clip as proof')
        if (clip.length > CLIP_MAX) fail(400, 'The clip is too large. Keep it under 8 MB.')
        await INSERT.into(db().ProofClips).entries({ worker_ID: worker.ID, request_ID: request, mimeType, clip })
      }
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
    if (!job || job.company_ID === worker.company_ID) fail(404, 'This job is not open to outside applicants')
    if (await SELECT.one.from(Applications).where({ worker_ID: worker.ID, vacancy_ID: vacancy })) fail(409, 'You have already applied for this job')
    const shared = [...new Set(skills ?? [])]
    const held = await SELECT.from(SkillCredentials).where({ worker_ID: worker.ID, skill_ID: { in: shared } })
    if (!shared.length || held.length !== shared.length) fail(400, 'Only verified skills can be sent with an application')
    const token = newToken()
    await INSERT.into(ShareLinks).entries({ worker_ID: worker.ID, token, skills: JSON.stringify(shared) })
    await INSERT.into(Applications).entries({ worker_ID: worker.ID, vacancy_ID: vacancy, token, status: 'applied' })
    return { contract: 'Application' }
  },

  async application_answered(worker, { application, status, message, noticeDays }) {
    if (!['interview', 'offered', 'closed'].includes(status)) fail(400, `Unknown status ${status}`)
    if (message?.length > 500) fail(400, 'Message must be 500 characters or fewer')
    const found = await SELECT.one.from(db().Applications).where({ ID: application })
    if (['accepted', 'joined', 'declined'].includes(found?.status)) fail(409, 'This person has already answered your offer')
    if (status === 'offered' && !(Number.isInteger(noticeDays) && noticeDays >= 0 && noticeDays <= 90)) fail(400, 'Notice period must be 0 to 90 days')
    await UPDATE(db().Applications, application).with({ status, message, noticeDays: status === 'offered' ? noticeDays : null })
    return { contract: 'Application' }
  },

  // The worker accepts or declines a job offer. Accepting starts the notice period at their current employer.
  async offer_answered(worker, { application, accept }) {
    const { Applications } = db()
    const offer = await SELECT.one.from(Applications).where({ ID: application, worker_ID: worker.ID, status: 'offered' })
    if (!offer) fail(404, 'This offer is not open')
    if (!accept) {
      await UPDATE(Applications, offer.ID).with({ status: 'declined' })
      return { contract: 'Application' }
    }
    if (await SELECT.one.from(Applications).where({ worker_ID: worker.ID, status: 'accepted' })) fail(409, 'You have already accepted another offer')
    await UPDATE(Applications, offer.ID).with({ status: 'accepted', leavesOn: addDays(offer.noticeDays ?? 0) })
    return { contract: 'Application' }
  },

  // The current employer lets the worker go before the notice period ends.
  async released_early(worker) {
    const leaving = await SELECT.one.from(db().Applications).where({ worker_ID: worker.ID, status: 'accepted' })
    if (!leaving) fail(409, 'This employee is not serving notice')
    await UPDATE(db().Applications, leaving.ID).with({ leavesOn: today() })
    return joinNewCompany(worker, leaving)
  },

  async transfer_done(worker, { application }) {
    const leaving = await SELECT.one.from(db().Applications).where({ ID: application, worker_ID: worker.ID, status: 'accepted' })
    if (!leaving) fail(409, 'No accepted offer to complete')
    return joinNewCompany(worker, leaving)
  },

  // A company asks to connect. Only the service can send this, after checking the role is its own.
  async hire_interest_sent(worker, { vacancy, company_ID, message }) {
    const { HireInterests } = db()
    if (!worker.outsideOptIn) fail(409, 'This person is no longer open to other companies')
    if (message?.length > 500) fail(400, 'Message must be 500 characters or fewer')
    if (await SELECT.one.from(HireInterests).where({ worker_ID: worker.ID, vacancy_ID: vacancy })) fail(409, 'You have already asked this person about this role')
    await INSERT.into(HireInterests).entries({ worker_ID: worker.ID, vacancy_ID: vacancy, company_ID, status: 'pending', message })
    return { contract: 'HireInterest' }
  },

  // The worker's permission. A yes shares only the certificates they picked, with only this company.
  async hire_interest_answered(worker, { interest, grant, skills }) {
    const { HireInterests, SkillCredentials, ShareLinks, Applications, ConsentRecords } = db()
    const open = await SELECT.one.from(HireInterests).where({ ID: interest, worker_ID: worker.ID, status: 'pending' })
    if (!open) fail(404, 'This request is not open')
    const decidedAt = new Date().toISOString()
    if (!grant) {
      await UPDATE(HireInterests, interest).with({ status: 'declined', decidedAt })
      return { contract: 'HireInterest' }
    }
    const shared = [...new Set(skills ?? [])]
    const held = await SELECT.from(SkillCredentials).where({ worker_ID: worker.ID, skill_ID: { in: shared } })
    if (!shared.length || held.length !== shared.length) fail(400, 'Only verified skills can be shared')
    const token = newToken()
    await INSERT.into(ShareLinks).entries({ worker_ID: worker.ID, token, skills: JSON.stringify(shared) })
    await INSERT.into(Applications).entries({ worker_ID: worker.ID, vacancy_ID: open.vacancy_ID, token, status: 'applied' })
    await INSERT.into(ConsentRecords).entries({ worker_ID: worker.ID, purpose: `share_with_${open.company_ID}`, granted: true })
    await UPDATE(HireInterests, interest).with({ status: 'granted', decidedAt })
    return { contract: 'HireInterest' }
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
    const company = await SELECT.one.from(db().Companies).where({ ID: worker.company_ID })
    if (optIn && !company?.marketplace) fail(409, 'Your company has not joined the job marketplace')
    await UPDATE(db().Workers, worker.ID).with({ outsideOptIn: Boolean(optIn) })
    await refresh({ ...worker, outsideOptIn: Boolean(optIn) })
    return { contract: 'RoleMatch' }
  },

  async review_requested() {
    return { contract: 'ReviewPacket' }
  },

  async manager_decided(worker, { outcome, reasons }, actor) {
    if (!['move_to_role', 'shortlist', 'request_evidence', 'not_yet'].includes(outcome)) fail(400, `Unknown outcome ${outcome}`)
    const positive = outcome === 'move_to_role' || outcome === 'shortlist'
    if (!positive && !reasons?.trim()) fail(400, 'A reason is required for this decision')
    if (reasons?.length > 1000) fail(400, 'Reason must be 1000 characters or fewer')
    await INSERT.into(db().ReviewDecisions).entries({ worker_ID: worker.ID, outcome, reasons, decidedBy: actor })
    // Moving someone into the role updates their job record, as an EmpJob change would in SuccessFactors.
    if (outcome === 'move_to_role') {
      const role = await SELECT.one.from(db().Roles).where({ ID: worker.targetRole_ID })
      if (role) await UPDATE(db().Workers, worker.ID).with({ jobTitle: role.title })
    }
    return { contract: 'ReviewDecision', stage: positive ? 'SHORTLISTED' : 'ACTIVE' }
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
  const { ConsentRecords, Workers, HireInterests, Vacancies, RoleMatches } = db()
  await eraseWorkerData(workerId)
  await DELETE.from(ConsentRecords).where({ worker_ID: workerId })
  // ponytail: only Ravi is ever reset, so his seed job record is restored here after a promotion or a move to another company.
  await UPDATE(Workers, workerId).with({
    stage: 'NOT_STARTED', outsideOptIn: false, jobTitle: 'Warehouse Operator', company_ID: 'INDIGO', formerCompany_ID: null, site: 'Bengaluru Hub',
    targetRole_ID: 'DSC-COORD', managerName: 'Meera S.', department: 'Inbound and Inventory', joinedOn: '2023-06-12', ewmUser: 'BLR1-OP001'
  })
  // Also clear what companies did in the demo, so a new run starts clean.
  await DELETE.from(HireInterests)
  // Uploaded EWM days go too, but only at this worker's own company.
  const { company_ID } = await SELECT.one.from(Workers).columns('company_ID').where({ ID: workerId })
  const colleagues = (await SELECT.from(Workers).columns('ID').where({ company_ID })).map(w => w.ID)
  await DELETE.from(db().EwmTaskRecords).where({ importedBy: 'daily-upload', worker_ID: { in: colleagues } })
  const posted = (await SELECT.from(Vacancies).columns('ID').where({ source: 'posted' })).map(v => v.ID)
  if (posted.length) {
    await DELETE.from(RoleMatches).where({ vacancy_ID: { in: posted } })
    await DELETE.from(Vacancies).where({ ID: { in: posted } })
  }
}

// A company posts a new role. Everyone open to other companies gets a match to it straight away.
async function postVacancy(company, role_ID, site) {
  const { Vacancies, Workers, Roles, RoleSkills, SkillClaims, RoleMatches, AuditEvents } = db()
  if (!(await SELECT.one.from(Roles).where({ ID: role_ID }))) fail(400, `Unknown role ${role_ID}`)
  if (!site?.trim() || site.length > 50) fail(400, 'A site of up to 50 characters is required')
  const ID = `EXT-${randomBytes(4).toString('hex').toUpperCase()}`
  await INSERT.into(Vacancies).entries({ ID, role_ID, site: site.trim(), isExternal: true, employer: company.name, source: 'posted', company_ID: company.ID, postedAt: new Date().toISOString() })
  const requirements = await SELECT.from(RoleSkills).where({ role_ID })
  for (const worker of await SELECT.from(Workers).where({ outsideOptIn: true, company_ID: { '!=': company.ID } })) {
    const result = match(requirements, await SELECT.from(SkillClaims).where({ worker_ID: worker.ID }))
    await INSERT.into(RoleMatches).entries({
      worker_ID: worker.ID, vacancy_ID: ID, score: result.score,
      strengths: JSON.stringify(result.strengths), gaps: JSON.stringify(result.gaps),
      eligibility: JSON.stringify({ eligible: true, reasons: ['Worker opted in to outside jobs'] }), ruleTrace: JSON.stringify(result.ruleTrace)
    })
  }
  await INSERT.into(AuditEvents).entries({ company_ID: company.ID, type: 'role_posted', stage: 'n/a', actor: 'manager', contract: 'Vacancy' })
  return ID
}

module.exports = { handle, nextStage, resetWorker, postVacancy, dueTransfers, WORKER_EVENTS, TRANSITIONS }
