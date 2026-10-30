using { frontline as db } from '../db/schema';

service ManagerService @(path: '/manager', requires: ['Manager', 'Supervisor', 'HRAdmin']) {

  @readonly entity ReviewQueue as select from db.Workers { ID, name, site, stage } where stage = 'AWAITING_MANAGER';

  @requires: ['Manager', 'HRAdmin']
  @readonly entity AuditEvents as projection on db.AuditEvents;

  @requires: ['Manager', 'HRAdmin']
  function reviewPacket(worker : UUID) returns LargeString;

  @requires: 'Manager'
  action decide(worker : UUID, outcome : String, reasons : String) returns LargeString;

  @requires: 'Supervisor'
  action attest(worker : UUID, skill : String, proficiency : Integer) returns LargeString;

  @requires: 'HRAdmin'
  function fairnessReport() returns LargeString;

  @requires: 'HRAdmin'
  action resetDemo(worker : UUID) returns Boolean;
}
