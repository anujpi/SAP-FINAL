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

  for (const skill of ['CYCLE-COUNT', 'STOCK-DISC'])
    parsed(await call('/manager/attest', { user: 'meera', body: { worker: RAVI, skill, proficiency: 2 } }))
  const [m] = parsed(await call('/worker/MyMatches', { user: 'ravi' }))
  assert.equal(m.score, 68)
  step('supervisor attested 2 skills, Agent C scores 68')

  const plan = parsed(await call('/worker/MyPlan', { user: 'ravi' }))[0]
  assert.ok(JSON.parse(plan.modules).includes('M-TRANS'))
  step('Agent D built the pathway')

  const modules = parsed(await call('/worker/LearningModules', { user: 'ravi' }))
  assert.ok(modules.every(x => !('answerKey' in x)))
  step('answer keys stay hidden from workers')

  assert.equal(parsed(await send('assessment_submitted', { module: 'M-TRANS', answer: 'goods issue' })).passed, false)
  assert.equal(parsed(await send('assessment_submitted', { module: 'M-TRANS', answer: 'Stock Transfer' })).passed, true)
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
  step('a supervisor can attest but cannot decide')

  parsed(await send('review_requested'))
  const packet = parsed(await call(`/manager/reviewPacket(worker=${RAVI})`, { user: 'meera' }))
  assert.equal(packet.verified.length, 3)
  step('Agent E built the review packet')

  assert.equal((await call('/manager/decide', { user: 'meera', body: { worker: RAVI, outcome: 'not_yet' } })).status, 400)
  parsed(await call('/manager/decide', { user: 'meera', body: { worker: RAVI, outcome: 'not_yet', reasons: 'Two skills still need evidence' } }))
  step('"Not yet" needs a reason, and the manager recorded one')

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
  assert.ok(trail.length >= 9)   // the 9 accepted events above, plus any from earlier runs
  step(`audit trail has ${trail.length} hand-offs`)

  parsed(await send('consent_revoked'))
  assert.equal(parsed(await call('/worker/MySkills', { user: 'ravi' })).length, 0)
  step('consent revoked, Ravi\'s data erased')

  console.log('\nJourney passed.')
})().catch(e => {
  console.error('\nJourney failed:', e.message)
  process.exit(1)
})
