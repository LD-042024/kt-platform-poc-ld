// ─────────────────────────────────────────────────────────────────────────────
// kt-platform/mcp-bridge.js
//
// Bridges GitHub's stdio MCP server to HTTP so connectors/github.js can call it.
//
// What it does:
//   - Spawns the GitHub MCP server as a child process (stdio transport)
//   - Exposes HTTP endpoints on localhost:3002 that the connector calls
//   - Translates HTTP requests → JSON-RPC over stdin → responses back over HTTP
//
// Run with:
//   node mcp-bridge.js
//
// Requires GITHUB_TOKEN to be set before running:
//   Windows:  set GITHUB_TOKEN=ghp_yourtoken && node mcp-bridge.js
//   Mac/Linux: GITHUB_TOKEN=ghp_yourtoken node mcp-bridge.js
// ─────────────────────────────────────────────────────────────────────────────

import express          from "express";
import { spawn }        from "child_process";
import { createInterface } from "readline";

const PORT         = process.env.MCP_BRIDGE_PORT || 3002;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error("❌  GITHUB_TOKEN not set — set it before running mcp-bridge.js");
  process.exit(1);
}

// ── Spawn the GitHub MCP server process ──────────────────────────────────────
// The GitHub MCP server communicates via stdin/stdout (stdio transport).
// We pipe both so we can send requests and read responses programmatically.

const mcpProcess = spawn(
  "npx",
  ["-y", "@modelcontextprotocol/server-github"],
  {
    env:   { ...process.env, GITHUB_TOKEN },
    stdio: ["pipe", "pipe", "inherit"],   // stdin + stdout piped, stderr passes through
    shell: true,                          // required on Windows
  }
);

mcpProcess.on("error", err => {
  console.error("❌  Failed to start GitHub MCP server:", err.message);
  process.exit(1);
});

mcpProcess.on("exit", code => {
  console.log(`GitHub MCP server exited with code ${code}`);
  process.exit(code || 0);
});

// ── JSON-RPC over stdio ───────────────────────────────────────────────────────
// MCP protocol uses newline-delimited JSON messages over stdin/stdout.
// Each request gets a unique ID so responses can be matched back to requests.

let requestId = 1;
const pending = new Map();   // id → { resolve, reject }

// Read responses line by line from the MCP server's stdout
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
    // Ignore non-JSON lines that appear during startup
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
// This must complete before the HTTP server starts accepting requests.

async function initMcp() {
  try {
    await mcpSend("initialize", {
      protocolVersion: "2024-11-05",
      capabilities:    {},
      clientInfo:      { name: "kt-platform-bridge", version: "1.0.0" },
    });
    console.log("✓ GitHub MCP server initialised");
  } catch (err) {
    console.error("❌  MCP initialisation failed:", err.message);
    process.exit(1);
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
// Exposes 3 endpoints that connectors/github.js and mcp-client.js call.

const app = express();
app.use(express.json());

// ── GET /health ───────────────────────────────────────────────────────────────
// connectors/github.js pings this to detect whether MCP is running.
// Returns 200 OK if the bridge is up — that's all isMcpAvailable() checks for.

app.get("/health", (req, res) => {
  res.json({ status: "ok", mode: "mcp-bridge" });
});

// ── POST /tools/list ──────────────────────────────────────────────────────────
// mcp-client.js calls this to get the full list of tools the GitHub MCP server
// exposes. The list is passed to Claude so it knows what it can call.
// Returns tools like: search_repositories, get_file_contents, list_issues, etc.

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
// Called when Claude (via mcp-client.js) or the connector wants to execute
// a specific tool — e.g. get_file_contents, search_repositories, list_issues.
// Forwards the tool call to the GitHub MCP server and returns the result.

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
// Wait 1.5 seconds for the MCP process to start up before sending initialise.
// Then start the HTTP server once initialisation succeeds.

setTimeout(async () => {
  await initMcp();

  app.listen(PORT, () => {
    console.log(`\n🌉 MCP Bridge running on http://localhost:${PORT}`);
    console.log(`   GitHub MCP server: connected via stdio`);
    console.log(`   Token:             ${GITHUB_TOKEN ? "✓ set" : "✗ missing"}`);
    console.log(`\n   Endpoints:`);
    console.log(`   GET  /health       — connection check`);
    console.log(`   POST /tools/list   — get available tools`);
    console.log(`   POST /tools/call   — execute a tool\n`);
  });
}, 1500);