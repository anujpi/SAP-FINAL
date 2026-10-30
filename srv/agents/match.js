// Agent C. Deterministic: match = Σ(w·c) / Σw. No LLM touches the score.
function match(requirements, claims) {
  const verified = new Map(claims.filter(c => c.status === 'verified').map(c => [c.skill_ID, c]))
  const known = new Map(claims.map(c => [c.skill_ID, c]))
  const strengths = [], gaps = [], ruleTrace = []
  let earned = 0, total = 0

  for (const r of requirements) {
    const claim = verified.get(r.skill_ID)
    const credit = !claim ? 0 : claim.proficiency >= r.requiredLevel ? 1 : 0.5
    earned += r.weight * credit
    total += r.weight
    ruleTrace.push({ skill: r.skill_ID, weight: r.weight, requiredLevel: r.requiredLevel, credit })
    if (credit === 1) strengths.push(r.skill_ID)
    else gaps.push({ skill: r.skill_ID, status: known.get(r.skill_ID)?.status ?? 'needs_evidence', weight: r.weight })
  }

  return { score: total ? Math.round((100 * earned) / total) : 0, strengths, gaps, ruleTrace }
}

module.exports = match
