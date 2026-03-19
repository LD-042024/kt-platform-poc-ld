// ─────────────────────────────────────────────────────────────────────────────
// prompts/org-context.js
//
// Standing knowledge about your organisation injected into EVERY Claude call.
// Commit this per client/project — it's the single place to describe your stack,
// conventions, and rules so you never repeat them across individual prompts.
//
// HOW TO USE:
//   Fill in the fields below. Leave a field as empty string "" to omit it.
//   All non-empty fields are automatically included in every prompt.
// ─────────────────────────────────────────────────────────────────────────────

export const ORG_CONTEXT = {

  // Organisation / client name
  orgName: "",
  // e.g. "FinBank Group — Data Engineering Platform Team"

  // Core data stack (tools, versions, cloud)
  stack: "",
  // e.g. "Airflow 2.7 on GCP Cloud Composer, dbt Core 1.7, BigQuery DWH,
  //        Python 3.11, Terraform for infra, GitHub Actions for CI/CD"

  // Pipeline / DAG naming conventions
  namingConventions: "",
  // e.g. "DAGs: <domain>_<entity>_<frequency>  e.g. finance_ledger_daily
  //        Tables: <domain>.<entity>_<grain>    e.g. finance.ledger_daily"

  // Data governance & compliance rules
  governance: "",
  // e.g. "PII fields must be tagged in the Collibra catalogue before prod.
  //        GDPR retention: 7 years for financial data, 2 years for behavioural.
  //        All pipelines must pass Great Expectations suite before promotion."

  // Environments
  environments: "",
  // e.g. "dev → staging → prod. No direct prod access — all changes via PR.
  //        Staging mirrors prod data with PII masked."

  // Team & escalation structure
  team: "",
  // e.g. "Data Engineering (owner), Analytics (consumer), Platform (infra support).
  //        On-call rotation: PagerDuty, P1 SLA = 30 min response."

  // Any other standing context you want Claude to always know
  other: "",
};


// ─── BUILDER ─────────────────────────────────────────────────────────────────
// Assembles the above fields into a single injected block.
// Called by prompts/index.js — you don't need to edit this.

export function buildOrgContext() {
  const labels = {
    orgName:           "Organisation",
    stack:             "Tech Stack",
    namingConventions: "Naming Conventions",
    governance:        "Data Governance",
    environments:      "Environments",
    team:              "Team Structure",
    other:             "Additional Context",
  };

  const lines = Object.entries(labels)
    .filter(([key]) => ORG_CONTEXT[key] && ORG_CONTEXT[key].trim())
    .map(([key, label]) => `${label}:\n${ORG_CONTEXT[key].trim()}`);

  if (!lines.length) return "";

  return `ORG CONTEXT (apply to all responses):\n${"─".repeat(40)}\n${lines.join("\n\n")}`;
}
