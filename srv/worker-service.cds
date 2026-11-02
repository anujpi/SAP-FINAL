using { frontline as db } from '../db/schema';

service WorkerService @(path: '/worker', requires: 'Worker') {

  @readonly @restrict: [{ grant: 'READ', where: 'ID = $user.workerId' }]
  entity Me as projection on db.Workers;

  @readonly @restrict: [{ grant: 'READ', where: 'worker_ID = $user.workerId' }]
  entity MyTasks as projection on db.TaskExperiences;

  @readonly @restrict: [{ grant: 'READ', where: 'worker_ID = $user.workerId' }]
  entity MySkills as projection on db.SkillClaims;

  @readonly @restrict: [{ grant: 'READ', where: 'worker_ID = $user.workerId' }]
  entity MyMatches as projection on db.RoleMatches;

  @readonly @restrict: [{ grant: 'READ', where: 'worker_ID = $user.workerId' }]
  entity MyPlan as projection on db.LearningPlans;

  @readonly @restrict: [{ grant: 'READ', where: 'worker_ID = $user.workerId' }]
  entity MyDecisions as projection on db.ReviewDecisions;

  @readonly @restrict: [{ grant: 'READ', where: 'worker_ID = $user.workerId' }]
  entity MyAuditEvents as projection on db.AuditEvents;

  @readonly @restrict: [{ grant: 'READ', where: 'worker_ID = $user.workerId' }]
  entity MyRequests as projection on db.VerificationRequests;

  @readonly @restrict: [{ grant: 'READ', where: 'worker_ID = $user.workerId' }]
  entity MyApplications as projection on db.Applications excluding { token };

  /** What EWM shows for each of this worker's skills. */
  function myEwmSupport() returns LargeString;

  @readonly entity Roles as projection on db.Roles;
  @readonly entity Skills as projection on db.Skills excluding { keywords };
  @readonly entity LearningModules as projection on db.LearningModules excluding { answerKey };
  @readonly entity Vacancies as projection on db.Vacancies;

  /** Sends one journey event. payload is a JSON string. */
  action sendEvent(type : String, payload : LargeString) returns LargeString;

  /** Which skills the sample outside jobs ask for. */
  function marketSignal() returns LargeString;

  /** Which LLM route is active, so the UI never claims more than is live. */
  function aiStatus() returns String;
}
