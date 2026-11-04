// Runs the judges' story from docs/JUDGES.md against a running server and stops at the first step that breaks.
// npm run watch, then node scripts/demo-check.js. Leaves Ravi reset, so the live run starts clean.
// UNTIL=13 stops after that step without a reset. READY=1 stops before outside hiring instead, with Ravi at 100% and open to other companies, to rehearse the screens.
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const BASE = process.env.BASE_URL ?? 'http://localhost:4004'
const RAVI = '00000000-0000-4000-8000-000000000001'
const basic = user => 'Basic ' + Buffer.from(`${user}:${user}`).toString('base64')
async function call(p, { user, body } = {}) {
  const res = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: basic(user) }, body: body && JSON.stringify(body) })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, value: json?.value ?? json }
}
const ok = r => {
  assert.equal(r.status, 200, JSON.stringify(r.value))
  return typeof r.value === 'string' ? JSON.parse(r.value) : r.value
}
const send = (type, payload) => call('/worker/sendEvent', { user: 'ravi', body: { type, payload: payload && JSON.stringify(payload) } })
const score = async vacancy => (ok(await call('/worker/MyMatches', { user: 'ravi' })).find(m => m.vacancy_ID === vacancy)?.score ?? 0)
const step = s => {
  console.log('ok  ', s)
  if (process.env.UNTIL && s.startsWith(`${process.env.UNTIL} `)) { console.log(`Stopped after step ${process.env.UNTIL}, without a reset.`); process.exit(0) }
}
const ROLE = ['CYCLE-COUNT', 'STOCK-DISC', 'DISPATCH', 'INV-TRANS', 'DIGI-REPORT']
const ANSWER = process.env.LANG_HI
  ? 'मैं हर हफ्ते बिन की गिनती करता हूँ और स्टॉक के फर्क को एडजस्टमेंट से ठीक करता हूँ। मैं डिस्पैच के लिए ट्रक लोड करता हूँ, स्कैनर पर सिस्टम एंट्री करता हूँ, और डैशबोर्ड पर रोज़ की स्टॉक रिपोर्ट अपडेट करता हूँ।'
  : 'I count the bins every week and fix any stock mismatch with an adjustment. I load the trucks for dispatch, enter goods movements on the scanner, and update the daily stock report on the dashboard.'

