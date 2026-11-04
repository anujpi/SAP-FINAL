using { frontline as db } from '../db/schema';

// Everything here is limited to the signed-in person's own company. See manager-service.js.
// Room for a short proof clip in one request.
service ManagerService @(path: '/manager', requires: ['Manager', 'Supervisor', 'HRAdmin'], cds.server.body_parser.limit: '12mb') {

  @readonly entity ReviewQueue as select from db.Workers { ID, name, site, stage, company.ID as company_ID } where stage = 'AWAITING_MANAGER';
  @readonly entity Team as select from db.Workers { ID, name, site, stage, ewmUser, company.ID as company_ID } where active = true;
  @readonly entity Skills as projection on db.Skills excluding { keywords };
  @readonly entity Roles as projection on db.Roles;

  // A worker's interest in outside jobs is private, so those events never show here.
  @requires: ['Manager', 'HRAdmin']
  @readonly entity AuditEvents as select from db.AuditEvents { * } where type not in ('outside_opt_in', 'application_submitted', 'application_answered', 'hire_interest_sent', 'hire_interest_answered', 'offer_answered');

  /** Who is registered at this company, and its settings. */
  @requires: ['Manager', 'HRAdmin']
  function people() returns LargeString;

  /** Only registered people can sign in. HR registers them here. */
  @requires: 'HRAdmin'
  action registerPerson(name : String, email : String, kind : String, jobTitle : String, site : String, ewmUser : String) returns Boolean;

  @requires: 'HRAdmin'
  action removePerson(email : String) returns Boolean;

  /** Whether this company's people see, and can be seen by, other companies. */
  @requires: 'HRAdmin'
  action setMarketplace(on : Boolean) returns Boolean;

  /** Every employee with their skills, EWM support and open requests. */
  function teamSkills() returns LargeString;

  /** One employee's whole profile: job details, skills, proof, EWM and what they do. Never their outside job search. */
  function employeeProfile(worker : UUID) returns LargeString;

  /** Open requests, each with what EWM shows for that skill. */
  function verificationRequests() returns LargeString;

  @requires: ['Manager', 'Supervisor']
  action decideVerification(request : UUID, approved : Boolean, proofType : String, proofRef : String, proficiency : Integer, note : String, clip : LargeString) returns LargeString;

  /** The proof clip attached to a verified request, as a data URL. Only for the worker's own company. */
  @requires: ['Manager', 'Supervisor', 'HRAdmin']
  function proofClip(request : UUID) returns LargeString;

  /** Loads one day's EWM extract, as CSV. */
  @requires: ['Manager', 'Supervisor']
  action importEwmExtract(csv : LargeString) returns LargeString;

  /** The latest EWM records for this company. */
  function ewmRecent() returns LargeString;

  /** Employees with this verified skill, from the mock SuccessFactors store. */
  @requires: ['Manager', 'HRAdmin']
  function findTalent(skill : String) returns LargeString;

  /** This company's roles open to outside people, with how many candidates and applicants each has. */
  @requires: ['Manager', 'HRAdmin']
  function openRoles() returns LargeString;

  @requires: 'Manager'
  action postRole(role : String, site : String) returns String;

  /** People at other companies open to offers, matched to one of this company's roles. Anonymous: no name, no employer. */
  @requires: ['Manager', 'HRAdmin']
  function candidates(vacancy : String) returns LargeString;

  @requires: 'Manager'
  action askToConnect(vacancy : String, candidate : String, message : String) returns LargeString;

  /** The requests this company has sent. A name appears only once the person has said yes. */
  @requires: ['Manager', 'HRAdmin']
  function outreach() returns LargeString;

  /** People from other companies applying here, with their certificates checked. */
  @requires: ['Manager', 'HRAdmin']
  function applicants() returns LargeString;

  @requires: 'Manager'
  /** status interview, offered (with noticeDays, 0 to 90) or closed. */
  action answerApplication(application : UUID, status : String, message : String, noticeDays : Integer) returns LargeString;

  /** Employees who accepted a job elsewhere and are serving notice: name and last day only, never where they are going. */
  @requires: ['Manager', 'HRAdmin']
  function leavers() returns LargeString;

  /** Ends an employee's notice period today, so they move to their new company now. */
  @requires: ['Manager', 'HRAdmin']
  action releaseEarly(worker : UUID) returns LargeString;

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
