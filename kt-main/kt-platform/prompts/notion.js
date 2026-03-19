// prompts/notion.js — Notion scan prompt config
export const NOTION_PROMPT = {
  system: `You are a Data Engineering KT specialist analysing Notion pages.
Extract runbooks, contacts, known issues and business context from internal docs.
Write for engineers inheriting this project.`,

  formatData({ pages }) {
    if (!pages?.length) return "No Notion pages found.";
    return pages.map((p, i) =>
      `PAGE ${i+1}: ${p.title}${p.lastUpdated ? ` (updated ${p.lastUpdated})` : ""}\n${p.url||""}\n${"─".repeat(40)}\n${p.excerpt||"(no content)"}`
    ).join("\n\n").trim();
  },

  rules: [
    "Extract step-by-step procedures for Runbooks.",
    "Pull contact names, roles and responsibilities for Contacts.",
    "Note any documented issues, workarounds or limitations for Known Issues.",
    "Identify architecture or design notes for Infrastructure.",
    "Preserve links to source pages — they are more useful than summaries.",
  ],

  responseFormat(sections) {
    const lines = sections.map(s => `    "${s}": { "content": "...", "verify": ["item1"] }`).join(",\n");
    return `Respond ONLY with valid JSON — no markdown:\n{\n  "confidence": "low|medium|high",\n  "drafts": {\n${lines}\n  }\n}\nOnly include: ${sections.join(", ")}`;
  },

  build({ sourceData, sectionsToPopulate, orgContext }) {
    const target = sectionsToPopulate?.length ? sectionsToPopulate : ["runbooks","contacts","known_issues"];
    return [
      orgContext ? orgContext : null,
      `NOTION PAGES:\n${this.formatData(sourceData)}`,
      `\nTASK: Draft KT for: ${target.join(", ")}`,
      `\nRULES:\n${this.rules.map((r,i) => `${i+1}. ${r}`).join("\n")}`,
      `\n${this.responseFormat(target)}`,
    ].filter(Boolean).join("\n\n").trim();
  },
};
