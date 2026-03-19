// prompts/jira.js — Jira scan prompt config
export const JIRA_PROMPT = {
  system: `You are a Data Engineering KT specialist analysing Jira tickets.
Extract known issues, technical debt, and business context from issue titles,
descriptions and labels. Write for engineers inheriting this project.`,

  formatData({ issues, projectKey }) {
    if (!issues?.length) return "No Jira issues found.";
    return [
      `Project: ${projectKey} | Issues found: ${issues.length}`,
      issues.map(i =>
        `[${i.key}] ${i.type} | ${i.status} | ${i.priority}\n  ${i.summary}` +
        (i.labels?.length ? `\n  Labels: ${i.labels.join(", ")}` : "") +
        (i.description ? `\n  ${i.description}` : "")
      ).join("\n\n"),
    ].join("\n\n").trim();
  },

  rules: [
    "Extract bugs and open defects for the Known Issues section.",
    "Identify tech debt tickets (labels like debt, refactor, cleanup) for Known Issues.",
    "Pull epics and their goals into Business Context.",
    "Note assignees and reporters as potential contacts.",
    "Flag any tickets marked as blockers or critical priority.",
  ],

  // responseFormat(sections) {
  //   const lines = sections.map(s => `    "${s}": { "content": "...", "verify": ["item1"] }`).join(",\n");
  //   return `Respond ONLY with valid JSON — no markdown:\n{\n  "confidence": "low|medium|high",\n  "drafts": {\n${lines}\n  }\n}\nOnly include: ${sections.join(", ")}`;
  // },
  // sectionItems — { sectionId: ["sub-item 1", ...] } — passed from prompts/index.js
  responseFormat(sections, sectionItems) {
    const draftLines = sections.map(s => {
      const subItems = sectionItems?.[s] || [];
      if (!subItems.length) {
        return `    "${s}": { "content": "...", "verify": ["item1"] }`;
      }
      const itemLines = subItems
        .map(item => `        "${item}": "draft content specific to this sub-item only"`)
        .join(",\n");
      return `    "${s}": {\n      "items": {\n${itemLines}\n      },\n      "verify": ["item1"]\n    }`;
    }).join(",\n");

    const keyNamesList = sections
      .filter(s => sectionItems?.[s]?.length)
      .map(s => `  ${s}: ${sectionItems[s].map(i => `"${i}"`).join(", ")}`)
      .join("\n");

    return `Respond ONLY with valid JSON — no markdown:\n{\n  "confidence": "low|medium|high",\n  "drafts": {\n${draftLines}\n  }\n}\nOnly include: ${sections.join(", ")}\n\nCRITICAL: Your entire response must be the JSON object above and nothing else.\nDo not write any sentences before or after the JSON.\nDo not say "I now have" or "Based on my research" or anything conversational.\nStart your response with { and end with }\n\nKEY NAMES MUST BE EXACT: Use these exact key strings inside each section's "items" object.\nDo not shorten, paraphrase, or change them in any way:\n${keyNamesList}`;
  },

  build({ sourceData, sectionsToPopulate, sectionItems, orgContext }) {
    const target = sectionsToPopulate?.length ? sectionsToPopulate : ["known_issues","biz_context"];
    return [
      orgContext ? orgContext : null,
      `JIRA DATA:\n${this.formatData(sourceData)}`,
      `\nTASK: Draft KT for: ${target.join(", ")}`,
      `\nRULES:\n${this.rules.map((r,i) => `${i+1}. ${r}`).join("\n")}`,
      `\n${this.responseFormat(target, sectionItems)}`,
    ].filter(Boolean).join("\n\n").trim();
  },
};