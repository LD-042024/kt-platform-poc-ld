// ─────────────────────────────────────────────────────────────────────────────
// prompts/database.js
//
// Prompt config for the Database scan agent.
// When wired in, this scans table/column metadata and drafts KT content
// for Data Context, Data Sources, and Data Quality sections.
//
// TO ACTIVATE: Add a DB connector to server.js and call DATABASE_PROMPT.build()
// from the /api/agent/populate route alongside the GitHub scan.
// ─────────────────────────────────────────────────────────────────────────────

export const DATABASE_PROMPT = {

  // ── Scan config ───────────────────────────────────────────────────────────
  scan: {
    maxTables:        50,    // Max tables to include in the scan
    maxColumnsPerTable: 30,  // Max columns per table (truncate wide tables)
    includeSampleData:  false, // Never true by default — PII risk
    includeRowCounts:   true,
    includeNullRates:   false, // Turn on if your DB exposes column stats
    includeIndexes:     true,
    schemas: [],             // Empty = all schemas. e.g. ["public", "finance"]
    excludeSchemas: ["information_schema", "pg_catalog", "sys"],
    excludeTablePatterns: ["_backup", "_old", "_tmp", "_temp", "_archive"],
  },

  // ── System prompt ─────────────────────────────────────────────────────────
  system: `You are a Data Engineering Knowledge Transfer specialist analysing
database schema metadata. Your goal is to infer business context, data relationships,
and quality signals from table names, column names, types, and constraints.
Write for engineers who are inheriting this database — they need to understand
what the data means, not just what the schema looks like.`,

  // ── Schema formatter ─────────────────────────────────────────────────────
  // Formats raw DB metadata into a readable block for Claude.
  // Input shape: { tables: [{name, schema, columns, indexes, rowCount, comment}] }
  formatSchema({ tables, databaseName, dialect }) {
    const header = [
      databaseName ? `Database: ${databaseName}` : null,
      dialect      ? `Dialect:  ${dialect}`       : null,
      `Tables:   ${tables.length}`,
    ].filter(Boolean).join("\n");

    const tableBlocks = tables.map(t => {
      const fqn = t.schema ? `${t.schema}.${t.name}` : t.name;
      const meta = [
        t.rowCount != null ? `~${t.rowCount.toLocaleString()} rows` : null,
        t.comment || null,
      ].filter(Boolean).join(" | ");

      const cols = (t.columns || [])
        .slice(0, DATABASE_PROMPT.scan.maxColumnsPerTable)
        .map(c => {
          const parts = [`  ${c.name.padEnd(30)} ${c.type}`];
          if (!c.nullable) parts.push("NOT NULL");
          if (c.isPrimary) parts.push("PK");
          if (c.isForeign) parts.push(`FK → ${c.references}`);
          if (c.comment)   parts.push(`-- ${c.comment}`);
          return parts.join(" ");
        });

      const idxLines = (t.indexes || []).map(i =>
        `  INDEX ${i.name} ON (${i.columns.join(", ")})${i.unique ? " UNIQUE" : ""}`
      );

      return [
        `TABLE: ${fqn}${meta ? ` (${meta})` : ""}`,
        ...cols,
        ...(idxLines.length ? ["", ...idxLines] : []),
      ].join("\n");
    });

    return `${header}\n\n${tableBlocks.join("\n\n")}`;
  },

  // ── Drafting rules ────────────────────────────────────────────────────────
  rules: [
    `Infer business meaning from table/column naming patterns — state your reasoning.`,
    `Identify likely domain boundaries (e.g. finance_, customer_, order_) and describe them.`,
    `Flag columns that look like PII (name, email, ssn, dob, phone, address etc.).`,
    `Identify relationships between tables based on foreign key patterns and naming.`,
    `Note any tables that look stale, deprecated, or legacy (old_, _bak, _v1 etc.).`,
    `Highlight tables with unusually high or low row counts if available.`,
    `Do NOT invent column meanings. If a name is ambiguous, say so and suggest verifying.`,
  ],

  // ── Response format ───────────────────────────────────────────────────────
  responseFormat: `Respond ONLY with valid JSON — no markdown fences, no preamble:
{
  "summary":       "One paragraph describing what this database stores and its apparent purpose",
  "domains":       ["domain1", "domain2"],
  "piiFlags":      ["table.column", "table.column"],
  "confidence":    "low|medium|high",
  "drafts": {
    "data_context":  { "content": "...", "verify": ["item1", "item2"] },
    "data_sources":  { "content": "...", "verify": ["item1", "item2"] },
    "data_quality":  { "content": "...", "verify": ["item1", "item2"] }
  }
}`,

  // ── Master prompt builder ─────────────────────────────────────────────────
  build({ schemaData, sourceData, sectionsToPopulate, orgContext }) {
    schemaData = schemaData || sourceData;
    const targetSections = sectionsToPopulate?.length
      ? sectionsToPopulate
      : ["data_context", "data_sources", "data_quality"];

    return [
      orgContext ? orgContext : null,
      `DATABASE SCHEMA:\n${DATABASE_PROMPT.formatSchema(schemaData)}`,
      `\nTASK: Draft KT content for: ${targetSections.join(", ")}`,
      `\nRULES:\n${DATABASE_PROMPT.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
      `\n${DATABASE_PROMPT.responseFormat}`,
    ].filter(Boolean).join("\n\n").trim();
  },
};
