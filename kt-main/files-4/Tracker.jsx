import React, { useState } from 'react';
import { useApp } from './AppContext';
import { SECTION_DEFS, PHASES, calcProgress, calcSectionProgress, countBlocked, clientColor, fmtDate } from './data';
import { ProgressBar } from './UI';
import ChecklistSection from './ChecklistSection';
import { SessionsSection, ReverseKTSection, Day1Kit, Signoff } from './SessionsSection';

function TrackerSidebar({ data }) {
  const { state, actions } = useApp();
  const { activeSection } = state;
  const groups = ['DOCUMENTATION', 'KT PROCESS', 'COMPLETION'];

  return (
    <div style={{ width: 234, borderRight: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', flexShrink: 0 }}>
      {groups.map(group => (
        <div key={group} style={{ paddingTop: 12 }}>
          <div style={{ padding: '2px 14px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text4)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{group}</div>
          {SECTION_DEFS.filter(s => s.group === group).map(sec => {
            const isActive = activeSection === sec.id;
            const items = sec.isSpecial === 'reverseKT' ? data.reverseKT : sec.isSpecial ? [] : (data.checklist[sec.id] || []);
            const pct = (!sec.isSpecial || sec.isSpecial === 'reverseKT') ? calcSectionProgress(items) : null;
            const isDone = pct === 100;
            const isBlocked = !sec.isSpecial && (data.checklist[sec.id] || []).some(i => i.status === 'Blocked');

            return (
              <button key={sec.id}
                onClick={() => actions.setSection(sec.id)}
                style={{
                  width: '100%', textAlign: 'left', border: 'none', borderRadius: 0,
                  borderLeft: `3px solid ${isActive ? 'var(--accent)' : isDone ? 'var(--green)' : isBlocked ? 'var(--red)' : 'transparent'}`,
                  background: isActive ? 'var(--accent-bg)' : 'transparent',
                  padding: '9px 12px 9px 11px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  background: isActive ? 'rgba(13,148,136,.12)' : isDone ? 'var(--green-bg)' : 'var(--surface2)',
                }}>{sec.icon}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--accent2)' : isDone ? 'var(--green)' : 'var(--text2)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{sec.label}</div>
                </div>

                {pct !== null && (
                  isDone
                    ? <span style={{ fontSize: 11, color: 'var(--green)', flexShrink: 0 }}>✓</span>
                    : pct > 0
                      ? <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 6px', flexShrink: 0 }}>{pct}%</span>
                      : null
                )}
              </button>
            );
          })}
        </div>
      ))}
      <div style={{ height: 16 }} />
    </div>
  );
}

function TrackerHeader({ proj, data }) {
  const { actions } = useApp();
  const pct = calcProgress(data);
  const blocked = countBlocked(data);
  const cc = clientColor(proj.client);

  function updateProj(changes) {
    actions.updateProject({ ...proj, ...changes });
  }

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
      {PHASES.map((ph, i) => {
        const isActive = proj.phase === ph;
        const isDone = PHASES.indexOf(proj.phase) > i;
        return (
          <React.Fragment key={ph}>
            <button
              onClick={() => updateProj({ phase: ph })}
              style={{
                padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isActive ? 'var(--accent)' : isDone ? 'var(--green-border)' : 'var(--border)'}`,
                background: isActive ? 'var(--accent-bg)' : isDone ? 'var(--green-bg)' : 'transparent',
                color: isActive ? 'var(--accent2)' : isDone ? 'var(--green)' : 'var(--text3)',
              }}
            >{(isDone && !isActive ? '✓ ' : '') + ph}</button>
            {i < PHASES.length - 1 && <span style={{ color: 'var(--border2)', fontSize: 10 }}>›</span>}
          </React.Fragment>
        );
      })}

      <div style={{ flex: 1 }} />
      {blocked > 0 && <span className="tag" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>⚠ {blocked} blocked</span>}

      <ProgressBar percentage={pct} />

      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Owner:</span>
      <input type="text" value={proj.owner || ''} placeholder="Owner"
        style={{ width: 110, padding: '3px 7px', fontSize: 11 }}
        onChange={e => updateProj({ owner: e.target.value })} />

      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Due Date:</span>
      <input type="date" value={proj.targetDate || ''}
        style={{ width: 130, padding: '3px 7px', fontSize: 11 }}
        onChange={e => updateProj({ targetDate: e.target.value })} />
    </div>
  );
}

function TrackerCenter({ proj, data }) {
  const { state, actions } = useApp();
  const sec = SECTION_DEFS.find(s => s.id === state.activeSection);
  if (!sec) return <div style={{ flex: 1 }} />;

  const items = sec.isSpecial === 'reverseKT' ? data.reverseKT : sec.isSpecial ? [] : (data.checklist[sec.id] || []);
  const pct = (!sec.isSpecial || sec.isSpecial === 'reverseKT') ? calcSectionProgress(items) : null;
  const draft = data.agentDrafts?.[sec.id];

  // Persistent verify items — saved into project data on Accept so they survive draft dismissal
  const verifyItems = data.verifyItems?.[sec.id] || [];
  const [verifyDismissed, setVerifyDismissed] = React.useState(false);

  function acceptDraft() {
    if (data.checklist[sec.id]) {
      const updated = data.checklist[sec.id].map(item => {
        // New format: draft has per-sub-item content keyed by exact sub-item name.
        // Look up this checklist item's specific draft text first, then fall back gracefully.
        const perItemContent = draft?.items?.[item.item];   // exact match by sub-item name
        const fallbackContent = draft?.content;             // full block if no per-item structure
        return {
          ...item,
          // notes: item.notes || '(Agent draft accepted — verify details)',
          // notes: item.notes || draft.content || '(Agent draft accepted — verify details)',
          // notes: draft?.content || item.notes || '(Agent draft accepted — verify details)',
          notes: perItemContent          // ← specific draft for this sub-item (new format)
              || fallbackContent         // ← full draft block fallback (old format)
              || item.notes              // ← keep existing notes if already filled
              || '(Agent draft accepted — verify details)',
          status: item.status === 'Not Started' ? 'In Progress' : item.status,
        };
      });
      // Persist verify items so they remain visible after draft banner is dismissed
      const existingVerify = data.verifyItems || {};
      const newVerify = { ...existingVerify, [sec.id]: draft?.verify || [] };
      actions.updateProjectData(proj.id, {
        ...data,
        checklist: { ...data.checklist, [sec.id]: updated },
        agentDrafts: { ...data.agentDrafts, [sec.id]: undefined },
        verifyItems: newVerify,
      });
    }
    actions.dismissDraft(proj.id, sec.id);
    setVerifyDismissed(false);
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
      {/* Section header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>{sec.icon}</span>
          <h2>{sec.label}</h2>
          {pct !== null && (pct === 100
            ? <span className="tag" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }}>✓ Complete</span>
            : <span style={{ fontSize: 12, color: 'var(--text3)' }}>{items.filter(i => i.status === 'Done' || i.status === 'Passed').length}/{items.length} done</span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 30 }}>{sec.desc}</p>
      </div>

      {/* Agent draft banner */}
      {draft && !sec.isSpecial && (
        <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent2)', marginBottom: 4 }}>🤖 Agent Draft Available</div>
              {draft.items
                ? Object.entries(draft.items).map(([key, val]) => (
                    <div key={key} style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent2)' }}>{key}</span>
                      <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, margin: '2px 0 0' }}>{val}</p>
                    </div>
                  ))
                : <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{draft.content}</p>
              }
              {draft.verify?.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--accent-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>⚠ Verify manually:</div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {draft.verify.map((v, i) => <li key={i} style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>{v}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="btn btn-sm" style={{ background: 'var(--accent)', color: '#fff', border: 'none' }} onClick={acceptDraft}>✓ Accept</button>
              <button className="btn btn-sm btn-secondary" onClick={() => actions.dismissDraft(proj.id, sec.id)}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent verify block — shown after Accept, dismissed by engineer when done */}
      {!verifyDismissed && verifyItems.length > 0 && !sec.isSpecial && (
        <div style={{ background: 'var(--yellow-bg, #fffbeb)', border: '1px solid var(--yellow-border, #fde68a)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--amber, #92400e)', marginBottom: 6 }}>⚠ Things to verify before marking Done</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {verifyItems.map((v, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{v}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => {
                setVerifyDismissed(true);
                const existingVerify = { ...(data.verifyItems || {}) };
                delete existingVerify[sec.id];
                actions.updateProjectData(proj.id, { ...data, verifyItems: existingVerify });
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text3)', flexShrink: 0, padding: '0 4px' }}
              title="Dismiss verify list"
            >✕</button>
          </div>
        </div>
      )}

      {/* Section content */}
      {sec.isSpecial === 'sessions'  && <SessionsSection proj={proj} data={data} />}
      {sec.isSpecial === 'reverseKT' && <ReverseKTSection proj={proj} data={data} />}
      {sec.isSpecial === 'day1'      && <Day1Kit data={data} />}
      {sec.isSpecial === 'signoff'   && <Signoff proj={proj} data={data} />}
      {!sec.isSpecial                && <ChecklistSection proj={proj} data={data} sec={sec} />}
    </div>
  );
}

export default function Tracker() {
  const { state } = useApp();
  const proj = state.app.projects.find(p => p.id === state.activeProjectId);
  const data = state.projectData[state.activeProjectId];
  if (!proj || !data) return <div style={{ padding: 32, color: 'var(--text3)' }}>Project not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <TrackerHeader proj={proj} data={data} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <TrackerSidebar data={data} />
        <TrackerCenter proj={proj} data={data} />
      </div>
    </div>
  );
}
