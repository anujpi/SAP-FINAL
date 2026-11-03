const { test } = require('node:test')
const assert = require('node:assert')
const { ewmSupport, parseExtract, HEADER } = require('../srv/lib/ewm')

const ID = '00000000-0000-4000-8000-000000000001'

test('EWM totals add up per skill and ignore unknown task types', () => {
  const support = ewmSupport([
    { taskType: 'PHYSICAL_INVENTORY', confirmedTasks: 8, workDate: '2026-10-05' },
    { taskType: 'PHYSICAL_INVENTORY', confirmedTasks: 7, workDate: '2026-10-09' },
    { taskType: 'SOMETHING_ELSE', confirmedTasks: 99, workDate: '2026-10-09' }
  ])
  assert.deepStrictEqual(support, { 'CYCLE-COUNT': { tasks: 15, days: 2, lastDate: '2026-10-09' } })
})

test('an extract by EWM user code loads, and the old format still works', () => {
  assert.deepStrictEqual(parseExtract('ewmUser,workDate,taskType,confirmedTasks\nblr1-op001,2026-11-02,PICK,12'), [{ ewmUser: 'BLR1-OP001', workDate: '2026-11-02', taskType: 'PICK', confirmedTasks: 12 }])
  assert.throws(() => parseExtract('ewmUser,workDate,taskType,confirmedTasks\nnot a code!,2026-11-02,PICK,12'), /Line 2: ewmUser/)
})

test('a good extract loads', () => {
  const rows = parseExtract(`workerId,workDate,taskType,confirmedTasks\r\n${ID},2026-11-02,PICK,12\n`)
  assert.deepStrictEqual(rows, [{ worker_ID: ID, workDate: '2026-11-02', taskType: 'PICK', confirmedTasks: 12 }])
})

test('a bad extract is rejected, naming the line', () => {
  assert.throws(() => parseExtract('a,b\n1,2'), /first line/)
  assert.throws(() => parseExtract(HEADER), /no records/)
  const OLD = 'workerId,workDate,taskType,confirmedTasks'
  assert.throws(() => parseExtract(`${OLD}\nnot-a-worker,2026-11-02,PICK,12`), /Line 2: workerId/)
  assert.throws(() => parseExtract(`${OLD}\n${ID},02/11/2026,PICK,12`), /Line 2: workDate/)
  assert.throws(() => parseExtract(`${OLD}\n${ID},2026-11-02,GUESS,12`), /Line 2: unknown taskType/)
  assert.throws(() => parseExtract(`${OLD}\n${ID},2026-11-02,PICK,1.5`), /Line 2: confirmedTasks/)
})

test('a candidate reference is different per company and hides the worker', () => {
  const { anonRef } = require('../srv/lib/credential')
  const a = anonRef(ID, 'MERIDIAN')
  assert.match(a, /^[0-9A-F]{6}$/)
  assert.notStrictEqual(a, anonRef(ID, 'CAUVERY'))
  assert.strictEqual(a, anonRef(ID, 'MERIDIAN'))
})

test('work records: back up what was said, find what was not said, and never verify anything', () => {
  const { applyWorkRecords } = require('../srv/lib/ewm')
  const said = (skill_ID, status = 'self_reported') => ({ skill_ID, status, confidence: 0.7, source: 'interview', basis: 'x' })
  const support = {
    'CYCLE-COUNT': { tasks: 46, days: 6, lastDate: '2026-10-28' },
    'GOODS-RCPT': { tasks: 34, days: 4, lastDate: '2026-10-29' },
    PICKING: { tasks: 3, days: 1, lastDate: '2026-10-07' }
  }
  const out = applyWorkRecords([said('CYCLE-COUNT'), said('DISPATCH'), said('SAFETY'), said('PICKING')], support)
  const of = id => out.find(c => c.skill_ID === id)
  assert.strictEqual(of('CYCLE-COUNT').status, 'work_records')
  assert.strictEqual(of('DISPATCH').status, 'needs_evidence')     // EWM would show this, and it doesn't
  assert.strictEqual(of('SAFETY').status, 'self_reported')        // EWM can't see this, so it stays as said
  assert.strictEqual(of('PICKING').status, 'needs_evidence')      // too little to count
  assert.strictEqual(of('GOODS-RCPT').status, 'work_records')     // never mentioned, but the records show it
  assert.strictEqual(of('GOODS-RCPT').source, 'work_records')
  assert.ok(!out.some(c => c.status === 'verified'))
})

test('work records: with no records at all, what they said stays as it is', () => {
  const { applyWorkRecords } = require('../srv/lib/ewm')
  const claims = [{ skill_ID: 'DISPATCH', status: 'self_reported', confidence: 0.7 }]
  assert.deepStrictEqual(applyWorkRecords(claims, {}), claims)
  assert.deepStrictEqual(applyWorkRecords(claims), claims)
})

test('masking: Hindi skips only person masking, because it mistakes Hindi words for names', () => {
  const { maskedEntities } = require('../srv/lib/llm')
  assert.ok(maskedEntities('I recount the bin').includes('profile-person'))
  const hindi = maskedEntities('मैं ट्रक से माल उतारता हूँ')
  assert.ok(!hindi.includes('profile-person'))
  for (const kept of ['profile-email', 'profile-phone', 'profile-nationalid']) assert.ok(hindi.includes(kept))
})
