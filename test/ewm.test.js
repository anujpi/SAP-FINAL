const { test } = require('node:test')
const assert = require('node:assert')
const { ewmSupport, parseExtract, HEADER } = require('../srv/lib/ewm')
const { staffLogin, personaOf } = require('../srv/lib/demo-worker')

const ID = '00000000-0000-4000-8000-000000000001'

test('EWM totals add up per skill and ignore unknown task types', () => {
  const support = ewmSupport([
    { taskType: 'PHYSICAL_INVENTORY', confirmedTasks: 8, workDate: '2026-10-05' },
    { taskType: 'PHYSICAL_INVENTORY', confirmedTasks: 7, workDate: '2026-10-09' },
    { taskType: 'SOMETHING_ELSE', confirmedTasks: 99, workDate: '2026-10-09' }
  ])
  assert.deepStrictEqual(support, { 'CYCLE-COUNT': { tasks: 15, days: 2, lastDate: '2026-10-09' } })
})

test('a good extract loads', () => {
  const rows = parseExtract(`${HEADER}\r\n${ID},2026-11-02,PICK,12\n`)
  assert.deepStrictEqual(rows, [{ worker_ID: ID, workDate: '2026-11-02', taskType: 'PICK', confirmedTasks: 12 }])
})

test('a bad extract is rejected, naming the line', () => {
  assert.throws(() => parseExtract('a,b\n1,2'), /first line/)
  assert.throws(() => parseExtract(HEADER), /no records/)
  assert.throws(() => parseExtract(`${HEADER}\nnot-a-worker,2026-11-02,PICK,12`), /Line 2: workerId/)
  assert.throws(() => parseExtract(`${HEADER}\n${ID},02/11/2026,PICK,12`), /Line 2: workDate/)
  assert.throws(() => parseExtract(`${HEADER}\n${ID},2026-11-02,GUESS,12`), /Line 2: unknown taskType/)
  assert.throws(() => parseExtract(`${HEADER}\n${ID},2026-11-02,PICK,1.5`), /Line 2: confirmedTasks/)
})

test('staff logins: the map wins, demo mode falls back to Meera, local logins stay themselves', () => {
  assert.strictEqual(staffLogin('a@example.com', { DEMO_STAFF_MAP: '{"a@example.com":"arjun"}', DEMO_WORKER_ID: 'x' }), 'arjun')
  assert.strictEqual(staffLogin('b@example.com', { DEMO_WORKER_ID: 'x' }), 'meera')
  assert.strictEqual(staffLogin('sunil', {}), 'sunil')
})

test('View as: only a manager login in demo mode can switch, and only to known people', () => {
  const user = (...roles) => ({ is: role => roles.includes(role) })
  const manager = user('Manager')
  assert.strictEqual(personaOf(manager, 'arjun', 'demo-id'), 'arjun')
  assert.strictEqual(staffLogin('someone', { DEMO_WORKER_ID: 'x' }, 'arjun'), 'arjun')
  // Nothing is remembered: the next request with no header is back to the login's own view.
  assert.strictEqual(personaOf(manager, undefined, 'demo-id'), undefined)

  assert.strictEqual(personaOf(user('Worker'), 'arjun', 'demo-id'), undefined)
  assert.strictEqual(personaOf(manager, 'arjun', ''), undefined)
  assert.strictEqual(personaOf(manager, 'constructor', 'demo-id'), undefined)
})

test('a candidate reference is different per company and hides the worker', () => {
  const { anonRef } = require('../srv/lib/credential')
  const a = anonRef(ID, 'MERIDIAN')
  assert.match(a, /^[0-9A-F]{6}$/)
  assert.notStrictEqual(a, anonRef(ID, 'CAUVERY'))
  assert.strictEqual(a, anonRef(ID, 'MERIDIAN'))
})
