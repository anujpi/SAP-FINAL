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

  @readonly entity Skills as projection on db.Skills excluding { keywords };
  @readonly entity LearningModules as projection on db.LearningModules excluding { answerKey };
  @readonly entity Vacancies as projection on db.Vacancies;

  /** Sends one journey event. payload is a JSON string. */
  action sendEvent(type : String, payload : LargeString) returns LargeString;

  /** Which skills the sample outside jobs ask for. */
  function marketSignal() returns LargeString;
}
