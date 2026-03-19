import React, { useState } from 'react';
import { useApp } from './AppContext';
import { api } from './client';
import { calcProgress, countBlocked, fmtDate, clientColor, uid, PHASES, CLIENT_COLORS } from './data';
import { Btn, Card, Modal, ProgressBar } from './UI';

function CircleProgress({ pct }) {
  const r = 18, circ = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" style={{ transform:'rotate(-90deg)' }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border2)" strokeWidth="3" />
      <circle cx="22" cy="22" r={r} fill="none"
        stroke={pct === 100 ? 'var(--green)' : 'var(--accent)'}
        strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        style={{ transition:'stroke-dashoffset .5s' }}
      />
    </svg>
  );
}

function NewProjectModal({ onClose }) {
  const { actions } = useApp();
  const { app } = useApp().state;
  const [form, setForm] = useState({
    name:'', client: Object.keys(CLIENT_COLORS)[0], phase: PHASES[0],
    owner:'', incomingTeam:'', targetDate:'',
    templateId: app.templates[0]?.id || '',
    githubKeyword:'', description:'',
  });
  const [nameError, setNameError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate() {
    if (!form.name.trim()) { setNameError(true); return; }
    setIsSaving(true);
    try {
      const project = {
        ...form,
        id: uid(),
        selectedSections: ['biz_context','pipelines','data_sources','infrastructure','data_quality','known_issues','contacts'],
        enabledSources: ['github'],
        createdAt: new Date().toISOString(),
      };
      
      // Initialize empty project data
      const projectData = {
        checklist: {
          biz_context: [],
          pipelines: [],
          data_sources: [],
          infrastructure: [],
          data_quality: [],
          known_issues: [],
          contacts: [],
        },
        reverseKT: [],
        sessions: [],
        signoff: {
          outgoingName: '',
          outgoingRole: '',
          outgoingConfirmed: false,
          incomingName: '',
          incomingRole: '',
          incomingConfirmed: false,
          caveats: '',
          signedAt: null,
        },
        agentDrafts: [],
      };
      
      // Save to backend
      const result = await api.saveProject(project, projectData);
      if (result && result.ok === false) {
        alert('Failed to save project: ' + (result.error || 'Unknown error'));
        return;
      }
      
      // Add to local state only after successful backend save
      actions.addProject(project);
      onClose();
    } catch (e) {
      alert('Error creating project: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  }

  const inp = (label, key, type='text', placeholder='') => (
    <div className="form-group" style={{ marginBottom:12 }}>
      <label>{label}</label>
      <input type={type} placeholder={placeholder||label} value={form[key]}
        style={{ borderColor: key==='name' && nameError ? 'var(--red)' : undefined }}
        onChange={e => { setForm(f => ({...f,[key]:e.target.value})); if(key==='name') setNameError(false); }} />
    </div>
  );

  const sel = (label, key, options, labelFn) => (
    <div className="form-group" style={{ marginBottom:12 }}>
      <label>{label}</label>
      <select value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))}>
        {options.map(o => <option key={o} value={o}>{labelFn ? labelFn(o) : o}</option>)}
      </select>
    </div>
  );

  return (
    <Modal onClose={onClose}>
      <div style={{ width:500 }}>
        <h2 style={{ marginBottom:6 }}>New KT Project</h2>
        <p style={{ fontSize:12, color:'var(--text3)', marginBottom:20 }}>Fill in the details below. You can edit everything later.</p>

        {inp('Project Name *', 'name', 'text', 'e.g. Orders Pipeline — Team Handoff')}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {sel('Client', 'client', Object.keys(CLIENT_COLORS))}
          {sel('Phase', 'phase', PHASES)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {inp('Outgoing Team / Owner', 'owner', 'text', 'e.g. Data Eng Team A')}
          {inp('Incoming Team', 'incomingTeam', 'text', 'e.g. Data Eng Team B')}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {inp('Target Handover Date', 'targetDate', 'date')}
          {sel('Prompt Template', 'templateId', app.templates.map(t=>t.id), id => app.templates.find(t=>t.id===id)?.name || id)}
        </div>
        {inp('GitHub Search Keyword', 'githubKeyword', 'text', 'e.g. orders-pipeline (used by Agent)')}

        <div className="form-group" style={{ marginBottom:12 }}>
          <label>Description (optional)</label>
          <textarea rows={2} placeholder="Short description…" value={form.description}
            onChange={e => setForm(f => ({...f,description:e.target.value}))}
            style={{ resize:'none' }} />
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          <Btn onClick={onClose} disabled={isSaving}>Cancel</Btn>
          <Btn primary onClick={handleCreate} disabled={isSaving}>{isSaving ? '⏳ Saving…' : 'Create Project →'}</Btn>
        </div>
      </div>
    </Modal>
  );
}

export default function Dashboard() {
  const { state, actions } = useApp();
  const { app, projectData, showNewProject, serverStatus } = state;
  const [loadingDisk, setLoadingDisk] = useState(false);

  async function handleLoadFromDisk() {
    setLoadingDisk(true);
    try {
      const result = await api.listProjects();
      if (!result.ok) { alert('Could not list projects: ' + result.error); return; }
      if (!result.projects.length) { alert('No saved projects found in kt-data/ folder.'); return; }

      // Simple picker dialog using prompt-style approach
      const names = result.projects.map((p, i) => `${i+1}. ${p.name} (${p.client || ''} · saved ${fmtDate(p.savedAt)})`).join('\n');
      const choice = prompt(`Choose a project to load:\n\n${names}\n\nEnter number:`);
      if (!choice) return;
      const idx = parseInt(choice) - 1;
      const chosen = result.projects[idx];
      if (!chosen) { alert('Invalid selection'); return; }

      const loaded = await api.loadProject(chosen._folderName || chosen.folderName);
      if (!loaded.ok) { alert('Load failed: ' + loaded.error); return; }
      actions.loadProjectFromDisk(loaded.project, loaded.projectData);
    } catch (e) {
      alert('Could not reach backend: ' + e.message);
    } finally {
      setLoadingDisk(false);
    }
  }

  const signedOff = app.projects.filter(p => projectData[p.id]?.signoff?.signedAt).length;

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      {showNewProject && <NewProjectModal onClose={() => actions.showNewProject(false)} />}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ marginBottom:4 }}>KT Dashboard</h1>
          <p style={{ color:'var(--text3)', fontSize:13 }}>
            {app.projects.length} project{app.projects.length!==1?'s':''} · {signedOff} signed off
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {serverStatus?.ok && (
            <Btn onClick={handleLoadFromDisk} disabled={loadingDisk}>
              {loadingDisk ? '⏳ Loading…' : '📂 Load from Disk'}
            </Btn>
          )}
          <Btn primary onClick={() => actions.showNewProject(true)}>+ New Project</Btn>
        </div>
      </div>

      {/* Project grid */}
      {app.projects.length === 0 ? (
        <div className="empty-state" style={{ marginTop:48 }}>
          <div className="icon">📋</div>
          <p style={{ fontSize:16, fontWeight:600, marginBottom:6, color:'var(--text)' }}>No projects yet</p>
          <p>Click "+ New Project" to create your first KT project.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px,1fr))', gap:16 }}>
          {app.projects.map(proj => {
            const data = projectData[proj.id];
            const pct = calcProgress(data);
            const blocked = countBlocked(data);
            const cc = clientColor(proj.client);

            return (
              <Card key={proj.id} style={{ padding:18, cursor:'pointer', position:'relative', borderTop:`3px solid ${cc}` }}
                onClick={() => { actions.setProject(proj.id); actions.setPage('tracker'); }}>

                {/* Delete btn */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`Delete project "${proj.name}"?`)) actions.deleteProject(proj.id);
                  }}
                  style={{ position:'absolute', top:8, right:8, background:'transparent', border:'none', color:'var(--text4)', fontSize:14, cursor:'pointer', padding:'2px 8px', borderRadius:4 }}
                >✕</button>

                {/* Header */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:2 }}>{proj.name}</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span className="tag" style={{ background:`${cc}18`, color:cc, border:`1px solid ${cc}30` }}>{proj.client}</span>
                      <span className="tag" style={{ background:'var(--surface2)', color:'var(--text3)', border:'1px solid var(--border)' }}>{proj.phase}</span>
                      {blocked > 0 && <span className="tag" style={{ background:'var(--red-bg)', color:'var(--red)', border:'1px solid var(--red-border)' }}>⚠ {blocked} blocked</span>}
                    </div>
                  </div>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <CircleProgress pct={pct} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color: pct===100?'var(--green)':'var(--text2)', fontFamily:'var(--mono)' }}>{pct}%</div>
                  </div>
                </div>

                {proj.description && (
                  <p style={{ fontSize:12, color:'var(--text3)', marginBottom:10, lineHeight:1.5 }}>{proj.description}</p>
                )}

                <hr style={{ border:'none', borderTop:'1px solid var(--border)', margin:'10px 0' }} />

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--text4)' }}>{proj.owner ? `Owner: ${proj.owner}` : 'No owner set'}</span>
                  <span style={{ fontSize:11, color:'var(--text4)' }}>{proj.targetDate ? `Due ${fmtDate(proj.targetDate)}` : 'No due date'}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
