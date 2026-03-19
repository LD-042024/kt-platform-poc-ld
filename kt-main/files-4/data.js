// ─── Constants ────────────────────────────────────────────────────────────────

export const PHASES = ["Planning", "KT Sessions", "Reverse KT", "Sign-off"];

export const CLIENT_COLORS = {
  "Acme Corp":"#0d9488","FinBank Ltd":"#2563eb","RetailCo":"#d97706",
  "HealthData Inc":"#7c3aed","TechStartup":"#db2777","LogisticsCo":"#ea580c","Custom":"#64748b"
};

export const SECTION_DEFS = [
  { id:"biz_context",   icon:"🏢", label:"Business Context",   group:"DOCUMENTATION",
    desc:"Why this project exists, who depends on it, cost of failure.",
    fields:[
      { key:"lineOfBusiness", label:"Line of Business", type:"multiselect-custom", options:["Retail Banking","Corporate Banking","Investment Banking","Insurance","Wealth Management","Operations","Finance","Risk","Compliance","Technology","HR","Marketing","Supply Chain","Customer Service","Other"] },
      { key:"capability",     label:"Capability Area",  type:"multiselect-custom", options:["Analytics & Reporting","Data Engineering","ML/AI","Finance","Operations","Marketing","Product","Risk & Compliance","Customer Data","Other"] },
      { key:"priority",       label:"Priority",         type:"select",             options:["Critical","High","Medium","Low"] },
      { key:"docStatus",      label:"Doc Status",       type:"select",             options:["—","Draft","Reviewed","Approved"] },
    ]
  },
  { id:"data_context",  icon:"📦", label:"Data Context",       group:"DOCUMENTATION",
    desc:"Domain glossary, entity definitions, data lineage narrative.",
    fields:[
      { key:"domain",      label:"Data Domain",      type:"multiselect-custom", options:["Transactional","Behavioural","Reference","Master Data","Analytical","Streaming","External/3rd Party"] },
      { key:"sensitivity", label:"Data Sensitivity", type:"multiselect-custom", options:["Public","Internal","Confidential","Restricted/PII","Highly Sensitive"] },
      { key:"docStatus",   label:"Doc Status",       type:"select",             options:["—","Draft","Reviewed","Approved"] },
    ]
  },
  { id:"pipelines",     icon:"🔁", label:"Pipeline Inventory", group:"DOCUMENTATION",
    desc:"All pipelines, schedules, dependencies, failure behaviour.",
    fields:[
      { key:"type",      label:"Pipeline Type", type:"multiselect-custom", options:["Batch","Streaming","Micro-batch","API Pull","CDC","Event-triggered","dbt Model","Reverse ETL"] },
      { key:"frequency", label:"Frequency",     type:"select-custom",      options:["Real-time","Hourly","Every 4h","Daily","Weekly","Monthly","Manual","Event-triggered"] },
      { key:"docStatus", label:"Doc Status",    type:"select",             options:["—","Draft","Reviewed","Verified Live"] },
    ]
  },
  { id:"data_sources",  icon:"🗄", label:"Data Sources",       group:"DOCUMENTATION",
    desc:"Source systems, ingestion methods, refresh cadence, access.",
    fields:[
      { key:"sourceType", label:"Source Type",   type:"multiselect-custom", options:["Operational DB","Data Warehouse","REST API","GraphQL API","File/S3/GCS","Kafka/Event Stream","FTP/SFTP","SaaS Platform","Third-party Feed"] },
      { key:"access",     label:"Access Method", type:"multiselect-custom", options:["Direct Connection","Service Account","API Key","OAuth","VPN Required","IP Whitelist","Read Replica"] },
      { key:"docStatus",  label:"Doc Status",    type:"select",             options:["—","Draft","Reviewed","Verified"] },
    ]
  },
  { id:"environment",   icon:"🌐", label:"Environment",        group:"DOCUMENTATION",
    desc:"Dev / staging / prod configs, credentials, tool versions.",
    fields:[
      { key:"env",       label:"Environment",   type:"multiselect-custom", options:["Development","Staging","UAT","Production","DR / Backup","Sandbox"] },
      { key:"cloud",     label:"Cloud/Infra",   type:"multiselect-custom", options:["AWS","GCP","Azure","On-premise","Hybrid","Multi-cloud"] },
      { key:"docStatus", label:"Access Status", type:"select",             options:["—","Access Pending","Access Granted","Credentials Shared","Verified Working"] },
    ]
  },
  { id:"infrastructure",icon:"☁️", label:"Infrastructure",     group:"DOCUMENTATION",
    desc:"Cloud setup, orchestration platform, compute resources.",
    fields:[
      { key:"orchestrator", label:"Orchestrator", type:"multiselect-custom", options:["Apache Airflow","Prefect","Dagster","dbt Cloud","AWS Glue","Azure Data Factory","Google Cloud Composer","Custom/Cron","None"] },
      { key:"compute",      label:"Compute",      type:"multiselect-custom", options:["Serverless","Kubernetes","EC2/VM","Spark Cluster","Databricks","Snowpark","BigQuery","Redshift","On-premise"] },
      { key:"docStatus",    label:"Doc Status",   type:"select",             options:["—","Draft","Reviewed","Diagram Available"] },
    ]
  },
  { id:"data_quality",  icon:"📊", label:"Data Quality",       group:"DOCUMENTATION",
    desc:"Validation rules, SLAs, monitoring setup, known anomalies.",
    fields:[
      { key:"framework", label:"DQ Framework", type:"multiselect-custom", options:["Great Expectations","dbt Tests","Soda","Monte Carlo","Custom Scripts","Manual Checks","None"] },
      { key:"slaType",   label:"SLA Type",     type:"select-custom",      options:["None defined","Best effort","T+1 (next day)","T+4h","T+1h","Near real-time","Real-time"] },
      { key:"docStatus", label:"Doc Status",   type:"select",             options:["—","Draft","Rules Documented","Monitoring Active"] },
    ]
  },
  { id:"runbooks",      icon:"📋", label:"Runbooks",           group:"DOCUMENTATION",
    desc:"Step-by-step ops for common tasks, incident response, on-call.",
    fields:[
      { key:"runbookType", label:"Runbook Type", type:"multiselect-custom", options:["Incident Response","Pipeline Restart","Backfill Process","Data Correction","Access Provisioning","Monitoring Setup","Deployment","Rollback"] },
      { key:"complexity",  label:"Complexity",   type:"select",             options:["Simple (< 5 steps)","Medium (5–15 steps)","Complex (15+ steps / branching)"] },
      { key:"docStatus",   label:"Doc Status",   type:"select",             options:["—","Draft","Reviewed","Tested in Prod"] },
    ]
  },
  { id:"known_issues",  icon:"⚠️", label:"Known Issues",       group:"DOCUMENTATION",
    desc:"Active bugs, tech debt, workarounds, risks inherited by new team.",
    fields:[
      { key:"issueType", label:"Issue Type", type:"multiselect-custom", options:["Bug","Tech Debt","Performance Bottleneck","Security Concern","Data Quality Issue","Deprecated Component","Missing Documentation","Vendor Risk"] },
      { key:"severity",  label:"Severity",   type:"select",             options:["Critical","High","Medium","Low","Informational"] },
      { key:"docStatus", label:"Status",     type:"select",             options:["—","In Progress","Workaround Exists","Accepted Risk","Resolved","Won't Fix"] },
    ]
  },
  { id:"contacts",      icon:"👥", label:"Contacts",           group:"DOCUMENTATION",
    desc:"Who owns what, upstream/downstream owners, escalation path.",
    fields:[
      { key:"role",     label:"Role",         type:"multiselect-custom", options:["Data Owner","Pipeline Owner","Data Steward","On-call Engineer","Stakeholder","Upstream Source Owner","Downstream Consumer","Vendor Contact","Security/Compliance"] },
      { key:"team",     label:"Team",         type:"multiselect-custom", options:["Data Engineering","Analytics","Data Science","Platform/Infra","Business","Product","Security","External/Vendor"] },
      { key:"docStatus",label:"Intro Status", type:"select",             options:["—","Introduction Scheduled","Introduced","Handover Meeting Done"] },
    ]
  },
  { id:"kt_sessions",  icon:"🤝", label:"KT Sessions",  group:"KT PROCESS", isSpecial:"sessions",  desc:"Log of handover sessions — topics, attendees, open questions." },
  { id:"reverse_kt",   icon:"🔄", label:"Reverse KT",   group:"KT PROCESS", isSpecial:"reverseKT",
    desc:"Topics demonstrated back by incoming team to confirm understanding.",
    fields:[
      { key:"complexity", label:"Complexity", type:"select", options:["Foundational","Intermediate","Advanced","Expert"] },
      { key:"docStatus",  label:"Status",     type:"select", options:["—","Scheduled","Demonstrated","Passed","Needs Repeat"] },
    ]
  },
  { id:"day1_kit", icon:"🚨", label:"Day 1 Kit", group:"COMPLETION", isSpecial:"day1",    desc:"Auto-compiled survival guide for the incoming team." },
  { id:"signoff",  icon:"✅", label:"Sign-off",  group:"COMPLETION", isSpecial:"signoff", desc:"Formal handover acceptance with caveats documented." },
];