;(async () => {
  ok(await call('/manager/resetDemo', { user: 'meera', body: { worker: RAVI } }))
  assert.equal(ok(await call('/user/me()', { user: 'ravi' })).registered, true)
  step('1  reset done, Ravi is registered')

  ok(await send('consent_granted'))
  ok(await send('input_submitted', { text: ANSWER }))
  ok(await send('readback_confirmed'))
  const skills = ok(await call('/worker/MySkills', { user: 'ravi' }))
  const found = new Set(skills.map(s => s.skill_ID))
  const missing = ROLE.filter(s => !found.has(s))
  assert.deepEqual(missing, [], `AI missed role skills: ${missing}`)
  assert.equal(await score('REQ-1001'), 0)
  step(`2  AI found ${skills.length} skills incl. all 5 role skills, match 0%`)

  for (const skill of ROLE) ok(await send('verification_requested', { skill }))
  const queue = () => call('/manager/verificationRequests()', { user: 'meera' }).then(ok)
  assert.equal((await queue()).length, 5)
  step('3  Ravi asked for 5 verifications, Meera sees 5')

  const decide = async (skill, proofType, proofRef, clip) => {
    const r = (await queue()).find(q => q.skill_ID === skill)
    assert.ok(r, `no request for ${skill}`)
    return call('/manager/decideVerification', { user: 'meera', body: { request: r.ID, approved: true, proofType, proofRef, proficiency: 3, note: '', clip } })
  }
  for (const s of ['CYCLE-COUNT', 'STOCK-DISC', 'DISPATCH']) ok(await decide(s, 'ewm_records', 'EWM work records'))
  assert.equal(await score('REQ-1001'), 80)
  step('4  three EWM verifications, match 80%')

  const before = (await queue()).find(q => q.skill_ID === 'INV-TRANS')
  const csv = fs.readFileSync(path.join(__dirname, '../docs/ewm-extract-2026-11-03.csv'), 'utf8')
  const loaded = ok(await call('/manager/importEwmExtract', { user: 'meera', body: { csv } }))
  const after = (await queue()).find(q => q.skill_ID === 'INV-TRANS')
  assert.ok(after.ewm, `INV-TRANS has no EWM support after upload: ${JSON.stringify(after)}`)
  ok(await decide('INV-TRANS', 'ewm_records', 'EWM work records'))
  assert.equal(await score('REQ-1001'), 92)
  step(`5  CSV loaded (${JSON.stringify(loaded).slice(0, 80)}), INV-TRANS ewm before=${!!before.ewm} after=${JSON.stringify(after.ewm)}, match 92%`)

  assert.equal((await decide('DIGI-REPORT', 'video', 'Clip')).status, 400)
  ok(await decide('DIGI-REPORT', 'video', 'Clip of the stock report', 'data:video/mp4;base64,AAAAGGZ0eXBtcDQy'))
  assert.equal(await score('REQ-1001'), 100)
  step('6  video proof verified, match 100%')

  const creds = ok(await call('/passport/MyCredentials', { user: 'ravi' }))
  assert.equal(creds.length, 5)
  step('7  Ravi has 5 certificates')

  ok(await send('review_requested'))
  const packet = ok(await call(`/manager/reviewPacket(worker=${RAVI})`, { user: 'meera' }))
  assert.equal(packet.verified.length, 5)
  ok(await call('/manager/decide', { user: 'meera', body: { worker: RAVI, outcome: 'move_to_role' } }))
  const me = ok(await call('/worker/Me', { user: 'ravi' }))
  assert.equal((me[0] ?? me).jobTitle, 'Digital Supply Chain Coordinator')
  step('8  role review, Meera moved Ravi into Digital Supply Chain Coordinator')

  const profile = ok(await call(`/manager/employeeProfile(worker=${RAVI})`, { user: 'meera' }))
  const clipReq = profile.skills?.find(s => s.clipRequest)?.clipRequest
  assert.ok(clipReq, 'no clip on the employee profile')
  assert.ok((await call(`/manager/proofClip(request=${clipReq})`, { user: 'meera' })).value.startsWith('data:video'))
  const talent = ok(await call(`/manager/findTalent(skill='CYCLE-COUNT')`, { user: 'meera' }))
  assert.ok(talent.length >= 2)
  step(`9  clip plays from the profile, Find talent: ${talent.length} people with cycle counting`)

  // Outside hiring
  ok(await send('outside_opt_in', { optIn: true }))
  if (process.env.READY) return console.log('Stopped here: Ravi is 100% verified, in his new role, and open to other companies.')
  const roles = ok(await call('/manager/openRoles()', { user: 'arjun' }))
  const job = roles.find(r => r.ID === 'EXT-2002')
  assert.ok(job, 'Arjun has no EXT-2002')
  const people = ok(await call(`/manager/candidates(vacancy='EXT-2002')`, { user: 'arjun' }))
  assert.ok(!/Ravi|Indigo|Meera|Bengaluru|00000000-/.test(JSON.stringify(people)), 'candidates must be anonymous')
  const ravi = people.find(p => p.skills.length === 5)
  assert.ok(ravi, `Ravi not among candidates: ${JSON.stringify(people)}`)
  step(`10 Arjun: ${roles.length} open roles, ${people.length} anonymous candidates for EXT-2002, Ravi is ${ravi.ref} at ${ravi.score}%`)

  ok(await call('/manager/askToConnect', { user: 'arjun', body: { vacancy: 'EXT-2002', candidate: ravi.ref, message: 'We have a coordinator role in Chennai. Would you like to talk?' } }))
  const incoming = ok(await call('/worker/myHireRequests()', { user: 'ravi' })).requests
  assert.equal(incoming[0].company, 'Meridian Freight')
  assert.ok(ok(await call('/manager/outreach()', { user: 'arjun' }))[0].who.startsWith('Candidate '))
  step('11 Arjun asked to connect, Ravi sees it, Arjun still sees only a reference')

  ok(await send('hire_interest_answered', { interest: incoming[0].ID, grant: true, skills: ['CYCLE-COUNT', 'STOCK-DISC', 'INV-TRANS'] }))
  assert.equal(ok(await call('/manager/outreach()', { user: 'arjun' }))[0].who, 'Ravi K.')
  const app = ok(await call('/manager/applicants()', { user: 'arjun' }))[0]
  assert.equal(app.applicant, 'Ravi K.')
  assert.equal(app.certificates.status, 'genuine')
  assert.equal(app.certificates.skills.length, 3)
  assert.deepEqual(ok(await call('/manager/outreach()', { user: 'meera' })), [])
  step('12 Ravi said yes with 3 certificates: Arjun sees his name and 3 genuine certificates, Meera sees nothing')

  ok(await call('/manager/answerApplication', { user: 'arjun', body: { application: app.ID, status: 'interview', message: 'Can you come to Chennai on Monday at 10?' } }))
  const mine = ok(await call('/worker/MyApplications', { user: 'ravi' })).find(a => a.vacancy_ID === 'EXT-2002')
  assert.equal(mine.status, 'interview')
  step('13 Arjun invited him to interview, Ravi reads the message')

  const token = ok(await call('/worker/myHireRequests()', { user: 'ravi' })).access[0].token
  assert.equal(ok(await call(`/passport/check(token='${token}')`, { user: 'arjun' })).status, 'genuine')
  assert.ok(ok(await call('/manager/AuditEvents', { user: 'meera' })).length > 5)
  assert.ok(ok(await call('/manager/fairnessReport()', { user: 'meera' })))
  assert.ok(ok(await call('/user/dataSource()', { user: 'meera' })).counts.employees >= 24)
  step('14 public check says genuine; audit log, fairness audit and SAP landscape answer')

  // The offer, the notice period and the move
  assert.equal((await call('/manager/answerApplication', { user: 'arjun', body: { application: app.ID, status: 'offered', message: '', noticeDays: 120 } })).status, 400)
  ok(await call('/manager/answerApplication', { user: 'arjun', body: { application: app.ID, status: 'offered', message: 'We would like you to join us in Chennai.', noticeDays: 30 } }))
  const offer = ok(await call('/worker/myHireRequests()', { user: 'ravi' })).access.find(a => a.ID === app.ID)
  assert.equal(offer.status, 'offered')
  assert.equal(offer.noticeDays, 30)
  ok(await send('offer_answered', { application: app.ID, accept: true }))
  assert.equal((await send('offer_answered', { application: app.ID, accept: true })).status, 404)
  const leavers = ok(await call('/manager/leavers()', { user: 'meera' }))
  assert.equal(leavers[0].name, 'Ravi K.')
  assert.ok(!/Meridian|Chennai|EXT-/.test(JSON.stringify(leavers)), 'the employer must not learn where he is going')
  assert.ok(ok(await call(`/manager/employeeProfile(worker=${RAVI})`, { user: 'meera' })).leavesOn)
  assert.equal((ok(await call('/worker/Me', { user: 'ravi' }))[0]).company_ID, 'INDIGO')
  step(`15 Arjun offered the job with 30 days' notice, Ravi accepted: Meera sees "resigned, last day ${leavers[0].leavesOn}", not where he is going`)

  assert.equal((await call('/manager/releaseEarly', { user: 'arjun', body: { worker: RAVI } })).status, 403)
  ok(await call('/manager/releaseEarly', { user: 'meera', body: { worker: RAVI } }))
  const moved = ok(await call('/worker/Me', { user: 'ravi' }))[0]
  assert.deepEqual([moved.company_ID, moved.jobTitle, moved.site, moved.managerName], ['MERIDIAN', 'Digital Supply Chain Coordinator', 'Chennai', 'Arjun D.'])
  assert.equal(ok(await call('/user/me()', { user: 'ravi' })).company, 'Meridian Freight')
  assert.ok(ok(await call('/manager/Team', { user: 'arjun' })).some(w => w.ID === RAVI))
  assert.ok(!ok(await call('/manager/Team', { user: 'meera' })).some(w => w.ID === RAVI))
  assert.equal(ok(await call('/passport/MyCredentials', { user: 'ravi' })).length, 5)
  const atMeridian = ok(await call(`/manager/employeeProfile(worker=${RAVI})`, { user: 'arjun' }))
  assert.ok(!atMeridian.skills.some(s => s.clipRequest || s.requestNote), "Indigo's clips and notes stay at Indigo")
  assert.equal(atMeridian.ewmRecords.length, 0, "Indigo's EWM records stay at Indigo")
  assert.ok(ok(await call(`/manager/findTalent(skill='CYCLE-COUNT')`, { user: 'arjun' })).some(p => /Ravi/.test(JSON.stringify(p))))
  step('16 Meera released him early: Ravi is now at Meridian under Arjun, with his 5 certificates; Indigo\'s records stayed behind')

  ok(await call('/manager/resetDemo', { user: 'meera', body: { worker: RAVI } }))
  console.log('\nThe whole judges\' story works. Ravi is reset for the live run.')
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
