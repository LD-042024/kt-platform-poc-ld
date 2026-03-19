// ─────────────────────────────────────────────────────────────────────────────
// connectors/jira.js
//
// ENV VARS:
//   JIRA_URL      — e.g. https://mycompany.atlassian.net
//   JIRA_EMAIL    — Atlassian account email
//   JIRA_TOKEN    — API token
//   JIRA_PROJECT  — Default project key e.g. "DE" or "DATA"
//   JIRA_MCP_URL  — MCP bridge URL (optional, default: http://localhost:3004)
// ─────────────────────────────────────────────────────────────────────────────

const JIRA_URL     = process.env.JIRA_URL;
const JIRA_PROJECT = process.env.JIRA_PROJECT || "";

// MCP bridge URL — pings this to detect if mcp-bridge-jira.js is running
const JIRA_MCP_URL = process.env.JIRA_MCP_URL || "http://localhost:3004";

const jiraHeaders = () => ({
  Authorization: `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString("base64")}`,
  Accept:        "application/json",
});

async function jiraFetch(path) {
  const res = await fetch(`${JIRA_URL}/rest/api/3${path}`, { headers: jiraHeaders() });
  if (!res.ok) throw new Error(`Jira API ${res.status}: ${path}`);
  return res.json();
}

// Ping the MCP bridge health endpoint to detect if it is running.
// Returns true if mcp-bridge-jira.js is running on localhost:3004.
// Falls back silently to REST if not available.
async function isMcpAvailable() {
  try {
    const res = await fetch(`${JIRA_MCP_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

export const jiraConnector = {
  meta: {
    label:       "Jira",
    icon:        "🎯",
    description: "Epics, bugs, tech debt tickets, open issues",
    docsUrl:     "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
    envVars: [
      { key: "JIRA_URL",     label: "Jira URL",       required: true,  hint: "https://yourco.atlassian.net" },
      { key: "JIRA_EMAIL",   label: "Account Email",  required: true,  hint: "your@email.com" },
      { key: "JIRA_TOKEN",   label: "API Token",      required: true,  hint: "From id.atlassian.com → Security → API tokens" },
      { key: "JIRA_PROJECT", label: "Project Key",    required: false, hint: "e.g. DE or DATA" },
      { key: "JIRA_MCP_URL", label: "MCP Bridge URL", required: false, hint: "Default: http://localhost:3004" },
    ],
    sectionsSupported: ["known_issues", "runbooks", "biz_context"],
  },

  isConfigured: () => !!(process.env.JIRA_URL && process.env.JIRA_EMAIL && process.env.JIRA_TOKEN),

  async testConnection() {
    await jiraFetch("/myself");
    return true;
  },

  // Returns "mcp" or "rest" depending on whether mcp-bridge-jira.js is running.
  // Used by the Sources tab to show connection mode in the UI.
  getConnectionMode: async () => {
    return (await isMcpAvailable()) ? "mcp" : "rest";
  },

  async fetch({ keyword, projectKey }) {
    const project = projectKey || JIRA_PROJECT;
    const useMcp  = await isMcpAvailable();

    const jql = encodeURIComponent(
      `project = "${project}" AND (summary ~ "${keyword}" OR description ~ "${keyword}" OR labels = "${keyword}") ORDER BY updated DESC`
    );

    // CHANGE: updated from /search? to /search/jql? — older endpoint returns 410 on newer Jira sites
    const data = await jiraFetch(`/search/jql?jql=${jql}&maxResults=30&fields=summary,status,priority,labels,issuetype,description,assignee,created,updated`);

    const issues = (data.issues || []).map(i => ({
      key:         i.key,
      summary:     i.fields.summary,
      type:        i.fields.issuetype?.name,
      status:      i.fields.status?.name,
      priority:    i.fields.priority?.name,
      labels:      i.fields.labels || [],
      assignee:    i.fields.assignee?.displayName,
      url:         `${JIRA_URL}/browse/${i.key}`,
      description: i.fields.description?.content?.[0]?.content?.[0]?.text?.slice(0, 300) || "",
      updated:     i.fields.updated?.split("T")[0],
    }));

    // mode is returned so server.js can log "connected via MCP" or "connected via REST"
    // and future agentic loop can check sourceData.mode === "mcp"
    return { issues, projectKey: project, mode: useMcp ? "mcp" : "rest" };
  },
};