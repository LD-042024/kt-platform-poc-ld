// ─────────────────────────────────────────────────────────────────────────────
// kt-platform/mcp-bridge-jira.js
//
// Bridges the community Jira MCP server to HTTP so
// connectors/jira.js can call it via fetch().
//
// Identical pattern to mcp-bridge-confluence.js — just different package
// and port number.
//
// Package: @aashari/mcp-server-atlassian-jira (npm)
//   - Free, works with any Atlassian plan including free accounts
//   - Uses your existing API token — no extra auth setup needed
//   - Downloaded automatically by npx on first run
//
// REQUIRED ENV VARS (same as Confluence bridge):
//   ATLASSIAN_SITE_NAME  — site name only e.g. "mysite" from mysite.atlassian.net
//   ATLASSIAN_USER_EMAIL — your Atlassian account email
//   ATLASSIAN_API_TOKEN  — your Atlassian API token
//
// NOTE: Jira may be on a different site from Confluence.
// If so, add these Jira-specific overrides to your .env:
//   JIRA_ATLASSIAN_SITE_NAME=yourjirasite
//   JIRA_ATLASSIAN_USER_EMAIL=your@email.com
//   JIRA_ATLASSIAN_API_TOKEN=your-api-token
// Otherwise it falls back to the shared ATLASSIAN_* vars.
//
// Run with (Windows):
//   set ATLASSIAN_SITE_NAME=yoursite
//   set ATLASSIAN_USER_EMAIL=your@email.com
//   set ATLASSIAN_API_TOKEN=your-api-token
//   node mcp-bridge-jira.js
// ─────────────────────────────────────────────────────────────────────────────

import express             from "express";
import { spawn }           from "child_process";
import { createInterface } from "readline";

const PORT = process.env.JIRA_BRIDGE_PORT || 3004;

// Jira-specific env vars take priority, fall back to shared ATLASSIAN_* vars
// This handles the case where Jira is on a different site from Confluence
const ATLASSIAN_SITE_NAME = process.env.JIRA_ATLASSIAN_SITE_NAME || process.env.ATLASSIAN_SITE_NAME;
const ATLASSIAN_EMAIL     = process.env.JIRA_ATLASSIAN_USER_EMAIL || process.env.ATLASSIAN_USER_EMAIL || process.env.JIRA_EMAIL;
const ATLASSIAN_TOKEN     = process.env.JIRA_ATLASSIAN_API_TOKEN  || process.env.ATLASSIAN_API_TOKEN  || process.env.JIRA_TOKEN;

// Validate required env vars before starting
if (!ATLASSIAN_SITE_NAME || !ATLASSIAN_EMAIL || !ATLASSIAN_TOKEN) {
  console.error("❌  Missing required env vars. Set these before running:");
  console.error("    ATLASSIAN_SITE_NAME  (e.g. mysite from mysite.atlassian.net)");
  console.error("    ATLASSIAN_USER_EMAIL (your Atlassian account email)");
  console.error("    ATLASSIAN_API_TOKEN  (from id.atlassian.com → Security → API tokens)");
  console.error("");
  console.error("    If your Jira is on a different site from Confluence, use:");
  console.error("    JIRA_ATLASSIAN_SITE_NAME, JIRA_ATLASSIAN_USER_EMAIL, JIRA_ATLASSIAN_API_TOKEN");
  process.exit(1);
}

// ── Spawn the community Jira MCP server process ───────────────────────────────
// Same stdio pattern as mcp-bridge.js (GitHub) and mcp-bridge-confluence.js.
// npx downloads and runs the package automatically on first use.

const mcpProcess = spawn(
  "npx",
  ["-y", "@aashari/mcp-server-atlassian-jira"],
  {
    env: {
      ...process.env,
      // Required by @aashari/mcp-server-atlassian-jira
      ATLASSIAN_SITE_NAME:  ATLASSIAN_SITE_NAME,
      ATLASSIAN_USER_EMAIL: ATLASSIAN_EMAIL,
      ATLASSIAN_API_TOKEN:  ATLASSIAN_TOKEN,
    },
    stdio: ["pipe", "pipe", "inherit"],   // stdin + stdout piped, stderr passes through
    shell: true,                          // required on Windows
  }
);