export const DEFAULT_CHECKLIST_ITEMS = {
  biz_context:   ["Business objective & problem statement","Data consumers & downstream stakeholders","SLA commitments & business impact of failure","Key business decisions this data powers","Historical context & major decisions made","Success metrics & KPIs tracked"],
  data_context:  ["Domain glossary & business definitions","Core entity definitions (customer, order, event…)","Data lineage narrative (source → transform → output)","Data ownership & stewardship model","Sensitive / PII data inventory","Data retention & archival policies"],
  pipelines:     ["Complete pipeline/DAG inventory list","Pipeline dependency map & execution order","Schedule & trigger documentation","Expected runtime & SLA thresholds","Failure modes & retry / alerting logic","Data volume & growth trends"],
  data_sources:  ["Source system inventory with owners","Ingestion method per source","Refresh cadence & latency expectations","Schema documentation per source","Source system contacts & escalation","Known data quality issues per source"],
  environment:   ["Environment overview (dev / staging / prod)","Connection strings & endpoint documentation","Secrets & credentials management process","Tool versions & compatibility matrix","Access provisioning guide for new team","VPN / network access requirements"],
  infrastructure:["Cloud architecture overview","Orchestration platform setup","Compute & storage resources inventory","Infrastructure-as-code repo & docs","Deployment & CI/CD pipeline","Cost overview & budget owners"],
  data_quality:  ["Data quality rules & validation logic","Quality monitoring & alerting setup","SLA definitions & breach process","Known recurring data anomalies & workarounds","Data reconciliation processes","Quality dashboard / reporting links"],
  runbooks:      ["Pipeline failure triage & resolution","Data backfill process","Incident response playbook","On-call rotation & escalation path","Common operational tasks (restart, rerun)","Monitoring dashboards & how to read them"],
  known_issues:  ["Open bug inventory with severity","Tech debt register & priority","Active workarounds & their risks","Performance bottlenecks & limits","Security vulnerabilities & mitigations","Deprecated components still in use"],
  contacts:      ["Data / pipeline owner contacts","Upstream source system owners","Downstream consumer contacts","On-call engineer & escalation chain","Business stakeholder contacts","Vendor / third-party contacts"],
  reverse_kt:    ["Business context & data context walkthrough","Pipeline inventory & dependency explanation","Environment setup & access walkthrough","Infrastructure & deployment demo","Runbook execution (live incident simulation)","Data quality rules & monitoring demo","End-to-end pipeline run & troubleshooting"],
};

