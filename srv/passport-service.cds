using { frontline as db } from '../db/schema';

// The service is public only because of check(). Everything else is locked to the worker.
service PassportService @(path: '/passport', requires: 'any') {

  @readonly @restrict: [{ grant: 'READ', to: 'Worker', where: 'worker_ID = $user.workerId' }]
  entity MyCredentials as projection on db.SkillCredentials excluding { signature };

  @readonly @restrict: [{ grant: 'READ', to: 'Worker', where: 'worker_ID = $user.workerId' }]
  entity MyLinks as projection on db.ShareLinks;

  @requires: 'Worker'
  action createLink(skills : many String) returns String;

  @requires: 'Worker'
  action cancelLink(token : String) returns Boolean;

  /** Public check an outside employer opens. Returns only what the worker chose to share. */
  function check(token : String) returns LargeString;
}
