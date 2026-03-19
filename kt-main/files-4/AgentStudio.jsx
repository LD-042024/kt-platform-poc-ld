import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { api } from './client';
import { SECTION_DEFS } from './data';

const CONNECTOR_META = {
  github:     { icon:'🐙', label:'GitHub',     desc:'Repos, READMEs, issues, commits, file trees', mcpNote:'Uses MCP when running, falls back to REST', envRequired:['GITHUB_TOKEN'], envOptional:['GITHUB_ORG','GITHUB_MCP_URL'], sections:['biz_context','pipelines','data_sources','infrastructure','data_quality','known_issues','contacts'] },
  confluence: { icon:'📝', label:'Confluence',  desc:'Wiki pages, runbooks, ADRs, design docs', mcpNote:'Optional: @atlassian/mcp-server-confluence', envRequired:['CONFLUENCE_URL','CONFLUENCE_EMAIL','CONFLUENCE_TOKEN'], envOptional:['CONFLUENCE_SPACE','CONFLUENCE_MCP_URL'], sections:['runbooks','known_issues','contacts','infrastructure','biz_context'] },
  database:   { icon:'🗄️', label:'Database',    desc:'Table schemas, column metadata, row counts', mcpNote:'Postgres, MySQL, BigQuery supported', envRequired:['DB_DIALECT'], envOptional:['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD'], sections:['data_context','data_sources','data_quality'] },
  jira:       { icon:'🎯', label:'Jira',        desc:'Epics, bugs, tech debt tickets', mcpNote:'Atlassian Cloud REST API', envRequired:['JIRA_URL','JIRA_EMAIL','JIRA_TOKEN'], envOptional:['JIRA_PROJECT'], sections:['known_issues','runbooks','biz_context'] },
  notion:     { icon:'📓', label:'Notion',      desc:'Databases, pages, docs, runbooks', mcpNote:'Notion API v1', envRequired:['NOTION_TOKEN'], envOptional:['NOTION_DATABASE_ID'], sections:['runbooks','contacts','known_issues','biz_context'] },
};

