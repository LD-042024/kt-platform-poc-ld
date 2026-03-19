// ─────────────────────────────────────────────────────────────────────────────
// prompts/confluence.js
//
// Prompt config for the Confluence scan agent.
// Scans a Confluence space/pages and drafts KT content from internal wiki docs,
// runbooks, ADRs, and design documents.
//
// TO ACTIVATE: Add a Confluence connector to server.js (REST API or MCP),
// then call CONFLUENCE_PROMPT.build() from the /api/agent/populate route.
//
// CONFLUENCE API DOCS: https://developer.atlassian.com/cloud/confluence/rest/v2/
// ─────────────────────────────────────────────────────────────────────────────

export const CONFLUENCE_PROMPT = {

  // ── Scan config ───────────────────────────────────────────────────────────
  scan: {
    maxPages:           20,    // Max pages to fetch per scan
    excerptMaxChars:    1500,  // Characters per page excerpt sent to Claude
    includeComments:    false, // Page comments — usually noise
    includeAttachments: false, // Attachment names only, not content

    // Page types to prioritise (Confluence labels/types)
    priorityLabels: ["runbook", "adr", "architecture", "data-dictionary", "onboarding", "kt"],

    // CQL query used to find relevant pages — customise per project
    // Docs: https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/
    cqlTemplate(spaceKey, keyword) {
      return `space = "${spaceKey}" AND (title ~ "${keyword}" OR label in ("runbook","adr","data-dictionary","kt")) ORDER BY lastmodified DESC`;
    },
  },

  // ── System prompt ─────────────────────────────────────────────────────────
  system: `You are a Data Engineering Knowledge Transfer specialist analysing
internal Confluence documentation. Extract the most important KT-relevant information
from wiki pages, runbooks, ADRs, and design docs. Focus on what an incoming engineer
needs to know to operate and extend this system safely.`,

  // ── Page formatter ────────────────────────────────────────────────────────
  // Formats Confluence page data into a readable block for Claude.
  // Input shape: { pages: [{title, url, space, lastUpdated, author, excerpt, labels}] }
  formatPages({ pages, spaceKey }) {
    if (!pages?.length) return "No Confluence pages found.";

    const header = [
      spaceKey ? `Space: ${spaceKey}` : null,
      `Pages scanned: ${pages.length}`,
    ].filter(Boolean).join(" | ");

    const pageBlocks = pages.map((p, i) => {
      const meta = [
        p.space       ? `space: ${p.space}`                   : null,
        p.lastUpdated ? `updated: ${p.lastUpdated}`            : null,
        p.author      ? `by: ${p.author}`                     : null,
        p.labels?.length ? `labels: ${p.labels.join(", ")}`   : null,
      ].filter(Boolean).join(" | ");

      return [
        `PAGE ${i + 1}: ${p.title}`,
        meta ? `  (${meta})` : null,
        p.url ? `  ${p.url}` : null,
        `---`,
        p.excerpt
          ? p.excerpt.slice(0, CONFLUENCE_PROMPT.scan.excerptMaxChars)
          : "(no content available)",
      ].filter(Boolean).join("\n");
    });

    return `${header}\n\n${pageBlocks.join("\n\n")}`;
  },

  // ── Drafting rules ────────────────────────────────────────────────────────
  rules: [
    `Extract operational procedures, runbook steps, and incident response flows into the Runbooks section.`,
    `Pull architecture decisions (ADRs) into the Infrastructure and Pipeline Inventory sections.`,
    `Identify any documented known issues, tech debt, or deferred work for the Known Issues section.`,
    `Extract contact names and roles mentioned in pages for the Contacts section.`,
    `Preserve links to source pages — they are more valuable than summaries.`,
    `If a page is clearly outdated (> 12 months old without update), flag it with [possibly stale].`,
    `Do not summarise meeting notes or status updates — skip them.`,
  ],

  // ── Response format ───────────────────────────────────────────────────────
  // sectionItems — { sectionId: ["sub-item 1", ...] } — passed from prompts/index.js
  responseFormat(sectionsToPopulate, sectionItems) {
    const draftLines = sectionsToPopulate.map(s => {
      const subItems = sectionItems?.[s] || [];
      if (!subItems.length) {
        return `    "${s}": { "content": "...", "verify": ["item1", "item2"], "sourcePages": ["page title"] }`;
      }
      const itemLines = subItems
        .map(item => `        "${item}": "draft content specific to this sub-item only"`)
        .join(",\n");
      return `    "${s}": {\n      "items": {\n${itemLines}\n      },\n      "verify": ["item1", "item2"],\n      "sourcePages": ["page title"]\n    }`;
    }).join(",\n");

    const keyNamesList = sectionsToPopulate
      .filter(s => sectionItems?.[s]?.length)
      .map(s => `  ${s}: ${sectionItems[s].map(i => `"${i}"`).join(", ")}`)
      .join("\n");

    return `Respond ONLY with valid JSON — no markdown fences, no preamble:
{
  "summary":   "One paragraph summarising what the Confluence space covers",
  "confidence": "low|medium|high",
  "drafts": {
${draftLines}
  }
}
Only populate sections from this list: ${sectionsToPopulate.join(", ")}
CRITICAL: Your entire response must be the JSON object above and nothing else.
Do not write any sentences before or after the JSON.
Do not say "I now have" or "Based on my research" or anything conversational.
Start your response with { and end with }

KEY NAMES MUST BE EXACT: Use these exact key strings inside each section's "items" object.
Do not shorten, paraphrase, or change them in any way:
${keyNamesList}`;
  },

  // ── Master prompt builder ─────────────────────────────────────────────────
  build({ confluenceData, sourceData, sectionsToPopulate, sectionItems, orgContext }) {
    confluenceData = confluenceData || sourceData;
    const targetSections = sectionsToPopulate?.length
      ? sectionsToPopulate
      : ["runbooks", "known_issues", "contacts", "infrastructure"];

    return [
      orgContext ? orgContext : null,
      `CONFLUENCE DATA:\n${CONFLUENCE_PROMPT.formatPages(confluenceData)}`,
      `\nTASK: Draft KT content for: ${targetSections.join(", ")}`,
      `\nRULES:\n${CONFLUENCE_PROMPT.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
      `\n${CONFLUENCE_PROMPT.responseFormat(targetSections, sectionItems)}`,
    ].filter(Boolean).join("\n\n").trim();
  },
};