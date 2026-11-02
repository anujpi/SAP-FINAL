// Runs Ravi's whole journey against a running server: npm run watch, then node scripts/journey.js
const assert = require('node:assert')

const BASE = process.env.BASE_URL ?? 'http://localhost:4004'
const RAVI = '00000000-0000-4000-8000-000000000001'
const basic = (user, pass = user) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')

async function call(path, { user, body } = {}) {
  const res = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(user && { Authorization: basic(user) }) },
    body: body && JSON.stringify(body)
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, value: json?.value ?? json }
}

const parsed = r => {
  assert.equal(r.status, 200, JSON.stringify(r.value))
  return typeof r.value === 'string' ? JSON.parse(r.value) : r.value
}
const send = (type, payload) => call('/worker/sendEvent', { user: 'ravi', body: { type, payload: payload && JSON.stringify(payload) } })
const step = name => console.log('ok  ', name)

;(async () => {
  parsed(await call('/manager/resetDemo', { user: 'meera', body: { worker: RAVI } }))

  assert.equal((await send('review_requested')).status, 409)
  step('an event in the wrong stage gets 409')

  assert.equal(parsed(await send('consent_granted')).stage, 'DISCOVERING')
  step('consent recorded')

  const heard = parsed(await send('input_submitted', { text: 'I recount the bin, check the pick list, then raise an adjustment for the discrepancy with my supervisor. I also help with dispatch.' }))
  assert.equal(heard.stage, 'AWAITING_READBACK')
  assert.ok(heard.tasks.length > 0)
  const route = (await call('/worker/aiStatus()', { user: 'ravi' })).value
  assert.ok(['generative-ai-hub', 'direct-anthropic', 'offline'].includes(route))
  step(`Agent A returned tasks (LLM route: ${route}, degraded: ${heard.degraded})`)

  parsed(await send('readback_confirmed'))
  const skills = parsed(await call('/worker/MySkills', { user: 'ravi' }))
  assert.ok(skills.length > 0 && skills.every(s => s.status !== 'verified'))
  step(`Agent B proposed ${skills.length} skills, none verified`)

  const ewm = parsed(await call('/worker/myEwmSupport()', { user: 'ravi' }))
  assert.equal(ewm['CYCLE-COUNT'].tasks, 46)
  step('EWM records back up what Ravi said')

  assert.equal((await send('verification_decided', { approved: true })).status, 403)
  for (const skill of ['CYCLE-COUNT', 'STOCK-DISC', 'DISPATCH']) parsed(await send('verification_requested', { skill }))
  const inbox = parsed(await call('/manager/verificationRequests()', { user: 'meera' }))
  assert.equal(inbox.length, 3)
  assert.equal(inbox.find(r => r.skill_ID === 'CYCLE-COUNT').ewm.tasks, 46)
  assert.deepEqual(parsed(await call('/manager/verificationRequests()', { user: 'arjun' })), [])
  step('requests reach Ravi\'s own manager, with EWM support, and no other company')

  const answer = (request, body, user = 'meera') => call('/manager/decideVerification', { user, body: { request, proofType: '', proofRef: '', proficiency: 0, note: '', ...body } })
  const requestFor = skill => inbox.find(r => r.skill_ID === skill).ID
  assert.equal((await answer(requestFor('CYCLE-COUNT'), { approved: true })).status, 400)
  assert.equal((await answer(requestFor('DISPATCH'), { approved: false })).status, 400)
  assert.equal((await answer(requestFor('CYCLE-COUNT'), { approved: true, proofType: 'ewm_records', proofRef: 'EWM-BLR1-2026-10', proficiency: 2 }, 'arjun')).status, 403)
  step('a yes needs proof, a no needs a reason, and another company cannot answer')

  for (const skill of ['CYCLE-COUNT', 'STOCK-DISC'])
    parsed(await answer(requestFor(skill), { approved: true, proofType: 'ewm_records', proofRef: 'EWM-BLR1-2026-10', proficiency: 2 }))
  parsed(await answer(requestFor('DISPATCH'), { approved: false, note: 'Show me on a shift first' }))
  const [m] = parsed(await call('/worker/MyMatches', { user: 'ravi' }))
  assert.equal(m.score, 68)
  step('manager verified 2 skills with proof, Agent C scores 68')

  const certificates = parsed(await call('/passport/MyCredentials', { user: 'ravi' }))
  assert.equal(certificates.length, 2)
  assert.ok(certificates.every(c => c.verifiedBy === 'Meera S.' && c.company === 'Indigo Hub Logistics' && !('signature' in c)))
  step('Ravi has certificates naming the manager and the company')

  const found = parsed(await call("/manager/findTalent(skill='CYCLE-COUNT')", { user: 'meera' }))
  assert.ok(found.some(f => f.userName === 'Ravi K.'))
  assert.ok(!parsed(await call("/manager/findTalent(skill='CYCLE-COUNT')", { user: 'arjun' })).some(f => f.userName === 'Ravi K.'))
  step('verified skills reach mock SuccessFactors, and HR can filter by skill')

  const today = new Date().toISOString().slice(0, 10)
  parsed(await call('/manager/importEwmExtract', { user: 'meera', body: { csv: `workerId,workDate,taskType,confirmedTasks\n${RAVI},${today},PICK,12` } }))
  assert.equal((await call('/manager/importEwmExtract', { user: 'meera', body: { csv: 'nonsense' } })).status, 400)
  assert.equal((await call('/manager/importEwmExtract', { user: 'arjun', body: { csv: `workerId,workDate,taskType,confirmedTasks\n${RAVI},${today},PICK,12` } })).status, 403)
  step('the daily EWM upload loads, rejects bad files, and is limited to your own company')

  const plan = parsed(await call('/worker/MyPlan', { user: 'ravi' }))[0]
  assert.ok(JSON.parse(plan.modules).includes('M-TRANS'))
  step('Agent D built the pathway')

  const modules = parsed(await call('/worker/LearningModules', { user: 'ravi' }))
  assert.ok(modules.every(x => !('answerKey' in x)))
  step('answer keys stay hidden from workers')

  assert.equal(parsed(await send('assessment_submitted', { module: 'M-TRANS', answer: 'goods issue' })).passed, false)
  assert.equal(parsed(await send('assessment_submitted', { module: 'M-TRANS', answer: 'स्टॉक ट्रांसफर' })).passed, true)
  const [after] = parsed(await call('/worker/MyMatches', { user: 'ravi' }))
  assert.equal(after.score, 80)
  step('practice task passed, score rises to 80')

  const signal = parsed(await call('/worker/marketSignal()', { user: 'ravi' }))
  assert.ok(signal.length > 0 && signal.every(s => s.source === 'sample'))
  step('Agent F reports demand from sample jobs')

  assert.equal((await send('manager_decided', { outcome: 'shortlist' })).status, 403)
  assert.equal((await call('/manager/reviewPacket(worker=' + RAVI + ')', { user: 'ravi' })).status, 403)
  step('a worker cannot decide or read the manager view')

  assert.equal((await call('/manager/decide', { user: 'sunil', body: { worker: RAVI, outcome: 'shortlist' } })).status, 403)
  step('a supervisor cannot decide on a job move')

  assert.equal((await send('application_submitted', { vacancy: 'EXT-2001', skills: ['CYCLE-COUNT'] })).status, 409)

  parsed(await send('outside_opt_in', { optIn: true }))
  assert.equal(parsed(await call('/worker/MyMatches', { user: 'ravi' })).length, 4)
  parsed(await send('review_requested'))
  const packet = parsed(await call(`/manager/reviewPacket(worker=${RAVI})`, { user: 'meera' }))
  assert.equal(packet.verified.length, 3)
  assert.deepEqual(packet.matches.map(x => x.vacancy_ID), ['REQ-1001'])
  step('Agent E built the review packet, without Ravi\'s outside job matches')

  assert.equal((await send('application_submitted', { vacancy: 'REQ-1001', skills: ['CYCLE-COUNT'] })).status, 404)
  assert.equal((await send('application_submitted', { vacancy: 'EXT-2001', skills: ['DISPATCH'] })).status, 400)
  parsed(await send('application_submitted', { vacancy: 'EXT-2001', skills: ['CYCLE-COUNT', 'STOCK-DISC'] }))
  const applicants = parsed(await call('/manager/applicants()', { user: 'arjun' }))
  assert.equal(applicants.length, 1)
  assert.equal(applicants[0].certificates.status, 'genuine')
  assert.equal(applicants[0].certificates.skills.length, 2)
  assert.deepEqual(parsed(await call('/manager/applicants()', { user: 'meera' })), [])
  const employerAudit = parsed(await call('/manager/AuditEvents', { user: 'meera' }))
  assert.ok(!employerAudit.some(a => ['outside_opt_in', 'application_submitted'].includes(a.type)))
  step('the other company sees genuine certificates, and Ravi\'s employer sees nothing')

  assert.equal((await call('/manager/answerApplication', { user: 'meera', body: { application: applicants[0].ID, status: 'interview', message: '' } })).status, 403)
  parsed(await call('/manager/answerApplication', { user: 'arjun', body: { application: applicants[0].ID, status: 'interview', message: 'Can you come in on Monday?' } }))
  const [application] = parsed(await call('/worker/MyApplications', { user: 'ravi' }))
  assert.equal(application.message, 'Can you come in on Monday?')
  step('the other company replied, and Ravi can read it')

  assert.equal((await call('/manager/decide', { user: 'meera', body: { worker: RAVI, outcome: 'not_yet' } })).status, 400)
  parsed(await call('/manager/decide', { user: 'meera', body: { worker: RAVI, outcome: 'not_yet', reasons: 'Two skills still need evidence' } }))
  step('"Not yet" needs a reason, and the manager recorded one')

  const [decision] = parsed(await call('/worker/MyDecisions', { user: 'ravi' }))
  assert.equal(decision.reasons, 'Two skills still need evidence')
  step('Ravi can read the reason')

  const ownTrail = parsed(await call('/worker/MyAuditEvents', { user: 'ravi' }))
  assert.ok(ownTrail.length > 0 && ownTrail.every(a => a.worker_ID === RAVI))
  assert.ok(ownTrail.every(a => ['worker', 'supervisor', 'manager'].includes(a.actor)), 'the trail must hold roles, not logins')
  assert.equal((await call('/manager/Team', { user: 'ravi' })).status, 403)
  step('Ravi sees only his own trail, and not the team')

  assert.equal((await call('/passport/createLink', { user: 'ravi', body: { skills: ['DISPATCH'] } })).status, 400)
  const link = await call('/passport/createLink', { user: 'ravi', body: { skills: ['CYCLE-COUNT', 'STOCK-DISC'] } })
  assert.equal(link.status, 200)
  const token = link.value
  step('only verified skills can be shared')

  const check = () => call(`/passport/check(token='${token}')`)
  const genuine = parsed(await check())
  assert.equal(genuine.status, 'genuine')
  assert.equal(genuine.skills.length, 2)
  assert.equal(parsed(await call("/passport/check(token='nope')")).status, 'unknown')
  step('public check works with no login, after a "Not yet"')

  parsed(await call('/passport/cancelLink', { user: 'ravi', body: { token } }))
  assert.equal(parsed(await check()).status, 'cancelled')
  step('Ravi cancelled the link')

  const report = parsed(await call('/manager/fairnessReport()', { user: 'meera' }))
  assert.equal(report.find(r => r.dimension === 'employmentType').flagged, true)
  step('Agent G flags the seeded contract-worker gap')

  const trail = parsed(await call('/manager/AuditEvents', { user: 'meera' })).filter(a => a.worker_ID === RAVI)
  assert.ok(trail.length >= 9)   // the accepted events above, minus the private ones, plus any from earlier runs
  step(`audit trail has ${trail.length} hand-offs`)

  parsed(await send('consent_revoked'))
  assert.equal(parsed(await call('/worker/MySkills', { user: 'ravi' })).length, 0)
  step('consent revoked, Ravi\'s data erased')

  console.log('\nJourney passed.')
})().catch(e => {
  console.error('\nJourney failed:', e.message)
  process.exit(1)
})