export const DEFAULT_TEMPLATES = [
  { id:"tpl_quick",   name:"Quick Handoff",       scanDepth:"Surface", focusAreas:["Code structure","Documentation"],    outputStyle:"Bullet points",    customContext:"", perSection:{} },
  { id:"tpl_full",    name:"Full DE Project",      scanDepth:"Medium",  focusAreas:["Code structure","Data inventory","Known issues","Documentation"], outputStyle:"Short paragraphs", customContext:"", perSection:{} },
  { id:"tpl_comply",  name:"Compliance-Sensitive", scanDepth:"Surface", focusAreas:["Data inventory","Security signals"], outputStyle:"Short paragraphs", customContext:"Focus on PII data, access controls, audit logs and compliance requirements.", perSection:{ data_sources:"Deep", data_context:"Deep", known_issues:"Deep" } },
  { id:"tpl_legacy",  name:"Legacy Migration",     scanDepth:"Deep",    focusAreas:["Known issues","Code structure"],     outputStyle:"Short paragraphs", customContext:"Focus heavily on tech debt, deprecated components, undocumented workarounds.", perSection:{ known_issues:"Deep", pipelines:"Deep", runbooks:"Deep" } },
  { id:"tpl_onboard", name:"New Team Onboarding",  scanDepth:"Medium",  focusAreas:["Documentation","Data inventory","Code structure"], outputStyle:"Short paragraphs", customContext:"Prioritise business context, data glossary and key contacts for onboarding.", perSection:{ biz_context:"Deep", data_context:"Deep", contacts:"Deep" } },
];

