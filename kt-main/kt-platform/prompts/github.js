// ─────────────────────────────────────────────────────────────────────────────
// prompts/github.js
//
// Prompt config for the GitHub scan agent (Agent Studio → Populate KT).
// Controls how GitHub repo data is read, formatted, and turned into KT drafts.
// ─────────────────────────────────────────────────────────────────────────────

export const GITHUB_PROMPT = {

  // ── What to scan ────────────────────────────────────────────────────────
  // Controls how much data is pulled from each repo before sending to Claude.
  scan: {
    readmeMaxChars:    2000,   // README characters to include (keep low to save tokens)
    maxRepos:          5,      // Max repos returned by keyword search
    maxIssues:         10,     // Max open issues to include
    maxCommits:        10,     // Max recent commits to include
    includeFileTree:   true,   // Include root-level file tree
    includeTopics:     true,   // Include repo topics/tags
  },

  // ── System prompt ────────────────────────────────────────────────────────
  // Who Claude is when running the populate agent.
  system: `You are a senior Data Engineering Knowledge Transfer specialist.
Your job is to produce accurate, concise KT documentation drafts based on
GitHub repository signals. You write for engineers who are taking over a
project — they need clarity and actionable detail, not filler.`,

  // ── Template instruction builder ─────────────────────────────────────────
  // Translates the UI template (scan depth, focus areas etc.) into instructions.
  templateInstructions(promptTemplate) {
    if (!promptTemplate) {
      return `Provide balanced, concise drafts — enough to seed each section without being exhaustive.`;
    }
    return [
      `TEMPLATE INSTRUCTIONS:`,
      `- Scan depth:   ${promptTemplate.scanDepth     || "Medium"}`,
      `- Focus areas:  ${(promptTemplate.focusAreas || []).join(", ") || "General"}`,
      `- Output style: ${promptTemplate.outputStyle   || "Short paragraphs"}`,
      `- Detail level: ${promptTemplate.detailLevel   || "Balanced"}`,
      promptTemplate.customContext
        ? `- Custom notes: ${promptTemplate.customContext}`
        : null,
    ].filter(Boolean).join("\n");
  },

  // ── GitHub data formatter ────────────────────────────────────────────────
  // Formats raw GitHub API data into a readable context block for Claude.
  // Edit this to add/remove fields or change how they're presented.
  formatContext({ repos, readme, fileTree, issues, commits }) {
    return [
      `REPOSITORIES (${repos.length} found):`,
      repos.map(r =>
        `• ${r.name} [${r.language || "unknown lang"}]` +
        (r.description ? ` — ${r.description}` : "") +
        (r.topics?.length ? ` | topics: ${r.topics.join(", ")}` : "") +
        ` | updated: ${r.updatedAt}`
      ).join("\n"),

      `\nTOP REPO: ${repos[0]?.fullName}`,

      fileTree?.length
        ? `\nFILE STRUCTURE (root):\n${fileTree.map(f => `${f.type === "tree" ? "📁" : "📄"} ${f.path}`).join("\n")}`
        : null,

      `\nREADME:\n${readme || "Not found"}`,

      issues?.length
        ? `\nOPEN ISSUES (${issues.length}):\n${issues.map(i => `• [${i.labels.join(", ") || "—"}] ${i.title}`).join("\n")}`
        : `\nOPEN ISSUES: None`,

      commits?.length
        ? `\nRECENT COMMITS:\n${commits.map(c => `• ${c.message} — ${c.author}`).join("\n")}`
        : null,
    ].filter(Boolean).join("\n").trim();
  },

  // ── Drafting rules ───────────────────────────────────────────────────────
  // Edit, add, or remove rules to change how Claude writes the drafts.
  rules: [
    `Be concise — 2-4 sentences per section unless scan depth is "Deep" (then up to 8).`,
    `Only assert what you can infer from the GitHub data. Never invent specifics.`,
    `Flag uncertain inferences inline with [inferred] or [verify]. Never present guesses as facts.`,
    `For each section list 2-3 things the KT team must manually verify or fill in.`,
    `Do not use filler phrases like "it appears" or "based on the above". Be direct.`,
    `If the GitHub data is too thin to draft a section meaningfully, say so and explain what's missing.`,
  ],

  // ── Response JSON schema ──────────────────────────────────────────────────
  // Defines what Claude must return.
  // sectionItems — { sectionId: ["sub-item 1", ...] } — passed from prompts/index.js
  // Claude drafts content per sub-item so Accept in Tracker maps directly to each notes field.
  responseFormat(sectionsToPopulate, sectionItems) {
    const draftLines = sectionsToPopulate.map(s => {
      const subItems = sectionItems?.[s] || [];
      if (!subItems.length) {
        // No sub-items for this section — fall back to single content block
        return `    "${s}": { "content": "...", "verify": ["item1", "item2"] }`;
      }
      // One key per sub-item — key must be EXACTLY the sub-item name string
      const itemLines = subItems
        .map(item => `        "${item}": "draft content specific to this sub-item only"`)
        .join(",\n");
      return `    "${s}": {\n      "items": {\n${itemLines}\n      },\n      "verify": ["item1", "item2"]\n    }`;
    }).join(",\n");

    // List of exact key names Claude must use — prevents Claude paraphrasing key names
    const keyNamesList = sectionsToPopulate
      .filter(s => sectionItems?.[s]?.length)
      .map(s => `  ${s}: ${sectionItems[s].map(i => `"${i}"`).join(", ")}`)
      .join("\n");

    return `Respond ONLY with valid JSON — no markdown fences, no preamble:
{
  "summary":      "One sentence overall project summary",
  "reposSummary": "What these repos appear to do and how they relate",
  "confidence":   "low|medium|high",
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
// Only populate sections from this list: ${sectionsToPopulate.join(", ")}`;
//   },

  // ── Master prompt builder ────────────────────────────────────────────────
  // Assembles all blocks above into the final user message sent to Claude.
  // Edit the ORDER of parts here if you want to restructure the prompt.
  build({ promptTemplate, githubData, sourceData, sectionsToPopulate, sectionItems, sectionLabels, orgContext }) {
    githubData = githubData || sourceData;
    return [
      orgContext               ? orgContext                                            : null,
      this.templateInstructions(promptTemplate),
      `\nGITHUB DATA:\n${this.formatContext(githubData)}`,
      `\nTASK: Draft KT content for: ${sectionsToPopulate.map(s => sectionLabels[s] || s).join(", ")}`,
      `\nRULES:\n${this.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
      `\n${this.responseFormat(sectionsToPopulate, sectionItems)}`,
    ].filter(Boolean).join("\n\n").trim();
  },
};