// Agent F. Counts which skills the outside jobs ask for. Demo data is sample data, so source stays "sample".
function market(externalVacancies, roleSkills) {
  const demand = new Map()
  for (const v of externalVacancies)
    for (const r of roleSkills.filter(r => r.role_ID === v.role_ID))
      demand.set(r.skill_ID, (demand.get(r.skill_ID) ?? 0) + 1)

  return [...demand]
    .map(([skill, demandCount]) => ({ skill, demandCount, source: 'sample' }))
    .sort((a, b) => b.demandCount - a.demandCount)
}

module.exports = market
