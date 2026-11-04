namespace frontline;

using { cuid, managed } from '@sap/cds/common';

entity Companies {
  key ID          : String(30);
      name        : String(100);
      marketplace : Boolean default false;   // the company lets its people see, and be seen by, other companies
}

// Who a manager login is and which company they work for. It scopes everything they see.
entity Staff {
  key login   : String(100);
      name    : String(100);
      title   : String(100);
      company : Association to Companies;
      email   : String(120);
      roles   : String(100);   // Manager, Supervisor, HRAdmin, comma separated
}

// Journey stage values live in srv/orchestrator.js, the only code that changes them.
entity Workers : cuid {
  name           : String(100);
  site           : String(50);
  employmentType : String(20);   // permanent | contract
  lang           : String(5);
  stage          : String(20) default 'NOT_STARTED';
  targetRole     : Association to Roles;
  outsideOptIn   : Boolean default false;
  company        : Association to Companies;
  // Stand-in for the SuccessFactors employee record.
  employeeCode   : String(20);
  jobTitle       : String(100);
  department     : String(60);
  workShift      : String(20);
  managerName    : String(100);
  joinedOn       : Date;
  // Who may sign in, and how EWM knows them. Only registered, active people get in.
  email          : String(120);
  login          : String(60);
  ewmUser        : String(20);
  active         : Boolean default true;
  formerCompany  : Association to Companies;  // set when the worker moves to a company that hired them
}

// The daily extract of confirmed warehouse tasks from EWM. Company data, so it stays when a worker withdraws consent.
entity EwmTaskRecords : cuid {
  worker         : Association to Workers;
  workDate       : Date;
  taskType       : String(30);
  confirmedTasks : Integer;
  warehouse      : String(10);
  importedBy     : String(30);
}

// A worker asks their manager to confirm a skill. The manager answers with proof (mocked: a type and a reference).
entity VerificationRequests : cuid, managed {
  worker        : Association to Workers;
  skill         : Association to Skills;
  status        : String(20);    // pending | verified | not_yet
  proofType     : String(30);
  proofRef      : String(100);
  note          : String(500);
  decidedByName : String(100);
  decidedAt     : Timestamp;
}

// A short clip a manager attached as proof. Kept inside the company: it never goes on a certificate or share link.
entity ProofClips : cuid, managed {
  worker   : Association to Workers;
  request  : Association to VerificationRequests;
  mimeType : String(50);
  clip     : LargeString;     // data URL, up to about 8 MB of video
}

// A worker applying to another company with their certificates. The current employer never sees these.
entity Applications : cuid, managed {
  worker  : Association to Workers;
  vacancy : Association to Vacancies;
  token   : String(64);          // the share link holding the certificates they chose
  status  : String(20);          // applied | interview | offered | accepted | declined | joined | closed
  message : String(500);
  noticeDays : Integer;          // set with an offer: how long the worker stays at their employer after accepting
  leavesOn   : Date;             // set on accepting: the last day at the current employer
}

// A company asking to connect with an anonymous candidate. Nothing about the person is shared until they say yes.
entity HireInterests : cuid, managed {
  worker    : Association to Workers;
  vacancy   : Association to Vacancies;
  company   : Association to Companies;
  status    : String(20);        // pending | granted | declined
  message   : String(500);
  decidedAt : Timestamp;
}

// Certificates a worker already holds from elsewhere. Sample data on record: not signed here, and they never score.
entity OtherCertificates : cuid {
  worker   : Association to Workers;
  title    : String(100);
  issuer   : String(100);
  issuedOn : Date;
}

// Stands in for SuccessFactors until a real tenant is connected.
entity SuccessFactorsSkills : cuid {
  company     : Association to Companies;
  worker      : Association to Workers;
  userName    : String(100);
  skill       : Association to Skills;
  proficiency : Integer;
  verifiedBy  : String(100);
  syncedAt    : Timestamp;
}

entity ConsentRecords : cuid, managed {
  worker    : Association to Workers;
  purpose   : String(50);
  granted   : Boolean;
  revokedAt : Timestamp;
}

entity TaskExperiences : cuid {
  worker    : Association to Workers;
  task      : String(500);
  tool      : String(100);
  frequency : String(50);
  example   : String(1000);
  confirmed : Boolean default false;
}

entity Skills {
  key ID          : String(30);
      name        : String(100);
      keywords    : String(300);    // used only by the offline fallback in agent B
      library     : String(20);     // Company | ESCO
      escoUri     : String(200);    // the ESCO skill, European Commission
      description : String(1000);
}

entity SkillClaims : cuid {
  worker      : Association to Workers;
  skill       : Association to Skills;
  source      : String(30);
  confidence  : Decimal(3, 2);
  status      : String(20);      // self_reported | needs_evidence | work_records | verified. Never "missing".
  proficiency : Integer;
  basis       : String(200);     // the worker's own words behind this skill, if they mentioned it
}

entity EvidenceItems : cuid, managed {
  worker     : Association to Workers;
  skill      : Association to Skills;
  type       : String(30);       // assessment | manager_verification
  attestedBy : String(100);
  proofType  : String(30);
  proofRef   : String(100);
}

entity Roles {
  key ID    : String(30);
      title : String(100);
}

entity RoleSkills {
  key role          : Association to Roles;
  key skill         : Association to Skills;
      weight        : Integer;
      requiredLevel : Integer;
}

// Mock SAP data: SuccessFactors requisitions plus sample outside jobs.
entity Vacancies {
  key ID         : String(30);
      role       : Association to Roles;
      site       : String(50);
      isExternal : Boolean default false;
      employer   : String(100);
      source     : String(20) default 'mock';
      company    : Association to Companies;
      postedAt   : Timestamp;
}

entity RoleMatches : cuid, managed {
  worker      : Association to Workers;
  vacancy     : Association to Vacancies;
  score       : Integer;
  strengths   : LargeString;     // JSON
  gaps        : LargeString;     // JSON
  eligibility : LargeString;     // JSON
  ruleTrace   : LargeString;     // JSON
}

entity LearningModules {
  key ID               : String(30);
      skill            : Association to Skills;
      title            : String(200);
      durationMin      : Integer;
      url              : String(300);
      practiceQuestion : String(500);
      answerKey        : String(100);   // never exposed to workers
      proficiency      : Integer;
}

entity LearningPlans : cuid {
  worker    : Association to Workers;
  modules   : LargeString;       // JSON, ordered
  completed : LargeString;       // JSON, module IDs
}

entity ReviewDecisions : cuid, managed {
  worker    : Association to Workers;
  outcome   : String(20);        // shortlist | request_evidence | not_yet
  reasons   : String(1000);
  decidedBy : String(100);
}

// Append-only. worker_ID is a plain value so the trail survives data deletion.
entity AuditEvents : cuid {
  occurredAt : Timestamp @cds.on.insert: $now;
  worker_ID  : UUID;
  company_ID : String(30);
  type       : String(30);
  stage      : String(20);
  actor      : String(100);
  contract   : String(50);
  degraded   : Boolean default false;
}

entity SkillCredentials : cuid {
  worker      : Association to Workers;
  skill       : Association to Skills;
  proficiency : Integer;
  method      : String(30);
  issuedAt    : Timestamp;
  verifiedBy  : String(100);
  verifierTitle : String(100);
  company     : String(100);     // the name at the time, so a certificate outlives a job change
  proofType   : String(30);
  signature   : String(64);
}

entity ShareLinks : cuid {
  worker    : Association to Workers;
  token     : String(64);
  skills    : LargeString;       // JSON, skill IDs the worker chose
  revokedAt : Timestamp;
}
