# KT Tracker — Prompt Templates vs Prompt Files

> How they differ, how they relate, and how they work together to produce KT drafts

---

## 1 — What Prompt Templates Are (UI layer)

The templates on the **Templates page** are user-facing configuration. They are settings that control **how** Claude should approach the scan. They live entirely in the frontend in `data.js` and React state. They contain no actual prompt text.

Think of these as **dials and switches** — the user turns them to configure behaviour without writing any prompt text themselves.

```js
promptTemplate = {
    scanDepth:     "Medium",
    focusAreas:    ["Code structure", "Data inventory"],
    outputStyle:   "Short paragraphs",
    customContext: "Focus on PII data...",
    perSection:    { data_sources: "Deep" }
}
```

### The 5 built-in templates defined in `data.js`

| Template | Scan Depth | Focus Areas | Output Style | Custom Context |
|---|---|---|---|---|
| Quick Handoff | Surface | Code structure, Documentation | Bullet points | None |
| Full DE Project | Medium | Code structure, Data inventory, Known issues, Documentation | Short paragraphs | None |
| Compliance-Sensitive | Surface | Data inventory, Security signals | Short paragraphs | Focus on PII data, access controls, audit logs and compliance requirements. |
| Legacy Migration | Deep | Known issues, Code structure | Short paragraphs | Focus heavily on tech debt, deprecated components, undocumented workarounds. |
| New Team Onboarding | Medium | Documentation, Data inventory, Code structure | Short paragraphs | Prioritise business context, data glossary and key contacts for onboarding. |

---

## 2 — What Prompt Files Are (backend layer)

The files under `kt-platform/prompts/` (`github.js`, `confluence.js`, `jira.js`, `index.js`) are the **actual prompt engineering** — the full text instructions, rules, JSON schemas, and formatters that Claude receives. They contain the expertise about how to write good KT documentation.

Think of these as **expert knowledge baked into the application** — they don't change per user or per project.

```js
prompts/github.js = {
    system:                 "You are a senior DE KT specialist...",
    rules:                  ["Be concise", "Flag uncertain inferences...", ...],
    responseFormat():       builds the JSON schema Claude must return,
    templateInstructions(): converts the UI template into text,
    build():                assembles everything into the final prompt
}
```

---

## 3 — How They Relate — The Template Flows Into the Prompt File

The connection between the two layers is **`templateInstructions()`** in `prompts/github.js`. This function is the bridge — it converts the user's template settings into plain English instructions that Claude can read.

### The bridge function

```js
// In prompts/github.js
templateInstructions(promptTemplate) {
  return [
    `- Scan depth:   ${promptTemplate.scanDepth}`,
    `- Focus areas:  ${promptTemplate.focusAreas.join(", ")}`,
    `- Output style: ${promptTemplate.outputStyle}`,
    promptTemplate.customContext
      ? `- Custom notes: ${promptTemplate.customContext}`
      : null,
  ].filter(Boolean).join("\n");
}
```

### The flow from UI to Claude

| Step | Layer | What happens | Where |
|---|---|---|---|
| 1 | UI | User picks a template from the dropdown on Populate KT tab | `files-4/AgentStudio.jsx` — `proj.templateId` |
| 2 | UI | Template object resolved from app state | `const tpl = app.templates.find(t => t.id === proj.templateId)` |
| 3 | Bridge | Template sent to backend as `promptTemplate` | `POST /api/agent/populate` |
| 4 | Backend | Passed into prompt builder | `PROMPTS.buildPopulate({ promptTemplate, ... })` in `server.js` |
| 5 | Prompt file | Converted to plain English text block | `templateInstructions(promptTemplate)` in `prompts/github.js` |
| 6 | Prompt file | Injected near the top of the full prompt | `build()` places it above GitHub data and rules |
| 7 | Claude | Reads the `TEMPLATE INSTRUCTIONS` block alongside source data, rules, and JSON schema | Anthropic Claude API |

---

## 4 — What Claude Actually Receives

When you run the agent with **Full DE Project** selected for GitHub, this is the complete assembled prompt Claude receives — with inline comments showing which part came from where:

