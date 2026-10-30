// Agent D. Turns gaps into an ordered plan from the catalog, biggest gap first.
function pathway(gaps, modules) {
  return [...gaps]
    .sort((a, b) => b.weight - a.weight)
    .flatMap(g => modules.filter(m => m.skill_ID === g.skill))
    .map(m => m.ID)
}

module.exports = pathway
