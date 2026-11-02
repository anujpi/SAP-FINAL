const cds = require('@sap/cds')
const { handle, resetWorker } = require('./orchestrator')
const review = require('./agents/review')
const audit = require('./agents/audit')
const askJson = require('./lib/llm')
const sapContext = require('./lib/sap-context')
const { ewmSupport, parseExtract } = require('./lib/ewm')
const { checkShare } = require('./lib/credential')
const { staffLogin } = require('./lib/demo-worker')

// A worker's interest in outside jobs is private: managers never see those matches, and they stay out of the audit.
async function internalMatches(where) {
  const { RoleMatches, Vacancies } = cds.entities('frontline')
  const internal = new Set((await SELECT.from(Vacancies).where({ isExternal: false })).map(v => v.ID))
  const matches = await (where ? SELECT.from(RoleMatches).where(where) : SELECT.from(RoleMatches))
  return matches.filter(m => internal.has(m.vacancy_ID))
}

// Who is asking, and for which company. Every read and action below is limited to that company.
async function staffOf(req) {
  const { Staff } = cds.entities('frontline')
  const staff = await SELECT.one.from(Staff).where({ login: staffLogin(req.user.id) })
  return staff ?? req.reject(403, "This login isn't linked to a company. An admin needs to add it.")
}

async function ownWorker(req, worker_ID) {
  const { Workers } = cds.entities('frontline')
  const staff = await staffOf(req)
  const worker = await SELECT.one.from(Workers).where({ ID: worker_ID })
  if (!worker) return req.reject(404, 'Worker not found')
  if (worker.company_ID !== staff.company_ID) return req.reject(403, 'This worker is not in your company')
  return { worker, staff }
}

const groupBy = (rows, key) => {
  const groups = new Map()
  for (const row of rows) groups.set(row[key], [...(groups.get(row[key]) ?? []), row])
  return groups
}

