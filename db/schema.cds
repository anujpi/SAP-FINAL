namespace frontline;

using { cuid, managed } from '@sap/cds/common';

// Journey stage values live in srv/orchestrator.js, the only code that changes them.
entity Workers : cuid {
  name           : String(100);
  site           : String(50);
  employmentType : String(20);   // permanent | contract
  lang           : String(5);
  stage          : String(20) default 'NOT_STARTED';
  targetRole     : Association to Roles;
  outsideOptIn   : Boolean default false;
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
  key ID      : String(30);
      name    : String(100);
      keywords : String(300);    // used only by the offline fallback in agent B
}

entity SkillClaims : cuid {
  worker      : Association to Workers;
  skill       : Association to Skills;
  source      : String(30);
  confidence  : Decimal(3, 2);
  status      : String(20);      // self_reported | needs_evidence | verified. Never "missing".
  proficiency : Integer;
}

entity EvidenceItems : cuid, managed {
  worker     : Association to Workers;
  skill      : Association to Skills;
  type       : String(30);       // assessment | supervisor_attestation
  attestedBy : String(100);
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
  signature   : String(64);
}

entity ShareLinks : cuid {
  worker    : Association to Workers;
  token     : String(64);
  skills    : LargeString;       // JSON, skill IDs the worker chose
  revokedAt : Timestamp;
}
