// Agent G. Rule-based bias check across all workers. Flags go to HR, who decide what they mean.
const DIMENSIONS = ['lang', 'employmentType']
const GAP_POINTS = 10   // ponytail: fixed threshold, make it per-customer in the pilot
const MIN_GROUP = 3     // smaller groups are reported but never flagged

function audit(rows) {
  return DIMENSIONS.map(dimension => {
    const groups = new Map()
    for (const r of rows) {
      const g = groups.get(r[dimension]) ?? { group: r[dimension], n: 0, total: 0, shortlisted: 0 }
      g.n++
      g.total += r.score
      if (r.outcome === 'shortlist' || r.outcome === 'move_to_role') g.shortlisted++
      groups.set(r[dimension], g)
    }
    const stats = [...groups.values()].map(g => ({
      group: g.group,
      n: g.n,
      avgScore: Math.round(g.total / g.n),
      shortlistRate: Math.round((100 * g.shortlisted) / g.n)
    }))
    const comparable = stats.filter(s => s.n >= MIN_GROUP).map(s => s.avgScore)
    const gap = comparable.length > 1 ? Math.max(...comparable) - Math.min(...comparable) : 0
    return { dimension, metric: 'avgScore', groups: stats, gap, flagged: gap >= GAP_POINTS }
  })
}

module.exports = audit