mcpProcess.on("error", err => {
  console.error("❌  Failed to start Jira MCP server:", err.message);
  process.exit(1);
});

mcpProcess.on("exit", code => {
  console.log(`Jira MCP server exited with code ${code}`);
  process.exit(code || 0);
});

// Prevent EPIPE errors if stdin closes before we finish writing
mcpProcess.stdin.on("error", err => {
  if (err.code !== "EPIPE") console.error("stdin error:", err.message);
});

// ── JSON-RPC over stdio ───────────────────────────────────────────────────────
// Newline-delimited JSON over stdin/stdout — same as all other bridges.

let requestId = 1;
const pending = new Map();

const rl = createInterface({ input: mcpProcess.stdout });

rl.on("line", line => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || "MCP error"));
      else           resolve(msg.result);
    }
  } catch {
    // Ignore non-JSON lines during startup (package download messages etc.)
  }
});

// Send a JSON-RPC message to the MCP server and wait for the response
function mcpSend(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id  = requestId++;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    pending.set(id, { resolve, reject });
    mcpProcess.stdin.write(msg + "\n");

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`MCP request timed out (method: ${method})`));
      }
    }, 10000);
  });
}

// ── Initialise the MCP server ─────────────────────────────────────────────────
async function initMcp() {
  try {
    await mcpSend("initialize", {
      protocolVersion: "2024-11-05",
      capabilities:    {},
      clientInfo:      { name: "kt-platform-jira-bridge", version: "1.0.0" },
    });
    console.log("✓ Jira MCP server initialised");
  } catch (err) {
    console.error("❌  MCP initialisation failed:", err.message);
    process.exit(1);
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
// Same 3 endpoints as all other bridges.

const app = express();
app.use(express.json());

// ── GET /health ───────────────────────────────────────────────────────────────
// connectors/jira.js will ping this to detect MCP is running
app.get("/health", (req, res) => {
  res.json({ status: "ok", mode: "mcp-bridge-jira" });
});

// ── POST /tools/list ──────────────────────────────────────────────────────────
// Returns tools the Jira MCP server exposes e.g.:
//   get, post, put, patch, delete
// These allow Claude to call any Jira REST API endpoint it needs.

app.post("/tools/list", async (req, res) => {
  try {
    const result = await mcpSend("tools/list", {});
    res.json({ jsonrpc: "2.0", id: req.body.id || 1, result });
  } catch (err) {
    res.json({
      jsonrpc: "2.0",
      id:      req.body.id || 1,
      error:   { code: -32000, message: err.message },
    });
  }
});

// ── POST /tools/call ──────────────────────────────────────────────────────────
// Executes a tool call — forwards to the Jira MCP server via stdio

app.post("/tools/call", async (req, res) => {
  try {
    const { params } = req.body;
    const toolName   = params?.name;
    const toolArgs   = params?.arguments || {};

    const result = await mcpSend("tools/call", {
      name:      toolName,
      arguments: toolArgs,
    });

    res.json({ jsonrpc: "2.0", id: req.body.id || 1, result });
  } catch (err) {
    res.json({
      jsonrpc: "2.0",
      id:      req.body.id || 1,
      error:   { code: -32000, message: err.message },
    });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
// Wait 5 seconds for npx to download and start the package.

setTimeout(async () => {
  await initMcp();

  app.listen(PORT, () => {
    console.log(`\n🌉 Jira MCP Bridge running on http://localhost:${PORT}`);
    console.log(`   Package:   @aashari/mcp-server-atlassian-jira`);
    console.log(`   Site:      ${ATLASSIAN_SITE_NAME}.atlassian.net`);
    console.log(`   Email:     ${ATLASSIAN_EMAIL}`);
    console.log(`   Token:     ${ATLASSIAN_TOKEN ? "✓ set" : "✗ missing"}`);
    console.log(`\n   Endpoints:`);
    console.log(`   GET  /health       — connection check`);
    console.log(`   POST /tools/list   — get available tools`);
    console.log(`   POST /tools/call   — execute a tool\n`);
  });
}, 5000);