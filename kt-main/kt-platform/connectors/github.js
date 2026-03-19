// ─────────────────────────────────────────────────────────────────────────────
// connectors/github.js
//
// GitHub connector — uses the official GitHub MCP server when available,
// falls back to direct REST API if MCP is not running.
//
// MCP SERVER:  github/github-mcp-server  (Docker or npx)
//   Docker:   docker run -e GITHUB_PERSONAL_ACCESS_TOKEN=... ghcr.io/github/github-mcp-server
//   npx:      npx @modelcontextprotocol/server-github
//
// ENV VARS (in .env):
//   GITHUB_TOKEN        — Personal access token (scopes: repo, read:org)
//   GITHUB_ORG          — Your org slug e.g. "my-company"  (optional)
//   GITHUB_MCP_URL      — MCP server URL if running separately (optional)
//                         defaults to http://localhost:3002
// ─────────────────────────────────────────────────────────────────────────────

const GITHUB_TOKEN   = process.env.GITHUB_TOKEN;
const GITHUB_ORG     = process.env.GITHUB_ORG || "";
const GITHUB_MCP_URL = process.env.GITHUB_MCP_URL || "http://localhost:3002";

// ── MCP client helper ─────────────────────────────────────────────────────────
// Calls a tool on the GitHub MCP server (JSON-RPC 2.0 over HTTP)
async function mcpCall(toolName, args) {
  const res = await fetch(`${GITHUB_MCP_URL}/tools/call`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } }),
    signal:  AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`MCP call failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`MCP error: ${json.error.message}`);
  // MCP returns content array; first text block is the payload
  const text = json.result?.content?.find(c => c.type === "text")?.text;
  if (!text) throw new Error("MCP returned empty content");
  return JSON.parse(text);
}

// ── REST API fallback ─────────────────────────────────────────────────────────
const ghHeaders = () => ({
  Authorization:          `Bearer ${GITHUB_TOKEN}`,
  Accept:                 "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

async function restFetch(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub REST ${res.status}: ${path}`);
  return res.json();
}

