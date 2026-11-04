// The daily EWM extract: which warehouse task types count as doing which skill, and how to read the upload.
const TASK_SKILL = {
  PHYSICAL_INVENTORY: 'CYCLE-COUNT',
  DIFFERENCE_POSTING: 'STOCK-DISC',
  GOODS_ISSUE: 'DISPATCH',
  STOCK_TRANSFER: 'INV-TRANS',
  PICK: 'PICKING',
  GOODS_RECEIPT: 'GOODS-RCPT',
  PUTAWAY: 'PUTAWAY',
  PACK: 'PACKING',
  RETURNS: 'RETURNS'
}

// How much work counts as "the records show this". A single day could be someone covering a shift.
const MIN_TASKS = 5
const MIN_DAYS = 2
const shownByRecords = s => Boolean(s) && s.tasks >= MIN_TASKS && s.days >= MIN_DAYS

/**
 * Checks what the worker said against what EWM shows. Plain code, with no AI. It can never verify a skill:
 * only a manager can do that, so nothing here changes a score.
 * With no records at all, for example before a site is connected, it leaves what they said as it is.
 */
function applyWorkRecords(claims, support = {}) {
  if (!Object.keys(support).length) return claims
  const trackable = new Set(Object.values(TASK_SKILL))
  const checked = claims.map(c => {
    if (shownByRecords(support[c.skill_ID])) return { ...c, status: 'work_records', confidence: Math.max(c.confidence, 0.9) }
    // EWM would have recorded this work, and it doesn't show it yet. Skills EWM can't see, like safety, stay as they were said.
    if (trackable.has(c.skill_ID)) return { ...c, status: 'needs_evidence' }
    return c
  })
  const said = new Set(claims.map(c => c.skill_ID))
  const found = Object.entries(support)
    .filter(([skill_ID, s]) => !said.has(skill_ID) && shownByRecords(s))
    .map(([skill_ID]) => ({ skill_ID, confidence: 0.9, source: 'work_records', proficiency: null, status: 'work_records', basis: '' }))
  return [...checked, ...found]
}

// EWM knows people by their EWM user code. The older file with our own worker ID still loads.
const HEADER = 'ewmUser,workDate,taskType,confirmedTasks'
const OLD_HEADER = 'workerId,workDate,taskType,confirmedTasks'
const EWM_USER = /^[A-Z0-9-]{3,20}$/i
const MAX_ROWS = 2000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Totals per skill: { 'CYCLE-COUNT': { tasks, days, lastDate } }. Support for a claim only, it never adds to the score. */
function ewmSupport(records) {
  const support = {}
  for (const r of records) {
    const skill = TASK_SKILL[r.taskType]
    if (!skill) continue
    const s = (support[skill] ??= { tasks: 0, days: 0, lastDate: '' })
    s.tasks += r.confirmedTasks
    s.days += 1
    if (r.workDate > s.lastDate) s.lastDate = r.workDate
  }
  return support
}

/** Reads one uploaded extract and rejects the whole file on the first bad line, so a partial day never loads. */
function parseExtract(csv) {
  const lines = String(csv ?? '').trim().split(/\r?\n/)
  const header = lines[0]?.trim()
  if (header !== HEADER && header !== OLD_HEADER) throw new Error(`The first line must be ${HEADER}`)
  const byUser = header === HEADER
  const rows = lines.slice(1)
  if (!rows.length) throw new Error('The file has no records')
  if (rows.length > MAX_ROWS) throw new Error(`A file can hold at most ${MAX_ROWS} records`)
  return rows.map((line, i) => {
    const [who, workDate, taskType, count] = line.split(',').map(x => x.trim())
    const confirmedTasks = Number(count)
    const where = `Line ${i + 2}:`
    if (byUser ? !EWM_USER.test(who ?? '') : !UUID.test(who ?? '')) throw new Error(`${where} ${byUser ? 'ewmUser' : 'workerId'} is not valid`)
    if (!DATE.test(workDate ?? '') || Number.isNaN(Date.parse(workDate))) throw new Error(`${where} workDate must look like 2026-11-02`)
    if (!TASK_SKILL[taskType]) throw new Error(`${where} unknown taskType. Use ${Object.keys(TASK_SKILL).join(', ')}`)
    if (!Number.isInteger(confirmedTasks) || confirmedTasks < 0 || confirmedTasks > 10000) throw new Error(`${where} confirmedTasks must be a whole number from 0 to 10000`)
    return { ...(byUser ? { ewmUser: who.toUpperCase() } : { worker_ID: who }), workDate, taskType, confirmedTasks }
  })
}

// A worker who moved company keeps their old employer's EWM records out of the new employer's view.
// The day of the move is the last day at the old company, so only later days count.
const sinceJoining = (records, joinedOn) => records.filter(r => r.workDate > (joinedOn(r.worker_ID) ?? ''))

module.exports = { sinceJoining, ewmSupport, applyWorkRecords, parseExtract, TASK_SKILL, HEADER, MIN_TASKS, MIN_DAYS }