```
[orgContext block]                         ← from org-context.js, if fields are filled in

TEMPLATE INSTRUCTIONS:                     ← from promptTemplate via templateInstructions()
- Scan depth:   Medium
- Focus areas:  Code structure, Data inventory, Known issues, Documentation
- Output style: Short paragraphs
- Detail level: Balanced

GITHUB DATA:                               ← from connector.fetch() + formatContext()
REPOSITORIES (2 found):
• finops-pipeline [Python] — ...
FILE STRUCTURE (root): ...
README: ...
OPEN ISSUES (5): ...

TASK: Draft KT for: Business Context, Pipeline Inventory   ← from sectionsToPopulate

RULES:                                     ← from prompts/github.js rules array
1. Be concise — 2-4 sentences per section...
2. Only assert what you can infer from GitHub data...
3. Flag uncertain inferences with [inferred] or [verify]...

Respond ONLY with valid JSON:              ← from responseFormat(sectionsToPopulate, sectionItems)
{
  "biz_context": {
    "items": {
      "Business objective & problem statement": "...",
      "Data consumers & downstream stakeholders": "...",
      ...
    }
  }
}
KEY NAMES MUST BE EXACT: ...
CRITICAL: Start with { end with }...
```

The template contributes only the **TEMPLATE INSTRUCTIONS** block. Everything else — the system prompt, data formatting, drafting rules, JSON schema, and CRITICAL enforcement — comes from the prompt files.

---

## 5 — Key Distinctions at a Glance

| Property | Prompt Templates (UI) | Prompt Files (backend) |
|---|---|---|
| Who configures it | The user — via the Templates page | The developer — in code |
| What it contains | Configuration settings: depth, focus areas, output style, custom context | Actual prompt text, system instructions, drafting rules, JSON schemas |
| Where it lives | `files-4/data.js` → React state → saved to disk | `kt-platform/prompts/*.js` |
| Changes per project | Yes — each project picks a different template | No — same for all projects and all users |
| Claude sees it as | A few lines of `TEMPLATE INSTRUCTIONS` text | The main body of the prompt |
| Can user edit it | Yes — create, edit, delete on Templates page | No — requires a code change |
| Affects which connectors | GitHub only (currently) | All connectors — github, confluence, jira |

---

## 6 — Current Gap: Template Only Affects GitHub

`templateInstructions()` is only defined in `prompts/github.js`. The `confluence.js` and `jira.js` prompts do not have this function and their `build()` functions do not use `promptTemplate` at all.

This means:

- If you select **Legacy Migration** hoping Claude focuses on tech debt — only the GitHub scan will focus on tech debt
- Confluence and Jira Claude calls always use the same fixed rules regardless of which template is selected
- The `perSection` depth overrides are stored on the template object but not yet read by `templateInstructions()` — they are defined in the UI but not currently wired into any prompt

> **Pending fix:** Wire `promptTemplate` into `confluence.js` and `jira.js` `build()` functions using the same `templateInstructions()` pattern as `github.js`. Also wire `perSection` overrides so sections marked Deep get more detailed prompt instructions. Both are backend-only changes with no frontend impact.

---

## 7 — Summary: How They Work Together

The relationship is a clean separation of concerns between what the user controls and what the developer controls:

| Step | Layer | What happens |
|---|---|---|
| 1 | UI | User creates or selects a Prompt Template — sets scan depth, focus areas, output style, and optional custom context |
| 2 | UI | User selects that template from the dropdown on the Populate KT tab before clicking Run Agent |
| 3 | Bridge | `AgentStudio.jsx` resolves the template object and sends it as `promptTemplate` in the POST to `/api/agent/populate` |
| 4 | Backend | `server.js` passes `promptTemplate` to `PROMPTS.buildPopulate()`, which passes it into each connector's `build()` call |
| 5 | Prompt file | `prompts/github.js` `templateInstructions()` converts the template object into a plain English `TEMPLATE INSTRUCTIONS` block (3–5 lines of text) |
| 6 | Prompt file | `build()` assembles the full prompt: `orgContext` + `TEMPLATE INSTRUCTIONS` + GitHub data + `TASK` + `RULES` + `responseFormat` schema + `CRITICAL` enforcement |
| 7 | Claude | Reads the full assembled prompt. Template settings influence how Claude writes — e.g. Deep scan depth means up to 8 sentences, Bullet points style means Claude uses bullet formatting, custom context adds specific focus instructions |
| 8 | Claude | Returns per-sub-item JSON. The response format and JSON schema are defined entirely by the prompt files — the template has no influence on the output structure |

---

*KT Tracker · 19 March 2026 · Active connectors: GitHub (MCP), Confluence (REST), Jira (REST)*
