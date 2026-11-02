// The daily EWM extract: which warehouse task types count as doing which skill, and how to read the upload.
const TASK_SKILL = {
  PHYSICAL_INVENTORY: 'CYCLE-COUNT',
  DIFFERENCE_POSTING: 'STOCK-DISC',
  GOODS_ISSUE: 'DISPATCH',
  STOCK_TRANSFER: 'INV-TRANS',
  PICK: 'PICKING'
}

const HEADER = 'workerId,workDate,taskType,confirmedTasks'
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
  if (lines[0]?.trim() !== HEADER) throw new Error(`The first line must be ${HEADER}`)
  const rows = lines.slice(1)
  if (!rows.length) throw new Error('The file has no records')
  if (rows.length > MAX_ROWS) throw new Error(`A file can hold at most ${MAX_ROWS} records`)
  return rows.map((line, i) => {
    const [worker_ID, workDate, taskType, count] = line.split(',').map(x => x.trim())
    const confirmedTasks = Number(count)
    const where = `Line ${i + 2}:`
    if (!UUID.test(worker_ID ?? '')) throw new Error(`${where} workerId is not valid`)
    if (!DATE.test(workDate ?? '') || Number.isNaN(Date.parse(workDate))) throw new Error(`${where} workDate must look like 2026-11-02`)
    if (!TASK_SKILL[taskType]) throw new Error(`${where} unknown taskType. Use ${Object.keys(TASK_SKILL).join(', ')}`)
    if (!Number.isInteger(confirmedTasks) || confirmedTasks < 0 || confirmedTasks > 10000) throw new Error(`${where} confirmedTasks must be a whole number from 0 to 10000`)
    return { worker_ID, workDate, taskType, confirmedTasks }
  })
}

module.exports = { ewmSupport, parseExtract, TASK_SKILL, HEADER }
