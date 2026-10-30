// Agent E. Assembles what the manager reads. It records nothing: only a manager can create a decision.
function review({ worker, claims, evidence, matches, plan }) {
  return {
    worker: { ID: worker.ID, name: worker.name, site: worker.site },
    verified: claims.filter(c => c.status === 'verified'),
    needsEvidence: claims.filter(c => c.status !== 'verified'),
    evidence,
    matches,
    plan
  }
}

module.exports = review
