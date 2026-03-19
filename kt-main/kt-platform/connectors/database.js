// ─────────────────────────────────────────────────────────────────────────────
// connectors/database.js
//
// Supports: PostgreSQL, MySQL, BigQuery, Snowflake (via env var dialect)
//
// ENV VARS:
//   DB_DIALECT    — postgres | mysql | bigquery | snowflake
//   DB_HOST       — hostname (postgres/mysql)
//   DB_PORT       — port (default: 5432 / 3306)
//   DB_NAME       — database name
//   DB_USER       — username
//   DB_PASSWORD   — password
//   DB_SSL        — true | false
//   DB_SCHEMAS    — comma-separated schemas to scan (default: public)
//   BQ_PROJECT    — BigQuery project ID
//   BQ_KEYFILE    — path to BigQuery service account JSON
// ─────────────────────────────────────────────────────────────────────────────

const DIALECT      = (process.env.DB_DIALECT || "").toLowerCase();
const MAX_TABLES   = 50;
const MAX_COLS     = 30;
const EXCLUDE_SCHEMAS = ["information_schema", "pg_catalog", "pg_toast", "sys", "mysql", "performance_schema"];

// ── PostgreSQL ────────────────────────────────────────────────────────────────
async function fetchPostgres({ keyword, schemas }) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  try {
    const schemaFilter = schemas?.length
      ? `AND t.table_schema = ANY($1::text[])`
      : `AND t.table_schema NOT IN (${EXCLUDE_SCHEMAS.map(s=>`'${s}'`).join(",")})`;

    const keywordFilter = keyword
      ? `AND (t.table_name ILIKE $${schemas?.length ? 2 : 1} OR t.table_schema ILIKE $${schemas?.length ? 2 : 1})`
      : "";

    const params = [
      ...(schemas?.length ? [schemas] : []),
      ...(keyword ? [`%${keyword}%`] : []),
    ];

    const tableRes = await client.query(`
      SELECT t.table_schema, t.table_name,
             obj_description((t.table_schema||'.'||t.table_name)::regclass, 'pg_class') AS comment
      FROM information_schema.tables t
      WHERE t.table_type = 'BASE TABLE'
        ${schemaFilter} ${keywordFilter}
      ORDER BY t.table_schema, t.table_name
      LIMIT ${MAX_TABLES}
    `, params);

    const tables = await Promise.all(tableRes.rows.map(async t => {
      const fqn = `${t.table_schema}.${t.table_name}`;

      const colRes = await client.query(`
        SELECT c.column_name, c.data_type, c.is_nullable,
               col_description((c.table_schema||'.'||c.table_name)::regclass, c.ordinal_position) AS comment
        FROM information_schema.columns c
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position
        LIMIT ${MAX_COLS}
      `, [t.table_schema, t.table_name]);

      let rowCount = null;
      try {
        const countRes = await client.query(`SELECT reltuples::bigint AS count FROM pg_class WHERE oid = $1::regclass`, [fqn]);
        rowCount = countRes.rows[0]?.count;
      } catch {}

      return {
        name:     t.table_name,
        schema:   t.table_schema,
        comment:  t.comment,
        rowCount,
        columns:  colRes.rows.map(c => ({
          name:     c.column_name,
          type:     c.data_type,
          nullable: c.is_nullable === "YES",
          comment:  c.comment,
        })),
      };
    }));

    return { tables, databaseName: process.env.DB_NAME, dialect: "PostgreSQL" };
  } finally {
    await client.end();
  }
}

// ── MySQL ─────────────────────────────────────────────────────────────────────
async function fetchMySQL({ keyword, schemas }) {
  const { default: mysql } = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || "3306"),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    const schemaList = schemas?.length ? schemas : [process.env.DB_NAME];
    const schemaPlaceholders = schemaList.map(() => "?").join(",");
    const keywordParam = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
    const keywordClause = keyword ? `AND (TABLE_NAME LIKE ? OR TABLE_SCHEMA LIKE ?)` : "";

    const [tableRows] = await conn.execute(`
      SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_COMMENT, TABLE_ROWS
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA IN (${schemaPlaceholders})
        AND TABLE_TYPE = 'BASE TABLE' ${keywordClause}
      ORDER BY TABLE_SCHEMA, TABLE_NAME LIMIT ${MAX_TABLES}
    `, [...schemaList, ...keywordParam]);

    const tables = await Promise.all(tableRows.map(async t => {
      const [colRows] = await conn.execute(`
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION LIMIT ${MAX_COLS}
      `, [t.TABLE_SCHEMA, t.TABLE_NAME]);

      return {
        name:     t.TABLE_NAME,
        schema:   t.TABLE_SCHEMA,
        comment:  t.TABLE_COMMENT,
        rowCount: t.TABLE_ROWS,
        columns:  colRows.map(c => ({
          name:     c.COLUMN_NAME,
          type:     c.COLUMN_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          comment:  c.COLUMN_COMMENT,
        })),
      };
    }));

    return { tables, databaseName: process.env.DB_NAME, dialect: "MySQL" };
  } finally {
    await conn.end();
  }
}

