const { test } = require('node:test')
const assert = require('node:assert')
const sapContext = require('../srv/lib/sap-context')

const input = over => ({
  worker: { ID: 'w1', site: 'Bengaluru Hub', employmentType: 'permanent', targetRole_ID: 'R1' },
  vacancies: [
    { ID: 'REQ-1', role_ID: 'R1', site: 'Bengaluru Hub', isExternal: false },
    { ID: 'REQ-2', role_ID: 'R2', site: 'Bengaluru Hub', isExternal: false },
    { ID: 'EXT-1', role_ID: 'R1', site: 'Hosur', isExternal: true }
  ],
  roleTitles: { R1: 'Coordinator' },
  claims: [
    { skill_ID: 'A', status: 'verified', proficiency: 2, source: 'assessment' },
    { skill_ID: 'B', status: 'self_reported' }
  ],
  skillNames: { A: 'Skill A', B: 'Skill B' },
  ewmRecords: [],
  ...over
})

test('never shows outside jobs or other roles', () => {
  assert.deepStrictEqual(sapContext(input()).requisitions.map(r => r.jobReqId), ['REQ-1'])
})

test('only proven skills are prepared for write-back, and nothing is sent', () => {
  const { writeBack } = sapContext(input())
  assert.strictEqual(writeBack.sent, false)
  assert.deepStrictEqual(writeBack.skills.map(s => s.skillId), ['A'])
})

test('a not yet decision never leaves, a shortlist does', () => {
  assert.strictEqual(sapContext(input({ decision: { outcome: 'not_yet' } })).writeBack.jobApplication, null)
  assert.strictEqual(sapContext(input({ decision: { outcome: 'shortlist' } })).writeBack.jobApplication.jobReqId, 'REQ-1')
})
