using { frontline as db } from '../db/schema';

// Everything here is limited to the signed-in person's own company. See manager-service.js.
service ManagerService @(path: '/manager', requires: ['Manager', 'Supervisor', 'HRAdmin']) {

  @readonly entity ReviewQueue as select from db.Workers { ID, name, site, stage, company.ID as company_ID } where stage = 'AWAITING_MANAGER';
  @readonly entity Team as select from db.Workers { ID, name, site, stage, company.ID as company_ID };
  @readonly entity Skills as projection on db.Skills excluding { keywords };

  // A worker's interest in outside jobs is private, so those events never show here.
  @requires: ['Manager', 'HRAdmin']
  @readonly entity AuditEvents as select from db.AuditEvents { * } where type not in ('outside_opt_in', 'application_submitted', 'application_answered');

  /** Every employee with their skills, EWM support and open requests. */
  function teamSkills() returns LargeString;

  /** One employee's whole profile: job details, skills, proof, EWM and what they do. Never their outside job search. */
  function employeeProfile(worker : UUID) returns LargeString;

  /** Open requests, each with what EWM shows for that skill. */
  function verificationRequests() returns LargeString;

  @requires: ['Manager', 'Supervisor']
  action decideVerification(request : UUID, approved : Boolean, proofType : String, proofRef : String, proficiency : Integer, note : String) returns LargeString;

  /** Loads one day's EWM extract, as CSV. */
  @requires: ['Manager', 'Supervisor']
  action importEwmExtract(csv : LargeString) returns LargeString;

  /** The latest EWM records for this company. */
  function ewmRecent() returns LargeString;

  /** Employees with this verified skill, from the mock SuccessFactors store. */
  @requires: ['Manager', 'HRAdmin']
  function findTalent(skill : String) returns LargeString;

  /** People from other companies applying here, with their certificates checked. */
  @requires: ['Manager', 'HRAdmin']
  function applicants() returns LargeString;

  @requires: 'Manager'
  action answerApplication(application : UUID, status : String, message : String) returns LargeString;

  @requires: ['Manager', 'HRAdmin']
  function reviewPacket(worker : UUID) returns LargeString;

  /** This worker's data in the shape of the SAP APIs it would come from or go to. Nothing is sent to SAP. */
  @requires: ['Manager', 'HRAdmin']
  function sapContext(worker : UUID) returns LargeString;

  @requires: 'Manager'
  action decide(worker : UUID, outcome : String, reasons : String) returns LargeString;

  @requires: 'HRAdmin'
  function fairnessReport() returns LargeString;

  @requires: 'HRAdmin'
  action resetDemo(worker : UUID) returns Boolean;
}
