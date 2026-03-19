// ─────────────────────────────────────────────────────────────────────────────
// kt-platform/mcp-bridge-confluence.js
//
// Bridges the community Confluence MCP server to HTTP so
// connectors/confluence.js can call it via fetch().
//
// Uses the same spawn/stdio pattern as mcp-bridge.js (GitHub).
// Package: @aashari/mcp-server-atlassian-confluence (npm)
//   - Free, works with any Atlassian plan including free accounts
//   - Uses your existing API token — no extra auth setup needed
//   - Downloaded automatically by npx on first run
//
// REQUIRED ENV VARS:
//   ATLASSIAN_SITE_NAME  — site name only e.g. "mysite" from mysite.atlassian.net
//   ATLASSIAN_USER_EMAIL — your Atlassian account email
//   ATLASSIAN_API_TOKEN  — your Atlassian API token
//
// Run with (Windows):
//   set ATLASSIAN_SITE_NAME=yoursite
//   set ATLASSIAN_USER_EMAIL=your@email.com
//   set ATLASSIAN_API_TOKEN=your-api-token
//   node mcp-bridge-confluence.js
//
// NOTE: ATLASSIAN_SITE_NAME is the part BEFORE .atlassian.net
//   e.g. https://acme.atlassian.net → ATLASSIAN_SITE_NAME=acme
// ─────────────────────────────────────────────────────────────────────────────

import express             from "express";
import { spawn }           from "child_process";
import { createInterface } from "readline";

const PORT                = process.env.CONF_BRIDGE_PORT  || 3003;
const ATLASSIAN_SITE_NAME = process.env.ATLASSIAN_SITE_NAME;
const ATLASSIAN_EMAIL     = process.env.ATLASSIAN_USER_EMAIL || process.env.CONFLUENCE_EMAIL;
const ATLASSIAN_TOKEN     = process.env.ATLASSIAN_API_TOKEN  || process.env.CONFLUENCE_TOKEN;

// Validate required env vars before starting
if (!ATLASSIAN_SITE_NAME || !ATLASSIAN_EMAIL || !ATLASSIAN_TOKEN) {
  console.error("❌  Missing required env vars. Set these before running:");
  console.error("    ATLASSIAN_SITE_NAME  (e.g. mysite from mysite.atlassian.net)");
  console.error("    ATLASSIAN_USER_EMAIL (your Atlassian account email)");
  console.error("    ATLASSIAN_API_TOKEN  (from id.atlassian.com → Security → API tokens)");
  process.exit(1);
}

// ── Spawn the community Confluence MCP server process ────────────────────────
// Same stdio pattern as mcp-bridge.js — npx downloads and runs the package.
// Credentials are passed as environment variables to the child process.

const mcpProcess = spawn(
  "npx",
  ["-y", "@aashari/mcp-server-atlassian-confluence"],
  {
    env: {
      ...process.env,
      // Required by @aashari/mcp-server-atlassian-confluence
      ATLASSIAN_SITE_NAME:  ATLASSIAN_SITE_NAME,
      ATLASSIAN_USER_EMAIL: ATLASSIAN_EMAIL,
      ATLASSIAN_API_TOKEN:  ATLASSIAN_TOKEN,
    },
    stdio: ["pipe", "pipe", "inherit"],   // stdin + stdout piped, stderr passes through
    shell: true,                          // required on Windows
  }
);

mcpProcess.on("error", err => {
  console.error("❌  Failed to start Confluence MCP server:", err.message);
  process.exit(1);
});

mcpProcess.on("exit", code => {
  console.log(`Confluence MCP server exited with code ${code}`);
  process.exit(code || 0);
});

mcpProcess.stdin.on("error", err => {
  if (err.code !== "EPIPE") console.error("stdin error:", err.message);
});

// ── JSON-RPC over stdio ───────────────────────────────────────────────────────
// Same pattern as mcp-bridge.js — newline-delimited JSON over stdin/stdout.
// Each request gets a unique ID so responses can be matched back.

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

    // Timeout after 10 seconds — prevents hanging if MCP server is unresponsive
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`MCP request timed out (method: ${method})`));
      }
    }, 10000);
  });
}

// ── Initialise the MCP server ─────────────────────────────────────────────────
// MCP protocol requires an initialise handshake before any tool calls.

async function initMcp() {
  try {
    await mcpSend("initialize", {
      protocolVersion: "2024-11-05",
      capabilities:    {},
      clientInfo:      { name: "kt-platform-confluence-bridge", version: "1.0.0" },
    });
    console.log("✓ Confluence MCP server initialised");
  } catch (err) {
    console.error("❌  MCP initialisation failed:", err.message);
    process.exit(1);
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
// Exposes the same 3 endpoints as mcp-bridge.js so server.js and
// mcp-client.js can call this bridge identically to the GitHub bridge.

const app = express();
app.use(express.json());

// ── GET /health ───────────────────────────────────────────────────────────────
// connectors/confluence.js pings this to detect MCP is running
app.get("/health", (req, res) => {
  res.json({ status: "ok", mode: "mcp-bridge-confluence" });
});

// ── POST /tools/list ──────────────────────────────────────────────────────────
// Returns tools the Confluence MCP server exposes.
// This package provides 5 generic HTTP method tools:
//   get, post, put, patch, delete
// These allow Claude to call any Confluence REST API endpoint it needs.

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
// Executes a tool call — forwards to the Confluence MCP server via stdio
// and returns the result back to mcp-client.js

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
// Wait 3 seconds for npx to download and start the package.
// First run takes longer as npx downloads the package — subsequent runs
// use the cached version and start much faster.

setTimeout(async () => {
  await initMcp();

  app.listen(PORT, () => {
    console.log(`\n🌉 Confluence MCP Bridge running on http://localhost:${PORT}`);
    console.log(`   Package:   @aashari/mcp-server-atlassian-confluence`);
    console.log(`   Site:      ${ATLASSIAN_SITE_NAME}.atlassian.net`);
    console.log(`   Email:     ${ATLASSIAN_EMAIL}`);
    console.log(`   Token:     ${ATLASSIAN_TOKEN ? "✓ set" : "✗ missing"}`);
    console.log(`\n   Endpoints:`);
    console.log(`   GET  /health       — connection check`);
    console.log(`   POST /tools/list   — get available tools`);
    console.log(`   POST /tools/call   — execute a tool\n`);
  });
}, 5000);