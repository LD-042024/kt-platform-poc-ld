// ─────────────────────────────────────────────────────────────────────────────
// connectors/notion.js
//
// ENV VARS:
//   NOTION_TOKEN       — Integration token from notion.so/my-integrations
//   NOTION_DATABASE_ID — (Optional) default database ID to scan
// ─────────────────────────────────────────────────────────────────────────────

const NOTION_TOKEN = process.env.NOTION_TOKEN;

const notionHeaders = () => ({
  Authorization:  `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

async function notionFetch(path, method = "GET", body = null) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: notionHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion API ${res.status}: ${path}`);
  return res.json();
}

function extractText(richText) {
  return (richText || []).map(t => t.plain_text).join("").trim();
}

export const notionConnector = {
  meta: {
    label:       "Notion",
    icon:        "📓",
    description: "Databases, pages, docs, runbooks",
    docsUrl:     "https://developers.notion.com",
    envVars: [
      { key: "NOTION_TOKEN",       label: "Integration Token", required: true,  hint: "From notion.so/my-integrations" },
      { key: "NOTION_DATABASE_ID", label: "Database ID",       required: false, hint: "Optional default database to scan" },
    ],
    sectionsSupported: ["runbooks", "contacts", "known_issues", "biz_context"],
  },

  isConfigured: () => !!process.env.NOTION_TOKEN,

  async testConnection() {
    await notionFetch("/users/me");
    return true;
  },

  async fetch({ keyword, databaseId }) {
    const dbId = databaseId || process.env.NOTION_DATABASE_ID;

    // Search across all accessible pages/databases
    const searchData = await notionFetch("/search", "POST", {
      query: keyword,
      filter: { value: "page", property: "object" },
      page_size: 20,
      sort: { direction: "descending", timestamp: "last_edited_time" },
    });

    const pages = await Promise.all(
      (searchData.results || []).slice(0, 15).map(async page => {
        let excerpt = "";
        try {
          const blocks = await notionFetch(`/blocks/${page.id}/children?page_size=5`);
          excerpt = (blocks.results || [])
            .filter(b => b.type === "paragraph" || b.type === "bulleted_list_item")
            .map(b => extractText(b[b.type]?.rich_text))
            .filter(Boolean)
            .join(" ")
            .slice(0, 800);
        } catch {}

        const title = extractText(page.properties?.title?.title || page.properties?.Name?.title) || "Untitled";
        return {
          id:          page.id,
          title,
          url:         page.url,
          lastUpdated: page.last_edited_time?.split("T")[0],
          excerpt,
        };
      })
    );

    return { pages };
  },
};
