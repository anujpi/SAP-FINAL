const cds = require('@sap/cds')
const { handle, resetWorker, postVacancy } = require('./orchestrator')
const review = require('./agents/review')
const audit = require('./agents/audit')
const askJson = require('./lib/llm')
const sapContext = require('./lib/sap-context')
const { ewmSupport, parseExtract, sinceJoining } = require('./lib/ewm')
const { checkShare, anonRef } = require('./lib/credential')
const { forget, RAVI: DEMO_WORKER } = require('./lib/identity')

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
  const login = req.user.attr?.staffLogin
  const staff = login ? await SELECT.one.from(Staff).where({ login }) : null
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

  this.on('people', async req => {
    const { Workers, Staff, Companies } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const company = await SELECT.one.from(Companies).where({ ID: company_ID })
    return JSON.stringify({
      company: { name: company?.name, marketplace: Boolean(company?.marketplace) },
      staff: (await SELECT.from(Staff).where({ company_ID })).map(s => ({ name: s.name, email: s.email, title: s.title, roles: s.roles })),
      workers: (await SELECT.from(Workers).where({ company_ID, active: true }).orderBy('name')).map(w => ({ ID: w.ID, name: w.name, email: w.email, jobTitle: w.jobTitle, site: w.site, ewmUser: w.ewmUser }))
    })
  })

  this.on('registerPerson', async req => {
    const { Workers, Staff, AuditEvents } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const { name, email, kind, jobTitle, site, ewmUser } = req.data
    const mail = String(email ?? '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) || mail.length > 120) return req.reject(400, 'Enter a valid email address')
    if (!String(name ?? '').trim() || name.length > 100) return req.reject(400, 'Enter a name of up to 100 characters')
    if (!['Worker', 'Supervisor', 'Manager'].includes(kind)) return req.reject(400, 'Choose Worker, Supervisor or Manager')
    if (ewmUser && !/^[A-Z0-9-]{3,20}$/i.test(ewmUser)) return req.reject(400, 'The EWM user code can have 3 to 20 letters, numbers or dashes')
    const taken = (await SELECT.one.from(Workers).where({ email: mail, active: true })) || (await SELECT.one.from(Staff).where({ email: mail }))
    if (taken) return req.reject(409, 'Someone with this email is already registered')
    // One EWM user per person, or one person's warehouse records would back up another's skills.
    if (ewmUser && await SELECT.one.from(Workers).where({ ewmUser: ewmUser.toUpperCase(), company_ID, active: true })) return req.reject(409, 'This EWM user code already belongs to someone else')
    const removed = kind === 'Worker' && await SELECT.one.from(Workers).columns('ID').where({ email: mail, company_ID, active: false })
    if (removed) {
      await UPDATE(Workers, removed.ID).with({ active: true, name: name.trim(), ...(ewmUser && { ewmUser: ewmUser.toUpperCase() }) })
    } else if (kind === 'Worker') {
      await INSERT.into(Workers).entries({
        name: name.trim(), email: mail, company_ID, site: String(site ?? '').slice(0, 50), jobTitle: String(jobTitle ?? '').slice(0, 100),
        ewmUser: ewmUser ? ewmUser.toUpperCase() : null, stage: 'NOT_STARTED', active: true, employmentType: 'permanent', lang: 'en'
      })
    } else {
      await INSERT.into(Staff).entries({ login: mail, email: mail, name: name.trim(), title: String(jobTitle ?? kind).slice(0, 100), company_ID, roles: kind === 'Manager' ? 'Manager,Supervisor' : 'Supervisor' })
    }
    await INSERT.into(AuditEvents).entries({ company_ID, type: 'person_registered', stage: 'n/a', actor: 'hr', contract: kind })
    forget()
    return true
  })

  this.on('removePerson', async req => {
    const { Workers, Staff, AuditEvents } = cds.entities('frontline')
    const staffMe = await staffOf(req)
    const mail = String(req.data.email ?? '').trim().toLowerCase()
    if (mail && mail === String(staffMe.email ?? '').toLowerCase()) return req.reject(400, "You can't remove yourself")
    const changed = (await UPDATE(Workers).set({ active: false }).where({ email: mail, company_ID: staffMe.company_ID })) +
      (await DELETE.from(Staff).where({ email: mail, company_ID: staffMe.company_ID }))
    if (!changed) return req.reject(404, 'Nobody with this email is registered at your company')
    await INSERT.into(AuditEvents).entries({ company_ID: staffMe.company_ID, type: 'person_removed', stage: 'n/a', actor: 'hr', contract: 'Access' })
    forget()
    return true
  })

  this.on('setMarketplace', async req => {
    const { Companies, AuditEvents } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    await UPDATE(Companies, company_ID).with({ marketplace: Boolean(req.data.on) })
    await INSERT.into(AuditEvents).entries({ company_ID, type: 'marketplace_changed', stage: 'n/a', actor: 'hr', contract: req.data.on ? 'On' : 'Off' })
    return Boolean(req.data.on)
  })

  this.on('teamSkills', async req => {
    const { Workers, SkillClaims, VerificationRequests, EwmTaskRecords } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const workers = await SELECT.from(Workers).where({ company_ID, active: true }).orderBy('name')
    const worker_ID = { in: workers.map(w => w.ID) }
    const claims = groupBy(await SELECT.from(SkillClaims).where({ worker_ID }), 'worker_ID')
    const pending = groupBy(await SELECT.from(VerificationRequests).where({ worker_ID, status: 'pending' }), 'worker_ID')
    const joined = new Map(workers.map(w => [w.ID, w.joinedOn]))
    const records = groupBy(sinceJoining(await SELECT.from(EwmTaskRecords).where({ worker_ID }), id => joined.get(id)), 'worker_ID')
    return JSON.stringify(workers.map(w => ({
      ID: w.ID,
      name: w.name,
      site: w.site,
      jobTitle: w.jobTitle,
      stage: w.stage,
      skills: claims.get(w.ID) ?? [],
      pending: (pending.get(w.ID) ?? []).map(r => r.skill_ID),
      ewm: ewmSupport(records.get(w.ID) ?? [])
    })))
  })

  this.on('employeeProfile', async req => {
    const { SkillClaims, SuccessFactorsSkills, EvidenceItems, VerificationRequests, EwmTaskRecords, TaskExperiences, Companies, Roles, OtherCertificates } = cds.entities('frontline')
    const worker_ID = req.data.worker
    const { worker } = await ownWorker(req, worker_ID)
    const company = await SELECT.one.from(Companies).where({ ID: worker.company_ID })
    const role = await SELECT.one.from(Roles).where({ ID: worker.targetRole_ID })
    const synced = await SELECT.from(SuccessFactorsSkills).where({ worker_ID })
    const evidence = await SELECT.from(EvidenceItems).where({ worker_ID }).orderBy('createdAt desc')
    const requests = await SELECT.from(VerificationRequests).where({ worker_ID }).orderBy('createdAt desc')
    const records = sinceJoining(await SELECT.from(EwmTaskRecords).where({ worker_ID }).orderBy('workDate desc'), () => worker.joinedOn)
    const support = ewmSupport(records)
    const scores = (await internalMatches({ worker_ID })).map(m => m.score)
    return JSON.stringify({
      worker: {
        ID: worker.ID, name: worker.name, site: worker.site, stage: worker.stage, employmentType: worker.employmentType,
        employeeCode: worker.employeeCode, jobTitle: worker.jobTitle, department: worker.department,
        workShift: worker.workShift, managerName: worker.managerName, joinedOn: worker.joinedOn, company: company?.name
      },
      targetRole: role?.title,
      bestScore: scores.length ? Math.max(...scores) : null,
      skills: (await SELECT.from(SkillClaims).where({ worker_ID })).map(c => {
        const proof = evidence.find(e => e.skill_ID === c.skill_ID)
        const sf = synced.find(s => s.skill_ID === c.skill_ID)
        const request = requests.find(r => r.skill_ID === c.skill_ID)
        return {
          skill_ID: c.skill_ID, status: c.status, proficiency: c.proficiency, ewm: support[c.skill_ID] ?? null,
          verifiedBy: sf?.verifiedBy, verifiedOn: sf?.syncedAt, proofType: proof?.proofType, proofRef: proof?.proofRef,
          request: request?.status, requestNote: request?.note,
          clipRequest: request?.status === 'verified' && request.proofType === 'video' ? request.ID : undefined
        }
      }),
      tasks: (await SELECT.from(TaskExperiences).where({ worker_ID, confirmed: true })).map(t => ({ ID: t.ID, task: t.task, tool: t.tool, frequency: t.frequency })),
      otherCertificates: await SELECT.from(OtherCertificates).where({ worker_ID }).orderBy('issuedOn desc'),
      ewmRecords: records.slice(0, 8).map(r => ({ ID: r.ID, workDate: r.workDate, taskType: r.taskType, confirmedTasks: r.confirmedTasks })),
      leavesOn: (await SELECT.one.from(cds.entities('frontline').Applications).where({ worker_ID, status: 'accepted' }))?.leavesOn ?? null
    })
  })

  this.on('verificationRequests', async req => {
    const { Workers, VerificationRequests, EwmTaskRecords, SkillClaims } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const workers = new Map((await SELECT.from(Workers).where({ company_ID })).map(w => [w.ID, w]))
    if (!workers.size) return '[]'
    const worker_ID = { in: [...workers.keys()] }
    const requests = await SELECT.from(VerificationRequests).where({ worker_ID, status: 'pending' }).orderBy('createdAt')
    const records = groupBy(sinceJoining(await SELECT.from(EwmTaskRecords).where({ worker_ID }), id => workers.get(id)?.joinedOn), 'worker_ID')
    const said = new Map((await SELECT.from(SkillClaims).where({ worker_ID })).map(c => [`${c.worker_ID}|${c.skill_ID}`, c.basis]))
    return JSON.stringify(requests.map(r => ({
      ID: r.ID,
      worker_ID: r.worker_ID,
      workerName: workers.get(r.worker_ID).name,
      site: workers.get(r.worker_ID).site,
      skill_ID: r.skill_ID,
      requestedAt: r.createdAt,
      ewm: ewmSupport(records.get(r.worker_ID) ?? [])[r.skill_ID] ?? null,
      said: said.get(`${r.worker_ID}|${r.skill_ID}`) ?? ''
    })))
  })

  this.on('decideVerification', async req => {
    const { VerificationRequests } = cds.entities('frontline')
    const { request, approved, proofType, proofRef, proficiency, note, clip } = req.data
    const open = await SELECT.one.from(VerificationRequests).where({ ID: request })
    if (!open) return req.reject(404, 'Request not found')
    const { staff } = await ownWorker(req, open.worker_ID)
    if (req.user.attr?.workerId === open.worker_ID) return req.reject(403, "You can't verify your own skills. Another manager has to.")
    return JSON.stringify(await handle(open.worker_ID, 'verification_decided', { request, approved, proofType, proofRef, proficiency, note, clip, staff }, req.user.id))
  })

  this.on('proofClip', async req => {
    const { ProofClips } = cds.entities('frontline')
    const found = await SELECT.one.from(ProofClips).columns('worker_ID', 'clip').where({ request_ID: req.data.request })
    if (!found) return req.reject(404, 'No clip for this request')
    await ownWorker(req, found.worker_ID)
    return found.clip
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
    const people = await SELECT.from(Workers).columns('ID', 'ewmUser').where({ company_ID })
    const own = new Set(people.map(w => w.ID))
    const byEwmUser = new Map(people.filter(w => w.ewmUser).map(w => [w.ewmUser.toUpperCase(), w.ID]))
    // EWM knows people by their EWM user code, so match each line to the registered person.
    const unknown = rows.find(r => r.ewmUser && !byEwmUser.has(r.ewmUser))
    if (unknown) return req.reject(400, `EWM user ${unknown.ewmUser} isn't registered at your company. Add their EWM user code in People first.`)
    rows = rows.map(({ ewmUser, ...r }) => (ewmUser ? { ...r, worker_ID: byEwmUser.get(ewmUser) } : r))
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
    const workers = new Map((await SELECT.from(Workers).where({ company_ID })).map(w => [w.ID, w]))
    const records = sinceJoining(await SELECT.from(EwmTaskRecords).where({ worker_ID: { in: [...workers.keys()] } }).orderBy('workDate desc').limit(25), id => workers.get(id)?.joinedOn)
    return JSON.stringify(records.map(r => ({ ...r, workerName: workers.get(r.worker_ID)?.name })))
  })

  this.on('findTalent', async req => {
    const { SuccessFactorsSkills } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    return JSON.stringify(await SELECT.from(SuccessFactorsSkills).where({ company_ID, skill_ID: req.data.skill }).orderBy('proficiency desc', 'userName'))
  })

  // Everyone at other companies who has chosen to be seen, with at least one verified skill,
  // and whose own company has joined the marketplace.
  async function openPeople(company_ID) {
    const { Workers, SkillClaims, Companies } = cds.entities('frontline')
    const joined = (await SELECT.from(Companies).columns('ID').where({ marketplace: true })).map(c => c.ID)
    const people = (await SELECT.from(Workers).where({ outsideOptIn: true, active: true, company_ID: { '!=': company_ID } })).filter(w => joined.includes(w.company_ID))
    if (!people.length) return []
    const proven = groupBy(await SELECT.from(SkillClaims).where({ worker_ID: { in: people.map(p => p.ID) }, status: 'verified' }), 'worker_ID')
    return people.filter(p => proven.has(p.ID)).map(p => ({ ...p, proven: proven.get(p.ID), ref: anonRef(p.ID, company_ID) }))
  }

  // People who said yes and later took it back. They go back to being anonymous to that company.
  async function withdrawnPeople(worker_IDs) {
    const { Applications, ShareLinks } = cds.entities('frontline')
    if (!worker_IDs.length) return new Set()
    const applications = await SELECT.from(Applications).where({ worker_ID: { in: worker_IDs } })
    if (!applications.length) return new Set()
    const cancelled = new Set((await SELECT.from(ShareLinks).columns('token').where({ token: { in: applications.map(a => a.token) }, revokedAt: { '!=': null } })).map(l => l.token))
    return new Set(applications.filter(a => cancelled.has(a.token)).map(a => `${a.worker_ID}|${a.vacancy_ID}`))
  }

  async function ownOpenRole(req, vacancy, company_ID) {
    const { Vacancies } = cds.entities('frontline')
    const role = await SELECT.one.from(Vacancies).where({ ID: vacancy, company_ID, isExternal: true })
    return role ?? req.reject(404, 'This role is not one of yours')
  }

  this.on('openRoles', async req => {
    const { Vacancies, Roles, Applications } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const titles = new Map((await SELECT.from(Roles)).map(r => [r.ID, r.title]))
    const people = await openPeople(company_ID)
    const vacancies = await SELECT.from(Vacancies).where({ company_ID, isExternal: true })
    const applied = vacancies.length ? groupBy(await SELECT.from(Applications).where({ vacancy_ID: { in: vacancies.map(v => v.ID) } }), 'vacancy_ID') : new Map()
    return JSON.stringify(vacancies.map(v => ({
      ID: v.ID, title: titles.get(v.role_ID), site: v.site, isNew: v.source === 'posted', postedAt: v.postedAt,
      openPeople: people.length, applicants: applied.get(v.ID)?.length ?? 0
    })))
  })

  this.on('postRole', async req => {
    const { Companies } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const company = await SELECT.one.from(Companies).where({ ID: company_ID })
    return postVacancy(company, req.data.role, req.data.site)
  })

  this.on('candidates', async req => {
    const { RoleMatches, HireInterests } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const { vacancy } = req.data
    await ownOpenRole(req, vacancy, company_ID)
    const people = await openPeople(company_ID)
    if (!people.length) return '[]'
    const worker_ID = { in: people.map(p => p.ID) }
    const scores = new Map((await SELECT.from(RoleMatches).where({ vacancy_ID: vacancy, worker_ID })).map(m => [m.worker_ID, m.score]))
    const withdrawn = await withdrawnPeople(people.map(p => p.ID))
    const asked = new Map((await SELECT.from(HireInterests).where({ vacancy_ID: vacancy, worker_ID })).map(i => [i.worker_ID, withdrawn.has(`${i.worker_ID}|${vacancy}`) ? 'withdrawn' : i.status]))
    // Only the anonymous reference, skills and score. Never a name, a site, an employer or who verified them.
    return JSON.stringify(people
      .map(p => ({ ref: p.ref, score: scores.get(p.ID) ?? 0, skills: p.proven.map(c => ({ skill_ID: c.skill_ID, proficiency: c.proficiency })), status: asked.get(p.ID) ?? '' }))
      .sort((a, b) => b.score - a.score))
  })

  this.on('askToConnect', async req => {
    const { company_ID } = await staffOf(req)
    const { vacancy, candidate, message } = req.data
    await ownOpenRole(req, vacancy, company_ID)
    const person = (await openPeople(company_ID)).find(p => p.ref === candidate)
    if (!person) return req.reject(404, 'This person is no longer open to other companies')
    return JSON.stringify(await handle(person.ID, 'hire_interest_sent', { vacancy, company_ID, message }, req.user.id))
  })

  this.on('outreach', async req => {
    const { HireInterests, Vacancies, Roles, Workers } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const titles = new Map((await SELECT.from(Roles)).map(r => [r.ID, r.title]))
    const vacancies = new Map((await SELECT.from(Vacancies).where({ company_ID })).map(v => [v.ID, v]))
    const sent = await SELECT.from(HireInterests).where({ company_ID }).orderBy('createdAt desc')
    const names = sent.some(i => i.status === 'granted')
      ? new Map((await SELECT.from(Workers).columns('ID', 'name').where({ ID: { in: sent.map(i => i.worker_ID) } })).map(w => [w.ID, w.name]))
      : new Map()
    const withdrawn = await withdrawnPeople([...new Set(sent.map(i => i.worker_ID))])
    return JSON.stringify(sent.map(i => {
      const status = withdrawn.has(`${i.worker_ID}|${i.vacancy_ID}`) ? 'withdrawn' : i.status
      return {
        ID: i.ID, status, sentAt: i.createdAt, decidedAt: i.decidedAt,
        role: titles.get(vacancies.get(i.vacancy_ID)?.role_ID),
        who: status === 'granted' ? names.get(i.worker_ID) : `Candidate ${anonRef(i.worker_ID, company_ID)}`
      }
    }))
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
      const certificates = await checkShare(a.token)
      return {
        ID: a.ID, status: a.status, message: a.message, appliedAt: a.createdAt, changedAt: a.modifiedAt, noticeDays: a.noticeDays, leavesOn: a.leavesOn,
        // Taking back permission takes back the name too.
        applicant: certificates.status === 'cancelled' ? 'Permission withdrawn' : worker?.name,
        role: roles.get(vacancy.role_ID), site: vacancy.site, certificates
      }
    })))
  })

  this.on('answerApplication', async req => {
    const { Applications, Vacancies } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const { application, status, message, noticeDays } = req.data
    const found = await SELECT.one.from(Applications).where({ ID: application })
    const vacancy = found && await SELECT.one.from(Vacancies).where({ ID: found.vacancy_ID })
    if (!vacancy) return req.reject(404, 'Application not found')
    if (vacancy.company_ID !== company_ID) return req.reject(403, 'This application is not for your company')
    if ((await checkShare(found.token)).status === 'cancelled') return req.reject(409, 'This person has taken back permission')
    return JSON.stringify(await handle(found.worker_ID, 'application_answered', { application, status, message, noticeDays }, req.user.id))
  })

  // Resigned, and the last day. The employer is never told which company they are going to.
  this.on('leavers', async req => {
    const { Workers, Applications } = cds.entities('frontline')
    const { company_ID } = await staffOf(req)
    const people = new Map((await SELECT.from(Workers).columns('ID', 'name').where({ company_ID })).map(w => [w.ID, w.name]))
    if (!people.size) return '[]'
    const leaving = await SELECT.from(Applications).where({ worker_ID: { in: [...people.keys()] }, status: 'accepted' })
    return JSON.stringify(leaving.map(a => ({ ID: a.ID, worker: a.worker_ID, name: people.get(a.worker_ID), leavesOn: a.leavesOn, at: a.modifiedAt })))
  })

  this.on('releaseEarly', async req => {
    await ownWorker(req, req.data.worker)
    return JSON.stringify(await handle(req.data.worker, 'released_early', {}, req.user.id))
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
      ewmRecords: sinceJoining(await SELECT.from(EwmTaskRecords).where({ worker_ID }).orderBy('workDate desc').limit(5), () => worker.joinedOn),
      aiRoute: askJson.provider()
    }))
  })

  this.on('decide', async req => {
    const { worker, outcome, reasons } = req.data
    await ownWorker(req, worker)
    if (req.user.attr?.workerId === worker) return req.reject(403, "You can't decide your own role review. Another manager has to.")
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
    // Only the demo worker can be reset: the reset restores his sample job record, so on anyone else it would overwrite theirs.
    // His old employer can still reset him after he moved, so a run can start again.
    if (req.data.worker !== DEMO_WORKER) return req.reject(400, 'Only the sample worker can be reset')
    const { Workers } = cds.entities('frontline')
    const moved = await SELECT.one.from(Workers).where({ ID: DEMO_WORKER, formerCompany_ID: (await staffOf(req)).company_ID })
    if (!moved) await ownWorker(req, req.data.worker)
    await resetWorker(req.data.worker)
    return true
  })
})