// ── BigQuery ──────────────────────────────────────────────────────────────────
async function fetchBigQuery({ keyword, schemas }) {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bq = new BigQuery({
    projectId: process.env.BQ_PROJECT,
    keyFilename: process.env.BQ_KEYFILE,
  });

  const [datasets] = await bq.getDatasets();
  const targetDatasets = schemas?.length
    ? datasets.filter(d => schemas.includes(d.id))
    : datasets.slice(0, 10);

  const tables = [];
  for (const dataset of targetDatasets) {
    const [datasetTables] = await dataset.getTables();
    for (const table of datasetTables.slice(0, MAX_TABLES - tables.length)) {
      if (keyword && !table.id.includes(keyword) && !dataset.id.includes(keyword)) continue;
      const [meta] = await table.getMetadata();
      tables.push({
        name:     table.id,
        schema:   dataset.id,
        comment:  meta.description,
        rowCount: meta.numRows,
        columns:  (meta.schema?.fields || []).slice(0, MAX_COLS).map(f => ({
          name:     f.name,
          type:     f.type,
          nullable: f.mode !== "REQUIRED",
          comment:  f.description,
        })),
      });
      if (tables.length >= MAX_TABLES) break;
    }
  }

  return { tables, databaseName: process.env.BQ_PROJECT, dialect: "BigQuery" };
}

// ── Connector export ──────────────────────────────────────────────────────────
export const databaseConnector = {
  meta: {
    label:       "Database",
    icon:        "🗄️",
    description: "Table schemas, column metadata, row counts",
    docsUrl:     "https://node-postgres.com",
    envVars: [
      { key: "DB_DIALECT",  label: "Dialect",      required: true,  hint: "postgres | mysql | bigquery | snowflake" },
      { key: "DB_HOST",     label: "Host",          required: false, hint: "postgres/mysql only" },
      { key: "DB_PORT",     label: "Port",          required: false, hint: "5432 / 3306" },
      { key: "DB_NAME",     label: "Database Name", required: false, hint: "postgres/mysql only" },
      { key: "DB_USER",     label: "Username",      required: false, hint: "postgres/mysql only" },
      { key: "DB_PASSWORD", label: "Password",      required: false, hint: "postgres/mysql only" },
      { key: "DB_SCHEMAS",  label: "Schemas",       required: false, hint: "Comma-separated. Default: public" },
      { key: "BQ_PROJECT",  label: "BQ Project ID", required: false, hint: "BigQuery only" },
      { key: "BQ_KEYFILE",  label: "BQ Key File",   required: false, hint: "Path to service account JSON" },
    ],
    sectionsSupported: ["data_context", "data_sources", "data_quality"],
  },

  isConfigured: () => !!process.env.DB_DIALECT,

  async testConnection() {
    const dialect = (process.env.DB_DIALECT || "").toLowerCase();
    if (dialect === "postgres") { const d = await fetchPostgres({ keyword: null, schemas: [] }); return d.tables.length >= 0; }
    if (dialect === "mysql")    { const d = await fetchMySQL({ keyword: null, schemas: [] });    return d.tables.length >= 0; }
    if (dialect === "bigquery") { const d = await fetchBigQuery({ keyword: null, schemas: [] }); return d.tables.length >= 0; }
    throw new Error(`Unsupported dialect: ${dialect}`);
  },

  async fetch({ keyword, schemas }) {
    const schemaList = schemas || (process.env.DB_SCHEMAS ? process.env.DB_SCHEMAS.split(",").map(s => s.trim()) : []);
    switch (DIALECT) {
      case "postgres":  return fetchPostgres({ keyword, schemas: schemaList });
      case "mysql":     return fetchMySQL({ keyword, schemas: schemaList });
      case "bigquery":  return fetchBigQuery({ keyword, schemas: schemaList });
      default: throw new Error(`DB_DIALECT "${DIALECT}" not supported. Use: postgres, mysql, bigquery`);
    }
  },
};
