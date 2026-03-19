import React, { useState } from 'react';
import { useApp } from './AppContext';
import { DEFAULT_TEMPLATES, SECTION_DEFS, uid } from './data';
import Modal from './Modal';

const FOCUS_OPTIONS = ['Code structure', 'Data inventory', 'Known issues', 'Documentation', 'Security signals', 'Performance', 'Dependencies', 'Testing'];
const DEPTH_OPTIONS = ['Surface', 'Medium', 'Deep'];

function TemplateEditor({ template, onSave, onClose }) {
  const isNew = !template;
  const [form, setForm] = useState(template
    ? JSON.parse(JSON.stringify(template))
    : { id: uid(), name: '', scanDepth: 'Medium', focusAreas: ['Code structure', 'Documentation'], outputStyle: 'Short paragraphs', customContext: '', perSection: {} }
  );

  function toggleFocus(area) {
    const current = form.focusAreas || [];
    setForm(f => ({ ...f, focusAreas: current.includes(area) ? current.filter(a => a !== area) : [...current, area] }));
  }

  function setPerSection(secId, val) {
    const ps = { ...form.perSection };
    if (val === '—') delete ps[secId]; else ps[secId] = val;
    setForm(f => ({ ...f, perSection: ps }));
  }

  function handleSave() {
    if (!form.name.trim()) { alert('Template name required'); return; }
    onSave(form, isNew);
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ width: 540 }}>
        <h2 style={{ marginBottom: 4 }}>{isNew ? 'New Template' : 'Edit Template'}</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Configure how the agent interprets and summarises project data.</p>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Template Name *</label>
          <input type="text" placeholder="e.g. Compliance-Sensitive" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Scan Depth</label>
            <select value={form.scanDepth} onChange={e => setForm(f => ({ ...f, scanDepth: e.target.value }))}>
              {DEPTH_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Output Style</label>
            <select value={form.outputStyle} onChange={e => setForm(f => ({ ...f, outputStyle: e.target.value }))}>
              {['Bullet points', 'Short paragraphs', 'Detailed narrative', 'Table format'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Focus Areas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {FOCUS_OPTIONS.map(area => {
              const checked = (form.focusAreas || []).includes(area);
              return (
                <label key={area} style={{ display: 'flex', alignItems: 'center', gap: 4, background: checked ? 'var(--accent-bg)' : 'var(--surface2)', border: `1px solid ${checked ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: checked ? 'var(--accent2)' : 'var(--text2)' }}>
                  <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={checked} onChange={() => toggleFocus(area)} />
                  {area}
                </label>
              );
            })}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Custom Context (injected into every prompt)</label>
          <textarea rows={2} placeholder="e.g. Focus on PII data, access controls, and compliance requirements."
            value={form.customContext} onChange={e => setForm(f => ({ ...f, customContext: e.target.value }))} style={{ resize: 'none' }} />
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label>Per-Section Depth Overrides</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {SECTION_DEFS.filter(s => !s.isSpecial).map(sec => (
              <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px' }}>
                <span style={{ fontSize: 11, color: 'var(--text2)', flex: 1 }}>{sec.icon} {sec.label}</span>
                <select style={{ fontSize: 11, padding: '2px 4px', width: 80 }}
                  value={form.perSection?.[sec.id] || '—'}
                  onChange={e => setPerSection(sec.id, e.target.value)}>
                  {['—', ...DEPTH_OPTIONS].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{isNew ? 'Create Template' : 'Save Changes'}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Templates() {
  const { state, actions } = useApp();
  const { app } = state;
  const [editingId, setEditingId] = useState(null); // '__new__' for new, or template id

  function saveTemplate(form, isNew) {
    const templates = isNew
      ? [...app.templates, form]
      : app.templates.map(t => t.id === form.id ? form : t);
    actions.setTemplates(templates);
    setEditingId(null);
  }

  const editingTemplate = editingId === '__new__' ? null : app.templates.find(t => t.id === editingId);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
      {editingId && (
        <TemplateEditor
          template={editingTemplate}
          onSave={saveTemplate}
          onClose={() => setEditingId(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1>Prompt Templates</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>Configure how the agent scans and summarises projects. Each template is reusable across projects.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditingId('__new__')}>+ New Template</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {app.templates.map(tpl => {
          const isBuiltIn = DEFAULT_TEMPLATES.some(d => d.id === tpl.id);
          const overrides = Object.entries(tpl.perSection || {});
          return (
            <div key={tpl.id} className="card" style={{ padding: 18, borderTop: '3px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{tpl.name}</div>
                  {isBuiltIn && <span className="tag" style={{ fontSize: 10 }}>Built-in</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(tpl.id)}>Edit</button>
                  {!isBuiltIn && (
                    <button className="btn btn-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}
                      onClick={() => { if (confirm('Delete template?')) actions.setTemplates(app.templates.filter(t => t.id !== tpl.id)); }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {[['Scan Depth', tpl.scanDepth], ['Focus Areas', (tpl.focusAreas || []).join(', ') || '—'], ['Output Style', tpl.outputStyle]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text3)', minWidth: 90 }}>{k}:</span>
                  <span style={{ color: 'var(--text2)' }}>{v}</span>
                </div>
              ))}

              {tpl.customContext && (
                <p style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>"{tpl.customContext}"</p>
              )}

              {overrides.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Per-section overrides</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {overrides.map(([secId, depth]) => {
                      const sec = SECTION_DEFS.find(s => s.id === secId);
                      return sec ? <span key={secId} className="tag" style={{ fontSize: 10 }}>{sec.icon} {sec.label}: {depth}</span> : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
