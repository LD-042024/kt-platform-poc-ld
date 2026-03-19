// ─────────────────────────────────────────────────────────────────────────────
// kt-platform/mcp-client.js
//
// MCP client — the layer between server.js and mcp-bridge.js.
//
// What it does:
//   1. getMcpTools()      — fetches available tools from mcp-bridge.js
//                           so Claude knows what it can call
//   2. executeTool()      — executes a single tool call via mcp-bridge.js
//                           when Claude requests one
//   3. runAgenticLoop()   — the core agentic loop:
//                           sends Claude the task + tools, executes whatever
//                           tools Claude calls, feeds results back, repeats
//                           until Claude produces its final answer
//
// Used by: server.js — /api/agent/populate route (GitHub MCP path only)
// Requires: mcp-bridge.js running on localhost:3002
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";

const MCP_BRIDGE_URL = process.env.GITHUB_MCP_URL || "http://localhost:3002";
const anthropic      = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── 1. Get tools from the MCP bridge ─────────────────────────────────────────
// Asks mcp-bridge.js what tools the GitHub MCP server exposes.
// Returns them in Anthropic tool format so Claude can understand and call them.
//
// Example tools returned:
//   - search_repositories  — find repos by keyword
//   - get_file_contents    — read a specific file from a repo
//   - list_issues          — get open issues for a repo
//   - list_commits         — get recent commits
//   - list_directory       — browse a folder in a repo

export async function getMcpTools() {
  try {
    const res = await fetch(`${MCP_BRIDGE_URL}/tools/list`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      signal:  AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`Failed to get MCP tools: ${res.status}`);

    const json = await res.json();
    if (json.error) throw new Error(`MCP tools/list error: ${json.error.message}`);

    const tools = json.result?.tools || [];

    // Convert from MCP tool format to Anthropic tool format
    // MCP format:       { name, description, inputSchema }
    // Anthropic format: { name, description, input_schema }
    return tools.map(tool => ({
      name:         tool.name,
      description:  tool.description,
      input_schema: tool.inputSchema || { type: "object", properties: {} },
    }));

  } catch (err) {
    throw new Error(`getMcpTools failed: ${err.message}`);
  }
}

// ── 2. Execute a single tool call ─────────────────────────────────────────────
// When Claude says "I want to call get_file_contents on dags/finops_daily.py",
// this function sends that request to mcp-bridge.js and returns the result.
//
// Parameters:
//   toolName  — e.g. "get_file_contents"
//   toolInput — e.g. { owner: "data-eng-test", repo: "finops-pipeline", path: "dags/finops_daily.py" }
//
// Returns the text content of the tool result as a string.

export async function executeTool(toolName, toolInput) {
  try {
    const res = await fetch(`${MCP_BRIDGE_URL}/tools/call`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        jsonrpc: "2.0",
        id:      1,
        method:  "tools/call",
        params:  { name: toolName, arguments: toolInput },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Tool call failed: ${res.status}`);

    const json = await res.json();
    if (json.error) throw new Error(`Tool error: ${json.error.message}`);

    // MCP returns results as a content array — extract the text block
    const content = json.result?.content || [];
    const text    = content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    return text || "(no content returned)";

  } catch (err) {
    throw new Error(`executeTool(${toolName}) failed: ${err.message}`);
  }
}

// ── 3. Agentic loop ───────────────────────────────────────────────────────────
// This is the core of MCP integration — the fundamental difference from REST.
//
// With REST:   server.js fetches fixed data → passes to Claude → one response
// With MCP:    Claude receives tools → calls what it needs → gets results →
//              calls more tools if needed → produces final answer
//
// Claude drives its own exploration. It reads the README, then decides to look
// at a DAG file, then reads architecture docs, then checks issues — exactly
// like a real engineer exploring an unfamiliar codebase.
//
// Parameters:
//   system        — system prompt (Claude's persona from prompts/github.js)
//   userPrompt    — the task (sections to draft, rules, response format)
//   tools         — tool list from getMcpTools()
//   maxIterations — safety limit to prevent infinite loops (default: 10)
//   onLog         — optional callback — streams each tool call to the
//                   frontend agent log panel in real time
//
// Returns: Claude's final text response (the JSON with drafted sections)

export async function runAgenticLoop({
  system,
  userPrompt,
  tools,
  maxIterations = 10,
  onLog,
}) {
  // Start conversation with the user's task as the first message
  const messages  = [{ role: "user", content: userPrompt }];
  let iterations  = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Call Claude with current message history and available tools
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4000,
      system,
      tools,
      messages,
    });

    // Add Claude's full response to message history
    // (important — history must include tool_use blocks for the loop to work)
    messages.push({ role: "assistant", content: response.content });

    // ── Claude is done — extract and return the final text ────────────────
    // stop_reason "end_turn" means Claude has finished and produced its answer
    if (response.stop_reason === "end_turn") {
      const finalText = response.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("");

      if (!finalText) throw new Error("Claude returned no text in final response");
      return finalText;
    }

    // ── Claude wants to call tools — execute them and feed results back ───
    // stop_reason "tool_use" means Claude is requesting one or more tool calls
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
      const toolResults   = [];

      for (const toolUse of toolUseBlocks) {
        // Stream the tool call to the frontend agent log
        if (onLog) {
          const inputPreview = JSON.stringify(toolUse.input).slice(0, 100);
          onLog(`   ↳ Claude calling: ${toolUse.name}(${inputPreview}${inputPreview.length >= 100 ? "…" : ""})`);
        }

        try {
          const result = await executeTool(toolUse.name, toolUse.input);

          toolResults.push({
            type:        "tool_result",
            tool_use_id: toolUse.id,    // must match the tool_use block id
            content:     result,
          });

        } catch (err) {
          // If a tool fails, tell Claude so it can try a different approach
          if (onLog) onLog(`   ⚠️  ${toolUse.name} failed: ${err.message}`);

          toolResults.push({
            type:        "tool_result",
            tool_use_id: toolUse.id,
            content:     `Error executing ${toolUse.name}: ${err.message}`,
            is_error:    true,
          });
        }
      }

      // Add all tool results as a user message — Claude reads these next turn
      // Also append a strict JSON reminder so Claude does not respond conversationally
      messages.push({
        role:    "user",
        content: [
          ...toolResults,
          {
            type: "text",
            text: "Now provide your final response. You MUST respond with ONLY the JSON object — no sentences, no preamble, no 'I now have' or any other text. Start immediately with { and end with }."
          }
        ]
      });

      // Loop continues — Claude will read the results and decide what to do next
    }
  }

  // Safety net — should not normally be reached with a well-behaved model
  throw new Error(
    `Agentic loop exceeded ${maxIterations} iterations without completing. ` +
    `Try increasing maxIterations or simplifying the task.`
  );
}