// ─── Factories ────────────────────────────────────────────────────────────────

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function initProjectData(projectId) {
  const checklist = {};
  SECTION_DEFS.forEach(sec => {
    if (sec.isSpecial) return;
    const items = DEFAULT_CHECKLIST_ITEMS[sec.id] || [];
    checklist[sec.id] = items.map(item => ({
      item, notes: "", link: "", status: "Not Started",
      ...Object.fromEntries((sec.fields || []).map(f => [
        f.key,
        f.type === 'multiselect-custom' ? [] : (f.options?.[0] || ""),
      ]))
    }));
  });
  const reverseKT = (DEFAULT_CHECKLIST_ITEMS.reverse_kt || []).map(item => ({
    item, status: "Not Started", complexity: "Intermediate",
    demonstratedBy: "", notes: "", link: ""
  }));
  return {
    id: projectId, checklist, reverseKT, sessions: [], agentDrafts: {},
    signoff: { outgoingName:"", outgoingRole:"", outgoingConfirmed:false, incomingName:"", incomingRole:"", incomingConfirmed:false, caveats:"", signedAt:null },
  };
}

export function initAppState() {
  return {
    projects: [],
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    serverUrl: "http://localhost:3001",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcProgress(projectData) {
  if (!projectData) return 0;
  let total = 0, done = 0;
  Object.values(projectData.checklist || {}).forEach(items =>
    items.forEach(i => { total++; if (i.status === "Done") done++; })
  );
  (projectData.reverseKT || []).forEach(i => { total++; if (i.status === "Passed") done++; });
  return total ? Math.round((done / total) * 100) : 0;
}

export function calcSectionProgress(items) {
  if (!items?.length) return 0;
  return Math.round(items.filter(i => i.status === "Done" || i.status === "Passed").length / items.length * 100);
}

export function countBlocked(projectData) {
  if (!projectData) return 0;
  let n = 0;
  Object.values(projectData.checklist || {}).forEach(items =>
    items.forEach(i => { if (i.status === "Blocked") n++; })
  );
  return n;
}

export function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
  } catch { return iso || ""; }
}

export function clientColor(name) { return CLIENT_COLORS[name] || "#64748b"; }

export function safeUrl(url) {
  if (!url || typeof url !== "string") return "#";
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/") || t.startsWith("./")) return t;
  return "#";
}
