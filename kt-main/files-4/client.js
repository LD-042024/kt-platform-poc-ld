// All API calls to server.js — single place to change base URL

const BASE = () => window.__KT_SERVER_URL__ || localStorage.getItem('kt_server_url') || 'http://localhost:3001';

async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE() + path, opts);
  // Handle 304 (Not Modified) and other responses
  if (!res.ok && res.status !== 304) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }
  // 304 has no body, return empty object
  if (res.status === 304) {
    return {};
  }
  return res.json();
}

export const api = {
  // ── Status ──────────────────────────────────────────────────────────────
  status: () => apiFetch('/api/status'),

  // ── Projects ─────────────────────────────────────────────────────────────
  listProjects:  ()             => apiFetch('/api/project/list'),
  saveProject:   (project, projectData) => apiFetch('/api/project/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, projectData }),
  }),
  loadProject:   (folderName)   => apiFetch(`/api/project/load/${encodeURIComponent(folderName)}`),
  projectFiles:  (folderName)   => apiFetch(`/api/project/files/${encodeURIComponent(folderName)}`),

  // ── Sources ───────────────────────────────────────────────────────────────
  sourcesStatus: ()   => apiFetch('/api/sources/status'),
  testSource:    (id) => apiFetch(`/api/sources/test/${encodeURIComponent(id)}`, { method: 'POST' }),

  // ── Agent: Populate (SSE stream) ──────────────────────────────────────────
  async populate({ projectKeyword, sections, promptTemplate, enabledSources }, onLog, onDone, onError) {
    const res = await fetch(BASE() + '/api/agent/populate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectKeyword, sections, promptTemplate, enabledSources }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const parsed = JSON.parse(line.slice(5).trim());
          if (parsed.message) onLog(parsed.message);
          if (parsed.drafts)  onDone(parsed.drafts);
          if (parsed.error)   onError(parsed.error);
        } catch {}
      }
    }
  },

  // ── Agent: Ask ────────────────────────────────────────────────────────────
  ask: ({ question, projectKeyword, projectFolderName, ktContext, conversationHistory, enabledSources }) =>
    apiFetch('/api/agent/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, projectKeyword, projectFolderName, ktContext, conversationHistory, enabledSources }),
    }),
};
