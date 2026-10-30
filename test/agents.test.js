const { test } = require('node:test')
const assert = require('node:assert')
const match = require('../srv/agents/match')
const audit = require('../srv/agents/audit')
const pathway = require('../srv/agents/pathway')
const verify = require('../srv/agents/verify')
const discover = require('../srv/agents/discover')
const { nextStage, WORKER_EVENTS } = require('../srv/orchestrator')

const ROLE = [
  { skill_ID: 'CYCLE', weight: 36, requiredLevel: 2 },
  { skill_ID: 'STOCK', weight: 32, requiredLevel: 2 },
  { skill_ID: 'DISPATCH', weight: 12, requiredLevel: 2 },
  { skill_ID: 'TRANS', weight: 12, requiredLevel: 2 },
  { skill_ID: 'REPORT', weight: 8, requiredLevel: 2 }
]
const verified = (skill_ID, proficiency = 2) => ({ skill_ID, status: 'verified', proficiency })

test('match: Ravi scores 68 with two verified skills', () => {
  const r = match(ROLE, [verified('CYCLE'), verified('STOCK'), { skill_ID: 'DISPATCH', status: 'self_reported' }])
  assert.equal(r.score, 68)
  assert.deepEqual(r.strengths, ['CYCLE', 'STOCK'])
  assert.equal(r.gaps.length, 3)
  assert.equal(r.ruleTrace.length, 5)
})

test('match: verified below the required level earns half credit', () => {
  assert.equal(match(ROLE, [verified('CYCLE', 1)]).score, 18)
})

test('match: unverified skills never change the score', () => {
  const none = match(ROLE, []).score
  const unverified = match(ROLE, ROLE.map(r => ({ skill_ID: r.skill_ID, status: 'self_reported' }))).score
  assert.equal(none, 0)
  assert.equal(unverified, none)
})

test('match: a gap with no claim says needs_evidence, never missing', () => {
  assert.ok(match(ROLE, []).gaps.every(g => g.status === 'needs_evidence'))
})

test('match: a role with no requirements does not divide by zero', () => {
  assert.equal(match([], []).score, 0)
})

test('audit: flags a large gap and ignores groups that are too small', () => {
  const row = (lang, employmentType, score) => ({ lang, employmentType, score })
  const rows = [
    row('hi', 'permanent', 70), row('hi', 'permanent', 70), row('hi', 'contract', 50),
    row('en', 'permanent', 72), row('en', 'contract', 50), row('en', 'contract', 50),
    row('ta', 'other', 10)   // one worker: too small to compare
  ]
  const [lang, employment] = audit(rows)
  assert.equal(lang.gap, 6)
  assert.equal(lang.flagged, false)
  assert.equal(employment.gap, 21)
  assert.equal(employment.flagged, true)
})

test('pathway: biggest gap comes first', () => {
  const modules = [{ ID: 'M-REPORT', skill_ID: 'REPORT' }, { ID: 'M-TRANS', skill_ID: 'TRANS' }]
  const gaps = [{ skill: 'REPORT', weight: 8 }, { skill: 'TRANS', weight: 12 }]
  assert.deepEqual(pathway(gaps, modules), ['M-TRANS', 'M-REPORT'])
})

test('verify: the offline fallback can never produce a verified skill', async () => {
  const skills = [{ ID: 'CYCLE', name: 'Cycle counting', keywords: 'recount,cycle count' }]
  const { claims, degraded } = await verify([{ task: 'I recount the bin', example: '' }], skills)
  assert.equal(degraded, true)
  assert.deepEqual(claims.map(c => [c.skill_ID, c.status]), [['CYCLE', 'self_reported']])
})

test('discover: long answers are clipped to fit the database', async () => {
  const { tasks, degraded } = await discover('x'.repeat(4000))
  assert.equal(degraded, true)
  assert.equal(tasks[0].task.length, 500)
})

test('orchestrator: invalid events are rejected with 409', () => {
  assert.equal(nextStage('NOT_STARTED', 'consent_granted'), 'DISCOVERING')
  assert.throws(() => nextStage('NOT_STARTED', 'review_requested'), e => e.status === 409)
  assert.throws(() => nextStage('ACTIVE', 'manager_decided'), e => e.status === 409)
})

test('orchestrator: consent can be revoked from any stage', () => {
  for (const stage of ['DISCOVERING', 'ACTIVE', 'AWAITING_MANAGER']) assert.equal(nextStage(stage, 'consent_revoked'), 'HALTED')
})

test('orchestrator: workers cannot send decisions or attestations', () => {
  assert.equal(WORKER_EVENTS.has('manager_decided'), false)
  assert.equal(WORKER_EVENTS.has('evidence_added'), false)
})
