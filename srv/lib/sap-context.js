// Shows our data in the shape of the SAP APIs it would come from or go to. Nothing here calls SAP.
// Field names follow SuccessFactors OData (EmpJob, JobRequisition, JobApplication).
function sapContext({ worker, vacancies, roleTitles, claims, skillNames, decision, ewmRecords, aiRoute }) {
  const requisitions = vacancies.filter(v => !v.isExternal && v.role_ID === worker.targetRole_ID)
  const proven = claims.filter(c => c.status === 'verified')
  const shortlisted = decision?.outcome === 'shortlist' || decision?.outcome === 'move_to_role'

  return {
    aiRoute,
    empJob: {
      userId: worker.ID,
      jobTitle: worker.jobTitle,
      location: worker.site,
      employmentType: worker.employmentType
    },
    requisitions: requisitions.map(v => ({ jobReqId: v.ID, jobCode: v.role_ID, jobTitle: roleTitles[v.role_ID], location: v.site })),
    warehouseTasks: ewmRecords.map(r => ({ EWMWarehouse: r.warehouse, date: r.workDate, taskType: r.taskType, confirmedTasks: r.confirmedTasks })),
    // Only proven skills and a shortlist ever leave. A "not yet" stays in this system.
    writeBack: {
      sent: false,
      skills: proven.map(c => ({ userId: worker.ID, skillId: c.skill_ID, skillName: skillNames[c.skill_ID], proficiencyLevel: c.proficiency, source: c.source })),
      jobApplication: shortlisted && requisitions[0] ? { jobReqId: requisitions[0].ID, candidateId: worker.ID, status: decision.outcome === 'move_to_role' ? 'Hired' : 'Shortlisted' } : null
    }
  }
}

module.exports = sapContext