// ── Populate tab ──────────────────────────────────────────────────────────────
function PopulateTab({ proj, data }) {
  const { state, actions } = useApp();
  const { agentLog, agentRunning } = state;
  const enabledSources = proj.enabledSources || ['github'];

  function updateProj(changes) { actions.updateProject({ ...proj, ...changes }); }

  function toggleSection(secId) {
    const current = proj.selectedSections || [];
    const updated = current.includes(secId) ? current.filter(s => s !== secId) : [...current, secId];
    updateProj({ selectedSections: updated });
  }

  async function runAgent() {
    if (agentRunning) return;
    if (!proj.githubKeyword?.trim() && enabledSources.includes('github')) {
      alert('Enter a GitHub keyword first.'); return;
    }
    const tpl = state.app.templates.find(t => t.id === proj.templateId) || state.app.templates[0];
    actions.setAgentRunning(true);
    actions.setAgentLog([]);

    try {
      await api.populate(
        // { projectKeyword: proj.githubKeyword, sections: proj.selectedSections || [], promptTemplate: tpl, enabledSources },
        { projectKeyword: proj.githubKeyword, sections: proj.selectedSections?.length ? proj.selectedSections : ['biz_context', 'data_context', 'pipelines', 'data_sources', 'environment', 'infrastructure', 'data_quality', 'runbooks', 'known_issues', 'contacts'], promptTemplate: tpl, enabledSources },
        (msg) => actions.appendAgentLog({ message: msg, type: 'log' }),
        (drafts) => {
          actions.setAgentDrafts(proj.id, drafts);
          actions.appendAgentLog({ message: '✅ Done — navigate to KT Tracker to review drafts.', type: 'log' });
        },
        (err) => actions.appendAgentLog({ message: 'Error: ' + err, type: 'error' }),
      );
    } catch (e) {
      actions.appendAgentLog({ message: 'Connection failed: ' + e.message + '. Is the backend running?', type: 'error' });
    }
    actions.setAgentRunning(false);
  }

  const selectedSections = proj.selectedSections || ['biz_context','pipelines','data_sources','infrastructure','data_quality','known_issues','contacts'];
  const draftCount = Object.keys(data.agentDrafts || {}).length;

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ marginBottom: 4 }}>Populate KT</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>The agent scans your connected sources and drafts KT content for review. Nothing is saved until you accept.</p>

      {/* Active sources */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Active sources:</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent2)' }}>{enabledSources.map(s => (CONNECTOR_META[s]?.icon || '🔌') + ' ' + (CONNECTOR_META[s]?.label || s)).join(', ') || 'none'}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => actions.setAgentTab('sources')}>Manage →</button>
      </div>

      {/* Config card */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Source Configuration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>GitHub Search Keyword</label>
            <input type="text" placeholder="e.g. orders-pipeline" value={proj.githubKeyword || ''}
              onChange={e => updateProj({ githubKeyword: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Prompt Template</label>
            <select value={proj.templateId || ''} onChange={e => updateProj({ templateId: e.target.value })}>
              {state.app.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <label style={{ marginBottom: 8 }}>Sections to Populate</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SECTION_DEFS.filter(s => !s.isSpecial).map(sec => {
            const checked = selectedSections.includes(sec.id);
            return (
              <label key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: checked ? 'var(--accent-bg)' : 'var(--surface2)', border: `1px solid ${checked ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: checked ? 600 : 400, color: checked ? 'var(--accent2)' : 'var(--text2)' }}>
                <input type="checkbox" style={{ width: 'auto', margin: 0, accentColor: 'var(--accent)' }} checked={checked} onChange={() => toggleSection(sec.id)} />
                {sec.icon} {sec.label}
              </label>
            );
          })}
        </div>
      </div>

      <button className="btn btn-primary" style={{ fontSize: 14, padding: '10px 28px', marginBottom: 20 }}
        disabled={agentRunning} onClick={runAgent}>
        {agentRunning ? '⏳ Agent Running…' : '▶ Run Agent'}
      </button>

      {/* Agent log */}
      {agentLog.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--bg)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Agent Log</div>
          {agentLog.map((entry, i) => (
            <div key={i} style={{ fontSize: 12, color: entry.type === 'error' ? 'var(--red)' : 'var(--text2)', padding: '3px 0', fontFamily: 'var(--mono)' }}>{entry.message}</div>
          ))}
        </div>
      )}

      {/* Drafts preview */}
      {draftCount > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3>📝 Drafts Ready — {draftCount} sections</h3>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Go to KT Tracker to review each section</span>
          </div>
          {Object.entries(data.agentDrafts || {}).map(([secId, draft]) => {
            const sec = SECTION_DEFS.find(s => s.id === secId);
            return sec ? (
              <div key={secId} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{sec.icon} {sec.label}</div>
                {draft.items
                  ? Object.entries(draft.items).map(([key, val]) => (
                      <div key={key} style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>{key}</span>
                        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, margin: '2px 0 0' }}>{val}</p>
                      </div>
                    ))
                  : <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{draft.content}</p>
                }
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

// ── Ask tab ───────────────────────────────────────────────────────────────────
function AskTab({ proj, data }) {
  const { state, actions } = useApp();
  const { agentRunning, agentConversation, agentQuestion } = state;

  async function sendQuestion() {
    const q = (agentQuestion || '').trim();
    if (!q || agentRunning) return;
    actions.setAgentConversation([...agentConversation, { role: 'user', content: q }]);
    actions.setAgentQuestion('');
    actions.setAgentRunning(true);

    const ktContext = Object.entries(data.checklist).map(([secId, items]) => {
      const sec = SECTION_DEFS.find(s => s.id === secId);
      const done = items.filter(i => i.status === 'Done');
      if (!done.length) return '';
      return `${sec?.label || secId}: ${done.map(i => i.item + (i.notes ? ' (' + i.notes + ')' : '')).join(', ')}`;
    }).filter(Boolean).join('\n');

    try {
      const result = await api.ask({
        question: q, projectKeyword: proj.githubKeyword,
        projectFolderName: proj._folderName || null,
        ktContext, conversationHistory: [...agentConversation, { role: 'user', content: q }].slice(-6),
        enabledSources: proj.enabledSources || ['github'],
      });
      actions.setAgentConversation([...agentConversation, { role: 'user', content: q }, { role: 'assistant', content: result.answer, sources: result.sources }]);
    } catch (e) {
      actions.setAgentConversation([...agentConversation, { role: 'user', content: q }, { role: 'assistant', content: 'Connection failed: ' + e.message + '. Is the backend running?', sources: [] }]);
    }
    actions.setAgentRunning(false);
  }

  const SUGGESTIONS = [
    "What breaks if the main pipeline fails?",
    "Which tables contain sensitive or PII data?",
    "Who should I call for production incidents?",
    "What are the known issues and workarounds?",
    "What's the data refresh cadence for key tables?",
  ];

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ marginBottom: 4 }}>Ask the Agent</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>Ask anything about the project. The agent answers using GitHub data and your KT documentation as context.</p>

      {/* Conversation */}
      {agentConversation.map((msg, i) => {
        const isUser = msg.role === 'user';
        return (
          <div key={i} style={{ marginBottom: 10, display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius)', background: isUser ? 'var(--accent-bg)' : 'var(--surface)', border: `1px solid ${isUser ? 'var(--accent-border)' : 'var(--border)'}`, maxWidth: '85%', fontSize: 13, lineHeight: 1.6 }}>
              {!isUser && msg.sources?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                  {msg.sources.map((s, si) => <span key={si} className="tag" style={{ fontSize: 10 }}>{s}</span>)}
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          </div>
        );
      })}

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <textarea rows={2} placeholder="e.g. What happens when the orders pipeline fails? What are the critical tables?"
          style={{ resize: 'none', flex: 1 }} value={agentQuestion || ''}
          onChange={e => actions.setAgentQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }} />
        <button className="btn btn-primary" style={{ flexShrink: 0, alignSelf: 'flex-end', padding: '10px 16px' }}
          disabled={agentRunning} onClick={sendQuestion}>
          {agentRunning ? '…' : 'Send ↑'}
        </button>
      </div>

      {agentConversation.length > 0 && (
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}
          onClick={() => { actions.setAgentConversation([]); actions.setAgentQuestion(''); }}>
          ✕ Clear conversation
        </button>
      )}

      {/* Suggestions */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Suggested Questions</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUGGESTIONS.map(q => (
            <button key={q} className="btn btn-secondary btn-sm" style={{ fontSize: 11, borderRadius: 20 }}
              onClick={() => actions.setAgentQuestion(q)}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sources tab ───────────────────────────────────────────────────────────────
function SourcesTab({ proj }) {
  const { state, actions } = useApp();
  const { sourcesStatus, sourcesLoading } = state;
  const [testingId, setTestingId] = useState(null);

  useEffect(() => {
    if (!sourcesStatus && !sourcesLoading && state.serverStatus?.ok) {
      loadSources();
    }
  }, []);

  async function loadSources() {
    actions.setSourcesLoading(true);
    try {
      const result = await api.sourcesStatus();
      actions.setSourcesStatus(result.connectors || {});
    } catch {
      actions.setSourcesStatus({});
    }
  }

  async function testSource(id) {
    setTestingId(id);
    try {
      const result = await api.testSource(id);
      actions.setSourcesStatus({
        ...(sourcesStatus || {}),
        [id]: { ...(sourcesStatus?.[id] || {}), connected: result.ok, error: result.error || null, mode: result.mode || null },
      });
    } catch (e) {
      actions.setSourcesStatus({
        ...(sourcesStatus || {}),
        [id]: { ...(sourcesStatus?.[id] || {}), connected: false, error: e.message },
      });
    }
    setTestingId(null);
  }

  function toggleSource(id) {
    const current = proj.enabledSources || [];
    const updated = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
    actions.updateProject({ ...proj, enabledSources: updated });
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ marginBottom: 4 }}>Source Connectors</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>Choose which sources the agent scans. Each source requires credentials in your .env file on the backend server.</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sourcesLoading ? 'Loading…' : sourcesStatus ? 'Status loaded' : 'Not yet loaded'}</div>
        <button className="btn btn-secondary btn-sm" onClick={loadSources} disabled={sourcesLoading}>{sourcesLoading ? '⏳ Checking…' : '↺ Refresh Status'}</button>
      </div>

      {Object.entries(CONNECTOR_META).map(([id, meta]) => {
        const live = sourcesStatus?.[id];
        const isEnabled = (proj.enabledSources || []).includes(id);
        const isConfigured = live?.configured ?? false;
        const isConnected = live?.connected ?? false;
        const pillColor = isConnected ? 'var(--green)' : isConfigured ? 'var(--amber)' : 'var(--text4)';
        const pillText = isConnected ? '● Connected' : isConfigured ? '◐ Configured' : '○ Not configured';

        return (
          <div key={id} className="card" style={{ padding: 18, marginBottom: 12, borderLeft: `3px solid ${isConnected ? 'var(--green)' : isEnabled ? 'var(--accent)' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
                <input type="checkbox" style={{ width: 'auto', accentColor: 'var(--accent)' }} checked={isEnabled} onChange={() => toggleSource(id)} />
              </label>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: pillColor, fontWeight: 600 }}>{pillText}</span>
                  {live?.mode && <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 10 }}>via {live.mode.toUpperCase()}</span>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{meta.desc}</p>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>⚡ {meta.mcpNote}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {meta.sections.map(secId => {
                    const sec = SECTION_DEFS.find(s => s.id === secId);
                    return sec ? <span key={secId} style={{ fontSize: 10, background: 'var(--surface2)', color: 'var(--text3)', padding: '2px 7px', borderRadius: 10, border: '1px solid var(--border)' }}>{sec.icon} {sec.label}</span> : null;
                  })}
                </div>

                {!isConfigured && live !== undefined && (
                  <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>Required in .env: </span>{meta.envRequired.join('  •  ')}
                  </div>
                )}
                {live?.error && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 6 }}>⚠ {live.error}</div>}
              </div>

              {isConfigured && (
                <button className="btn btn-sm btn-secondary" style={{ flexShrink: 0, alignSelf: 'flex-start' }}
                  disabled={testingId === id} onClick={() => testSource(id)}>
                  {testingId === id ? 'Testing…' : 'Test'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Tip: enabled sources are used for both Populate KT and Ask Agent. Only configured sources (with valid .env credentials) will actually run.</p>
    </div>
  );
}

// ── Config tab ────────────────────────────────────────────────────────────────
function ConfigTab({ proj }) {
  const { state, actions } = useApp();
  const { serverStatus } = state;

  async function checkStatus() {
    try {
      const data = await api.status();
      actions.setServerStatus({ ok: true, ...data });
    } catch (e) {
      actions.setServerStatus({ ok: false, error: e.message });
    }
  }

  const activeTpl = state.app.templates.find(t => t.id === proj.templateId) || state.app.templates[0];

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginBottom: 4 }}>Agent Configuration</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>Configure how the agent scans and summarises your project.</p>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14 }}>Backend Connection</h3>
        <div className="form-group">
          <label>Backend Server URL</label>
          <input type="text" value={state.app.serverUrl || 'http://localhost:3001'}
            onChange={e => actions.setServerUrl(e.target.value)} />
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Run `node server.js` in your project directory to start the backend.</p>
        </div>
        <button className="btn btn-secondary" onClick={checkStatus}>↺ Check Connection</button>

        {serverStatus && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: serverStatus.ok ? 'var(--green)' : 'var(--red)', marginBottom: 6 }}>
              {serverStatus.ok ? '✓ Backend connected' : '✗ Backend offline'}
            </div>
            {serverStatus.ok ? (
              ['github', 'claude'].map(src => {
                const s = serverStatus.sources?.[src] || {};
                return (
                  <div key={src} style={{ color: s.connected ? 'var(--green)' : s.configured ? 'var(--amber)' : 'var(--red)' }}>
                    {s.connected ? '✓' : s.configured ? '⚠' : '✗'} {src.charAt(0).toUpperCase() + src.slice(1)}: {s.connected ? 'connected' : s.configured ? 'configured but not verified' : 'not configured'}
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--text3)' }}>{serverStatus.error || 'Could not reach backend. Is the server running?'}</div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 4 }}>Active Prompt Template</h3>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Control how the agent interprets and summarises GitHub data for this project.</p>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Template</label>
          <select value={proj.templateId || ''} onChange={e => actions.updateProject({ ...proj, templateId: e.target.value })}>
            {state.app.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {activeTpl && (
          <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{activeTpl.name}</div>
            {[['Scan Depth', activeTpl.scanDepth], ['Focus', activeTpl.focusAreas?.join(', ') || '—'], ['Output', activeTpl.outputStyle]].map(([k, v]) => (
              <div key={k} style={{ color: 'var(--text2)', marginBottom: 2 }}><span style={{ fontWeight: 600, color: 'var(--text3)' }}>{k}: </span>{v || '—'}</div>
            ))}
            {activeTpl.customContext && <div style={{ color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>"{activeTpl.customContext}"</div>}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => actions.setPage('templates')}>Manage Templates →</button>
        </div>
      </div>
    </div>
  );
}

// ── Agent Studio shell ────────────────────────────────────────────────────────
export default function AgentStudio() {
  const { state, actions } = useApp();
  const { agentTab, sourcesStatus, serverStatus } = state;
  const proj = state.app.projects.find(p => p.id === state.activeProjectId);
  const data = state.projectData[state.activeProjectId];
  if (!proj || !data) return <div style={{ padding: 32, color: 'var(--text3)' }}>Select a project first.</div>;

  const connectedCount = sourcesStatus ? Object.values(sourcesStatus).filter(s => s.connected).length : 0;
  const tabs = [['populate', 'Populate KT'], ['ask', 'Ask Agent'], ['sources', 'Sources'], ['config', 'Configuration']];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 14, marginRight: 20, color: 'var(--text)' }}>🤖 Agent Studio</span>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => actions.setAgentTab(id)}
            style={{ padding: '12px 16px', border: 'none', borderBottom: `2px solid ${agentTab === id ? 'var(--accent)' : 'transparent'}`, background: 'transparent', fontSize: 13, fontWeight: agentTab === id ? 600 : 400, color: agentTab === id ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: connectedCount > 0 ? 'var(--green)' : 'var(--text4)', display: 'inline-block' }} />
          {connectedCount > 0 ? `${connectedCount} source${connectedCount > 1 ? 's' : ''} connected` : 'No sources connected'}
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            try { const d = await api.status(); actions.setServerStatus({ ok: true, ...d }); } catch (e) { actions.setServerStatus({ ok: false, error: e.message }); }
          }}>↺ Check</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {agentTab === 'populate' && <PopulateTab proj={proj} data={data} />}
        {agentTab === 'ask'      && <AskTab proj={proj} data={data} />}
        {agentTab === 'sources'  && <SourcesTab proj={proj} />}
        {agentTab === 'config'   && <ConfigTab proj={proj} />}
      </div>
    </div>
  );
}
