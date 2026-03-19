// ─────────────────────────────────────────────────────────────────────────────
// prompts/ask-agent.js
//
// Prompt config for the Ask Agent (Agent Studio → Ask Agent tab).
// Multi-turn Q&A grounded in GitHub data + existing KT documentation.
// ─────────────────────────────────────────────────────────────────────────────

export const ASK_PROMPT = {

  // ── System prompt ─────────────────────────────────────────────────────────
  // Defines Claude's persona and citation rules for the Q&A agent.
  // Receives orgContext string (from org-context.js) so it can be injected.
  system(orgContext) {
    return [
      `You are a Data Engineering KT assistant. Answer questions about the project concisely and accurately.`,
      ``,
      `Knowledge sources in priority order:`,
      `  1. [KT Docs]          — content already documented in the KT tracker`,
      `  2. [GitHub]           — signals from the repository (README, issues, commits, file tree)`,
      `  3. [Database]         — schema, table, and column metadata from the database scan`,
      `  4. [Confluence]       — internal wiki pages, runbooks, and ADRs`,
      `  5. [General Knowledge]— your own DE expertise as a last resort only`,
      ``,
      `RULES:`,
      `- Always cite your source inline: [GitHub], [KT Docs], [Database], [Confluence], or [General Knowledge].`,
      `- If you cannot find evidence for a claim, say so explicitly. Never guess.`,
      `- Be direct and practical. Engineers reading this are taking over a live system.`,
      `- Keep answers under 200 words unless the question genuinely requires more depth.`,
      `- If multiple sources conflict, surface the conflict — don't silently pick one.`,
      orgContext ? `\n${orgContext}` : null,
    ].filter(Boolean).join("\n").trim();
  },

  // ── GitHub context formatter ──────────────────────────────────────────────
  // Lighter than the populate scan — just enough to ground Q&A answers.
  formatGithubContext({ repos, readme, issues }) {
    return [
      `Repos: ${repos.map(r => r.name).join(", ")}`,
      readme ? `README excerpt:\n${readme.slice(0, 1200)}` : null,
      issues?.length ? `Open issues: ${issues.map(i => i.title).join(" | ")}` : null,
    ].filter(Boolean).join("\n").trim();
  },

  // ── Database context formatter ────────────────────────────────────────────
  // Formats database scan results for injection into Q&A context.
  // Shape: { tables: [{name, schema, columns: [{name, type, nullable, comment}], rowCount}] }
  formatDatabaseContext(dbData) {
    if (!dbData?.tables?.length) return null;
    const lines = dbData.tables.map(t => {
      const cols = (t.columns || [])
        .map(c => `    ${c.name} ${c.type}${c.nullable ? "" : " NOT NULL"}${c.comment ? ` -- ${c.comment}` : ""}`)
        .join("\n");
      return `Table: ${t.schema ? t.schema + "." : ""}${t.name}${t.rowCount != null ? ` (~${t.rowCount.toLocaleString()} rows)` : ""}\n${cols}`;
    });
    return `DATABASE SCHEMA:\n${lines.join("\n\n")}`;
  },

  // ── Confluence context formatter ──────────────────────────────────────────
  // Formats Confluence page excerpts for injection into Q&A context.
  // Shape: { pages: [{title, url, excerpt, lastUpdated}] }
  formatConfluenceContext(confluenceData) {
    if (!confluenceData?.pages?.length) return null;
    const lines = confluenceData.pages.map(p =>
      `Page: ${p.title}${p.lastUpdated ? ` (updated ${p.lastUpdated})` : ""}${p.url ? ` — ${p.url}` : ""}\n${p.excerpt}`
    );
    return `CONFLUENCE DOCS:\n${lines.join("\n\n")}`;
  },

  // ── User message builder ──────────────────────────────────────────────────
  // Assembles the grounding context + question into the user turn message.
  // Add new sources here as you wire them in.
  userMessage({ githubContext, ktContext, dbContext, confluenceContext, jiraContext, notionContext, question }) {
    return [
      githubContext     ? `GITHUB CONTEXT:\n${githubContext}`        : null,
      dbContext         ? dbContext                                    : null,
      confluenceContext ? confluenceContext                            : null,
      jiraContext       ? jiraContext                                  : null,
      notionContext     ? notionContext                                : null,
      ktContext         ? `EXISTING KT DOCUMENTATION:\n${ktContext}` : null,
      `QUESTION: ${question}`,
    ].filter(Boolean).join("\n\n").trim();
  },
};