module.exports = cds.service.impl(function () {
  this.before('READ', ['ReviewQueue', 'Team', 'AuditEvents'], async req => {
    const { company_ID } = await staffOf(req)
    req.query.where({ company_ID })
  })

  this.on('teamSkills', async req => {
    const { Workers, SkillClaims, VerificationRequests, EwmTaskRecords } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const workers = await SELECT.from(Workers).where({ company_ID }).orderBy('name')
    const worker_ID = { in: workers.map(w => w.ID) }
    const claims = groupBy(await SELECT.from(SkillClaims).where({ worker_ID }), 'worker_ID')
    const pending = groupBy(await SELECT.from(VerificationRequests).where({ worker_ID, status: 'pending' }), 'worker_ID')
    const records = groupBy(await SELECT.from(EwmTaskRecords).where({ worker_ID }), 'worker_ID')
    return JSON.stringify(workers.map(w => ({
      ID: w.ID,
      name: w.name,
      site: w.site,
      stage: w.stage,
      skills: claims.get(w.ID) ?? [],
      pending: (pending.get(w.ID) ?? []).map(r => r.skill_ID),
      ewm: ewmSupport(records.get(w.ID) ?? [])
    })))
  })

  this.on('verificationRequests', async req => {
    const { Workers, VerificationRequests, EwmTaskRecords } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const workers = new Map((await SELECT.from(Workers).where({ company_ID })).map(w => [w.ID, w]))
    if (!workers.size) return '[]'
    const worker_ID = { in: [...workers.keys()] }
    const requests = await SELECT.from(VerificationRequests).where({ worker_ID, status: 'pending' }).orderBy('createdAt')
    const records = groupBy(await SELECT.from(EwmTaskRecords).where({ worker_ID }), 'worker_ID')
    return JSON.stringify(requests.map(r => ({
      ID: r.ID,
      worker_ID: r.worker_ID,
      workerName: workers.get(r.worker_ID).name,
      site: workers.get(r.worker_ID).site,
      skill_ID: r.skill_ID,
      requestedAt: r.createdAt,
      ewm: ewmSupport(records.get(r.worker_ID) ?? [])[r.skill_ID] ?? null
    })))
  })

  this.on('decideVerification', async req => {
    const { VerificationRequests } = cds.entities('frontline')
    const { request, approved, proofType, proofRef, proficiency, note } = req.data
    const open = await SELECT.one.from(VerificationRequests).where({ ID: request })
    if (!open) return req.reject(404, 'Request not found')
    const { staff } = await ownWorker(req, open.worker_ID)
    return JSON.stringify(await handle(open.worker_ID, 'verification_decided', { request, approved, proofType, proofRef, proficiency, note, staff }, req.user.id))
  })

  this.on('importEwmExtract', async req => {
    const { Workers, EwmTaskRecords, AuditEvents } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    if (String(req.data.csv ?? '').length > 200_000) return req.reject(400, 'The file is too large')
    let rows
    try {
      rows = parseExtract(req.data.csv)
    } catch (e) {
      return req.reject(400, e.message)
    }
    const own = new Set((await SELECT.from(Workers).columns('ID').where({ company_ID })).map(w => w.ID))
    const outsider = rows.find(r => !own.has(r.worker_ID))
    if (outsider) return req.reject(403, `Worker ${outsider.worker_ID} is not in your company`)
    // Loading the same day again replaces it, so a corrected file never double counts.
    for (const { worker_ID, workDate, taskType } of rows) await DELETE.from(EwmTaskRecords).where({ worker_ID, workDate, taskType })
    await INSERT.into(EwmTaskRecords).entries(rows.map(r => ({ ...r, warehouse: 'BLR1', importedBy: 'daily-upload' })))
    await INSERT.into(AuditEvents).entries({ company_ID, type: 'ewm_imported', stage: 'n/a', actor: 'supervisor', contract: 'EwmTaskRecord[]' })
    return JSON.stringify({ loaded: rows.length })
  })

  this.on('ewmRecent', async req => {
    const { Workers, EwmTaskRecords } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const workers = new Map((await SELECT.from(Workers).where({ company_ID })).map(w => [w.ID, w.name]))
    const records = await SELECT.from(EwmTaskRecords).where({ worker_ID: { in: [...workers.keys()] } }).orderBy('workDate desc').limit(25)
    return JSON.stringify(records.map(r => ({ ...r, workerName: workers.get(r.worker_ID) })))
  })

  this.on('findTalent', async req => {
    const { SuccessFactorsSkills } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    return JSON.stringify(await SELECT.from(SuccessFactorsSkills).where({ company_ID, skill_ID: req.data.skill }).orderBy('proficiency desc', 'userName'))
  })

  this.on('applicants', async req => {
    const { Applications, Vacancies, Workers, Roles } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const vacancies = await SELECT.from(Vacancies).where({ company_ID, isExternal: true })
    if (!vacancies.length) return '[]'
    const roles = new Map((await SELECT.from(Roles)).map(r => [r.ID, r.title]))
    const applications = await SELECT.from(Applications).where({ vacancy_ID: { in: vacancies.map(v => v.ID) } }).orderBy('createdAt desc')
    return JSON.stringify(await Promise.all(applications.map(async a => {
      const vacancy = vacancies.find(v => v.ID === a.vacancy_ID)
      const worker = await SELECT.one.from(Workers).columns('name').where({ ID: a.worker_ID })
      return {
        ID: a.ID, status: a.status, message: a.message, appliedAt: a.createdAt,
        applicant: worker?.name, role: roles.get(vacancy.role_ID), site: vacancy.site,
        certificates: await checkShare(a.token)
      }
    })))
  })

  this.on('answerApplication', async req => {
    const { Applications, Vacancies } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const { application, status, message } = req.data
    const found = await SELECT.one.from(Applications).where({ ID: application })
    const vacancy = found && await SELECT.one.from(Vacancies).where({ ID: found.vacancy_ID })
    if (!vacancy) return req.reject(404, 'Application not found')
    if (vacancy.company_ID !== company_ID) return req.reject(403, 'This application is not for your company')
    return JSON.stringify(await handle(found.worker_ID, 'application_answered', { application, status, message }, req.user.id))
  })

  this.on('reviewPacket', async req => {
    const { SkillClaims, EvidenceItems, LearningPlans } = cds.entities('frontline')
    const worker_ID = req.data.worker
    const { worker } = await ownWorker(req, worker_ID)
    return JSON.stringify(review({
      worker,
      claims: await SELECT.from(SkillClaims).where({ worker_ID }),
      evidence: await SELECT.from(EvidenceItems).where({ worker_ID }),
      matches: await internalMatches({ worker_ID }),
      plan: await SELECT.one.from(LearningPlans).where({ worker_ID })
    }))
  })

  this.on('sapContext', async req => {
    const { Vacancies, Roles, SkillClaims, Skills, ReviewDecisions, EwmTaskRecords } = cds.entities('frontline')
    const worker_ID = req.data.worker
    const { worker } = await ownWorker(req, worker_ID)
    const titles = await SELECT.from(Roles)
    const names = await SELECT.from(Skills)
    return JSON.stringify(sapContext({
      worker,
      vacancies: await SELECT.from(Vacancies),
      roleTitles: Object.fromEntries(titles.map(r => [r.ID, r.title])),
      claims: await SELECT.from(SkillClaims).where({ worker_ID }),
      skillNames: Object.fromEntries(names.map(s => [s.ID, s.name])),
      decision: await SELECT.one.from(ReviewDecisions).where({ worker_ID }).orderBy('createdAt desc'),
      ewmRecords: await SELECT.from(EwmTaskRecords).where({ worker_ID }).orderBy('workDate desc').limit(5),
      aiRoute: askJson.provider()
    }))
  })

  this.on('decide', async req => {
    const { worker, outcome, reasons } = req.data
    await ownWorker(req, worker)
    return JSON.stringify(await handle(worker, 'manager_decided', { outcome, reasons }, req.user.id))
  })

  this.on('fairnessReport', async req => {
    const { Workers, ReviewDecisions } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const workers = new Map((await SELECT.from(Workers).where({ company_ID })).map(w => [w.ID, w]))
    const decisions = new Map((await SELECT.from(ReviewDecisions)).map(d => [d.worker_ID, d.outcome]))
    const rows = (await internalMatches())
      .filter(m => workers.has(m.worker_ID))
      .map(m => ({ ...workers.get(m.worker_ID), score: m.score, outcome: decisions.get(m.worker_ID) }))
    return JSON.stringify(audit(rows))
  })

  this.on('resetDemo', async req => {
    await ownWorker(req, req.data.worker)
    await resetWorker(req.data.worker)
    return true
  })
})