// ── Check if MCP server is reachable ─────────────────────────────────────────
async function isMcpAvailable() {
  try {
    const res = await fetch(`${GITHUB_MCP_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Unified fetch functions (MCP preferred, REST fallback) ───────────────────

async function searchRepos(keyword) {
  const useMcp = await isMcpAvailable();

  if (useMcp) {
    const data = await mcpCall("search_repositories", {
      query: GITHUB_ORG ? `${keyword} org:${GITHUB_ORG}` : keyword,
      perPage: 5,
    });
    return (data.items || []).map(r => ({
      name:          r.name,
      fullName:      r.full_name,
      description:   r.description,
      language:      r.language,
      stars:         r.stargazers_count,
      updatedAt:     r.updated_at,
      defaultBranch: r.default_branch,
      topics:        r.topics || [],
    }));
  }

  // REST fallback
  const q = encodeURIComponent(keyword + (GITHUB_ORG ? ` org:${GITHUB_ORG}` : ""));
  const data = await restFetch(`/search/repositories?q=${q}&sort=updated&per_page=5`);
  return (data.items || []).map(r => ({
    name:          r.name,
    fullName:      r.full_name,
    description:   r.description,
    language:      r.language,
    stars:         r.stargazers_count,
    updatedAt:     r.updated_at,
    defaultBranch: r.default_branch,
    topics:        r.topics || [],
  }));
}

async function getReadme(fullName, maxChars = 2000) {
  try {
    const useMcp = await isMcpAvailable();
    let content;

    if (useMcp) {
      const data = await mcpCall("get_file_contents", { owner: fullName.split("/")[0], repo: fullName.split("/")[1], path: "README.md" });
      content = data.content ? Buffer.from(data.content, "base64").toString("utf-8") : data.content;
    } else {
      const data = await restFetch(`/repos/${fullName}/readme`);
      content = Buffer.from(data.content, "base64").toString("utf-8");
    }

    return content ? content.slice(0, maxChars) + (content.length > maxChars ? "\n...[truncated]" : "") : null;
  } catch { return null; }
}

async function getFileTree(fullName, branch) {
  try {
    const useMcp = await isMcpAvailable();

    if (useMcp) {
      const [owner, repo] = fullName.split("/");
      const data = await mcpCall("list_directory", { owner, repo, path: "", branch });
      return (data || []).slice(0, 40).map(f => ({ path: f.name, type: f.type === "dir" ? "tree" : "blob" }));
    }

    const data = await restFetch(`/repos/${fullName}/git/trees/${branch}`);
    return (data.tree || [])
      .filter(f => !["node_modules", ".git"].includes(f.path))
      .slice(0, 40)
      .map(f => ({ path: f.path, type: f.type }));
  } catch { return []; }
}

async function getOpenIssues(fullName) {
  try {
    const useMcp = await isMcpAvailable();

    if (useMcp) {
      const [owner, repo] = fullName.split("/");
      const data = await mcpCall("list_issues", { owner, repo, state: "open", perPage: 10 });
      return (data || []).map(i => ({
        title:     i.title,
        labels:    (i.labels || []).map(l => l.name),
        createdAt: i.created_at,
      }));
    }

    const data = await restFetch(`/repos/${fullName}/issues?state=open&per_page=10&sort=updated`);
    return (data || []).map(i => ({
      title:     i.title,
      labels:    (i.labels || []).map(l => l.name),
      createdAt: i.created_at,
    }));
  } catch { return []; }
}

async function getRecentCommits(fullName, branch) {
  try {
    const useMcp = await isMcpAvailable();

    if (useMcp) {
      const [owner, repo] = fullName.split("/");
      const data = await mcpCall("list_commits", { owner, repo, sha: branch, perPage: 10 });
      return (data || []).map(c => ({
        message: c.commit.message.split("\n")[0].slice(0, 100),
        author:  c.commit.author.name,
        date:    c.commit.author.date,
      }));
    }

    const data = await restFetch(`/repos/${fullName}/commits?sha=${branch}&per_page=10`);
    return (data || []).map(c => ({
      message: c.commit.message.split("\n")[0].slice(0, 100),
      author:  c.commit.author.name,
      date:    c.commit.author.date,
    }));
  } catch { return []; }
}

// ── Connector export ──────────────────────────────────────────────────────────
export const githubConnector = {
  meta: {
    label:       "GitHub",
    icon:        "🐙",
    description: "Repos, READMEs, issues, commits, file trees",
    docsUrl:     "https://github.com/github/github-mcp-server",
    envVars: [
      { key: "GITHUB_TOKEN", label: "Personal Access Token", required: true,  hint: "Scopes: repo, read:org" },
      { key: "GITHUB_ORG",   label: "Organisation Slug",     required: false, hint: "e.g. my-company" },
      { key: "GITHUB_MCP_URL", label: "MCP Server URL",      required: false, hint: "Default: http://localhost:3002" },
    ],
    mcpServer: {
      name:    "github-mcp-server",
      install: "docker run -e GITHUB_PERSONAL_ACCESS_TOKEN=$GITHUB_TOKEN ghcr.io/github/github-mcp-server",
      alt:     "npx @modelcontextprotocol/server-github",
    },
    sectionsSupported: ["biz_context", "pipelines", "data_sources", "infrastructure", "data_quality", "known_issues", "contacts"],
  },

  isConfigured: () => !!process.env.GITHUB_TOKEN,

  async testConnection() {
    const mcpUp = await isMcpAvailable();
    if (mcpUp) {
      await mcpCall("search_repositories", { query: "test", perPage: 1 });
      return true;
    }
    // Fallback: test REST token
    await restFetch("/user");
    return true;
  },

  async getConnectionMode() {
    return (await isMcpAvailable()) ? "mcp" : "rest";
  },

  async fetch({ keyword }) {
    const repos = await searchRepos(keyword);
    if (!repos.length) return null;

    const top = repos[0];
    const [readme, fileTree, issues, commits] = await Promise.all([
      getReadme(top.fullName),
      getFileTree(top.fullName, top.defaultBranch),
      getOpenIssues(top.fullName),
      getRecentCommits(top.fullName, top.defaultBranch),
    ]);

    return { repos, readme, fileTree, issues, commits, mode: await this.getConnectionMode() };
  },
};
