// prompts/index.js — single import point for all prompts
// SECTION_CHECKLIST_ITEMS mirrors DEFAULT_CHECKLIST_ITEMS in files-4/data.js.
// Keep both in sync if sub-item names are ever renamed or added.
const SECTION_CHECKLIST_ITEMS = {
  biz_context:    ["Business objective & problem statement","Data consumers & downstream stakeholders","SLA commitments & business impact of failure","Key business decisions this data powers","Historical context & major decisions made","Success metrics & KPIs tracked"],
  data_context:   ["Domain glossary & business definitions","Core entity definitions (customer, order, event…)","Data lineage narrative (source → transform → output)","Data ownership & stewardship model","Sensitive / PII data inventory","Data retention & archival policies"],
  pipelines:      ["Complete pipeline/DAG inventory list","Pipeline dependency map & execution order","Schedule & trigger documentation","Expected runtime & SLA thresholds","Failure modes & retry / alerting logic","Data volume & growth trends"],
  data_sources:   ["Source system inventory with owners","Ingestion method per source","Refresh cadence & latency expectations","Schema documentation per source","Source system contacts & escalation","Known data quality issues per source"],
  environment:    ["Environment overview (dev / staging / prod)","Connection strings & endpoint documentation","Secrets & credentials management process","Tool versions & compatibility matrix","Access provisioning guide for new team","VPN / network access requirements"],
  infrastructure: ["Cloud architecture overview","Orchestration platform setup","Compute & storage resources inventory","Infrastructure-as-code repo & docs","Deployment & CI/CD pipeline","Cost overview & budget owners"],
  data_quality:   ["Data quality rules & validation logic","Quality monitoring & alerting setup","SLA definitions & breach process","Known recurring data anomalies & workarounds","Data reconciliation processes","Quality dashboard / reporting links"],
  runbooks:       ["Pipeline failure triage & resolution","Data backfill process","Incident response playbook","On-call rotation & escalation path","Common operational tasks (restart, rerun)","Monitoring dashboards & how to read them"],
  known_issues:   ["Open bug inventory with severity","Tech debt register & priority","Active workarounds & their risks","Performance bottlenecks & limits","Security vulnerabilities & mitigations","Deprecated components still in use"],
  contacts:       ["Data / pipeline owner contacts","Upstream source system owners","Downstream consumer contacts","On-call engineer & escalation chain","Business stakeholder contacts","Vendor / third-party contacts"],
};

import { buildOrgContext }   from "./org-context.js";
import { GITHUB_PROMPT }     from "./github.js";
import { ASK_PROMPT }        from "./ask-agent.js";
import { DATABASE_PROMPT }   from "./database.js";
import { CONFLUENCE_PROMPT } from "./confluence.js";
import { JIRA_PROMPT }       from "./jira.js";
import { NOTION_PROMPT }     from "./notion.js";

const orgContext = buildOrgContext();

const SECTION_LABELS = {
  biz_context:    "Business Context",
  data_context:   "Data Context",
  pipelines:      "Pipeline Inventory",
  data_sources:   "Data Sources",
  environment:    "Environment",
  infrastructure: "Infrastructure",
  data_quality:   "Data Quality",
  runbooks:       "Runbooks",
  known_issues:   "Known Issues",
  contacts:       "Contacts",
};

const SOURCE_PROMPTS = {
  github:     GITHUB_PROMPT,
  database:   DATABASE_PROMPT,
  confluence: CONFLUENCE_PROMPT,
  jira:       JIRA_PROMPT,
  notion:     NOTION_PROMPT,
};

export const PROMPTS = {
  orgContext,
  sectionLabels: SECTION_LABELS,

  // Direct access to each source's prompt object (for system prompts etc.)
  github:     GITHUB_PROMPT,
  database:   DATABASE_PROMPT,
  confluence: CONFLUENCE_PROMPT,
  jira:       JIRA_PROMPT,
  notion:     NOTION_PROMPT,
  ask:        ASK_PROMPT,

  // Get system prompt for a given source
  getSystem(sourceId) {
    return SOURCE_PROMPTS[sourceId]?.system || GITHUB_PROMPT.system;
  },

  // Build populate prompt for any source — server.js calls this per-connector
  buildPopulate({ source, sourceData, promptTemplate, sectionsToPopulate, sectionLabels }) {
    const sp = SOURCE_PROMPTS[source];
    if (!sp) throw new Error(`Unknown prompt source "${source}". Add it to prompts/index.js.`);

    // Build sectionItems — exact sub-item names per requested section.
    // Passed into responseFormat() so Claude drafts per sub-item,
    // and acceptDraft() in Tracker.jsx maps each draft to the right notes field.
    const sectionItems = {};
    (sectionsToPopulate || []).forEach(secId => {
      if (SECTION_CHECKLIST_ITEMS[secId]) {
        sectionItems[secId] = SECTION_CHECKLIST_ITEMS[secId];
      }
    });

    return sp.build({
      // each prompt's build() takes what it needs — pass everything
      sourceData,
      githubData:     source === "github"     ? sourceData : undefined,
      schemaData:     source === "database"   ? sourceData : undefined,
      confluenceData: source === "confluence" ? sourceData : undefined,
      jiraData:       source === "jira"       ? sourceData : undefined,
      notionData:     source === "notion"     ? sourceData : undefined,
      promptTemplate,
      sectionsToPopulate,
      sectionItems,   // sub-item names per section — used by responseFormat()
      sectionLabels: sectionLabels || SECTION_LABELS,
      orgContext,
    });
  },

  // Build ask system + user message — contextParts is { github: data, database: data, ... }
  buildAsk({ contextParts = {}, ktContext, question }) {
    // Format each source's context
    let githubContext     = contextParts.github     ? ASK_PROMPT.formatGithubContext(contextParts.github)         : "";
    let dbContext         = contextParts.database   ? DATABASE_PROMPT.formatSchema(contextParts.database)          : null;
    let confluenceContext = contextParts.confluence ? CONFLUENCE_PROMPT.formatPages(contextParts.confluence)       : null;
    let jiraContext       = contextParts.jira       ? `JIRA:\n${JIRA_PROMPT.formatData(contextParts.jira)}`        : null;
    let notionContext     = contextParts.notion     ? `NOTION:\n${NOTION_PROMPT.formatData(contextParts.notion)}`  : null;

    return {
      system: ASK_PROMPT.system(orgContext),
      userMessage: ASK_PROMPT.userMessage({
        githubContext,
        ktContext,
        dbContext,
        confluenceContext,
        jiraContext,
        notionContext,
        question,
      }),
    };
  },
};