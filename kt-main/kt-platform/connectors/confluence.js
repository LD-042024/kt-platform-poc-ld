// ─────────────────────────────────────────────────────────────────────────────
// connectors/confluence.js
//
// ENV VARS (in .env):
//   CONFLUENCE_URL      — e.g. https://mycompany.atlassian.net
//   CONFLUENCE_EMAIL    — Atlassian account email
//   CONFLUENCE_TOKEN    — API token from id.atlassian.com/manage-profile/security
//   CONFLUENCE_SPACE    — Default space key e.g. "DE" or "DATA"
//   CONFLUENCE_MCP_URL  — MCP server URL (optional, default: http://localhost:3003)
//
// MCP SERVER (optional, uses Atlassian's official MCP):
//   npx @atlassian/mcp-server-confluence
// ─────────────────────────────────────────────────────────────────────────────

const CONF_URL     = process.env.CONFLUENCE_URL;
const CONF_EMAIL   = process.env.CONFLUENCE_EMAIL;
const CONF_TOKEN   = process.env.CONFLUENCE_TOKEN;
const CONF_SPACE   = process.env.CONFLUENCE_SPACE || "";
const CONF_MCP_URL = process.env.CONFLUENCE_MCP_URL || "http://localhost:3003";

const confHeaders = () => ({
  Authorization: `Basic ${Buffer.from(`${CONF_EMAIL}:${CONF_TOKEN}`).toString("base64")}`,
  Accept:        "application/json",
});

async function isMcpAvailable() {
  try {
    const res = await fetch(`${CONF_MCP_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

async function mcpCall(toolName, args) {
  const res = await fetch(`${CONF_MCP_URL}/tools/call`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } }),
    signal:  AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Confluence MCP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const text = json.result?.content?.find(c => c.type === "text")?.text;
  try { return JSON.parse(text); } catch { return text; }
}

async function searchPages(keyword, spaceKey) {
  const space = spaceKey || CONF_SPACE;
  // const useMcp = await isMcpAvailable();

  // if (useMcp) {
  //   return mcpCall("confluence_search", {
  //     query: `${keyword} space:${space}`,
  //     limit: 20,
  //   });
  // }

  // REST fallback — Confluence Cloud v2
  const cql = encodeURIComponent(
    `space = "${space}" AND (title ~ "${keyword}" OR text ~ "${keyword}" OR label in ("runbook","adr","data-dictionary","kt","architecture")) ORDER BY lastmodified DESC`
  );
  const res = await fetch(`${CONF_URL}/wiki/rest/api/content/search?cql=${cql}&limit=20&expand=body.storage,metadata.labels,version`, {
    headers: confHeaders(),
  });
  if (!res.ok) throw new Error(`Confluence REST ${res.status}`);
  const data = await res.json();

  return (data.results || []).map(p => ({
    id:          p.id,
    title:       p.title,
    url:         `${CONF_URL}/wiki${p._links?.webui || ""}`,
    space:       p.space?.key,
    lastUpdated: p.version?.when?.split("T")[0],
    author:      p.version?.by?.displayName,
    labels:      (p.metadata?.labels?.results || []).map(l => l.name),
    excerpt:     p.body?.storage?.value
      ? p.body.storage.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500)
      : "",
  }));
}

export const confluenceConnector = {
  meta: {
    label:       "Confluence",
    icon:        "📝",
    description: "Wiki pages, runbooks, ADRs, design docs",
    docsUrl:     "https://developer.atlassian.com/cloud/confluence/rest/v2/",
    envVars: [
      { key: "CONFLUENCE_URL",   label: "Confluence URL",   required: true,  hint: "https://yourco.atlassian.net" },
      { key: "CONFLUENCE_EMAIL", label: "Account Email",    required: true,  hint: "your@email.com" },
      { key: "CONFLUENCE_TOKEN", label: "API Token",        required: true,  hint: "From id.atlassian.com → Security → API tokens" },
      { key: "CONFLUENCE_SPACE", label: "Default Space Key",required: false, hint: "e.g. DE or DATA" },
      { key: "CONFLUENCE_MCP_URL", label: "MCP Server URL", required: false, hint: "Default: http://localhost:3003" },
    ],
    mcpServer: {
      name:    "atlassian-mcp",
      install: "npx @atlassian/mcp-server-confluence",
    },
    sectionsSupported: ["runbooks", "known_issues", "contacts", "infrastructure", "biz_context"],
  },

  isConfigured: () => !!(process.env.CONFLUENCE_URL && process.env.CONFLUENCE_EMAIL && process.env.CONFLUENCE_TOKEN),

  // async testConnection() {
  //   const res = await fetch(`${CONF_URL}/wiki/rest/api/space?limit=1`, { headers: confHeaders() });
  //   if (!res.ok) throw new Error(`Confluence auth failed: ${res.status}`);
  //   return true;
  // },

  async testConnection() {
    const res = await fetch(`${CONF_URL}/wiki/rest/api/space?limit=1`, { headers: confHeaders() });
    if (!res.ok) throw new Error(`Confluence auth failed: ${res.status}`);
    return true;
  },

  getConnectionMode: async () => {
      return (await isMcpAvailable()) ? "mcp" : "rest";
  },

  // async fetch({ keyword, spaceKey }) {
  //   const pages = await searchPages(keyword, spaceKey);
  //   return { pages, spaceKey: spaceKey || CONF_SPACE };
  // },
  async fetch({ keyword, spaceKey }) {
    const useMcp = await isMcpAvailable();
    const pages  = await searchPages(keyword, spaceKey);
    return { pages, spaceKey: spaceKey || CONF_SPACE, mode: useMcp ? "mcp" : "rest" };
  },
};
