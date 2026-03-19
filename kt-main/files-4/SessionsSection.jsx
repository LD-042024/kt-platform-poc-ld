import React, { useState } from 'react';
import { useApp } from './AppContext';
import { SECTION_DEFS, calcProgress, countBlocked, fmtDate, uid, safeUrl } from './data';

// â”€â”€ Sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SessionsSection({ proj, data }) {
  const { actions } = useApp();
  const [form, setForm] = useState({ topic: '', date: '', attendees: '', notes: '', openQs: '' });
  const [showForm, setShowForm] = useState(false);

  function submit() {
    if (!form.topic.trim()) return;
    actions.addSession(proj.id, { ...form, id: uid(), loggedAt: new Date().toISOString() });
    setForm({ topic: '', date: '', attendees: '', notes: '', openQs: '' });
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ Log Session'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Log KT Session</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[['Topic / Subject *', 'topic'], ['Date', 'date', 'date'], ['Attendees', 'attendees'], ['Open Questions', 'openQs']].map(([label, key, type]) => (
              <div className="form-group" key={key}>
                <label>{label}</label>
                <input type={type || 'text'} placeholder={label} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Notes</label>
            <textarea rows={2} placeholder="What was covered, decisions made, action itemsâ€¦" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={submit}>Save Session</button>
          </div>
        </div>
      )}

      {data.sessions.length === 0 ? (
        <div className="empty-state">
          <div className="icon">ðŸ¤</div>
          <p>No sessions logged yet.<br />Log a session after each KT meeting.</p>
        </div>
      ) : (
        data.sessions.map((sess, idx) => (
          <div key={sess.id} className="card" style={{ padding: '14px 16px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text4)' }}>#{idx + 1}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{sess.topic}</span>
                  {sess.date && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(sess.date)}</span>}
                  {sess.attendees && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Â· {sess.attendees}</span>}
                </div>
                {sess.notes && <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: sess.openQs ? 4 : 0 }}>{sess.notes}</p>}
                {sess.openQs && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', flexShrink: 0, marginTop: 1 }}>OPEN Q:</span>
                    <span style={{ fontSize: 12, color: '#b45309' }}>{sess.openQs}</span>
                  </div>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text4)' }}
                onClick={() => actions.deleteSession(proj.id, sess.id)}>âœ•</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// â”€â”€ Reverse KT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReverseKTSection({ proj, data }) {
  const { actions } = useApp();
  const sec = SECTION_DEFS.find(s => s.id === 'reverse_kt');
  const fields = sec.fields || [];

  function update(idx, changes) {
    actions.updateReverseKTItem(proj.id, idx, changes);
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderRadius: '6px 6px 0 0' }}>
            <th style={thStyle}>Topic</th>
            {fields.map(f => <th key={f.key} style={thStyle}>{f.label}</th>)}
            <th style={thStyle}>Demonstrated By</th>
            <th style={thStyle}>Notes</th>
            <th style={thStyle}>Recording/Link</th>
          </tr>
        </thead>
        <tbody>
          {data.reverseKT.map((item, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text)' }}>{item.item}</td>
              {fields.map(f => (
                <td key={f.key} style={tdStyle}>
                  <select style={{ fontSize: 11, padding: '2px 4px', width: '100%' }} value={item[f.key] || ''} onChange={e => update(idx, { [f.key]: e.target.value })}>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
              ))}
              {['demonstratedBy', 'notes', 'link'].map(key => (
                <td key={key} style={tdStyle}>
                  <input type="text" value={item[key] || ''} placeholder={key === 'demonstratedBy' ? 'Nameâ€¦' : key === 'link' ? 'URLâ€¦' : 'Notesâ€¦'}
                    style={{ fontSize: 11, padding: '3px 6px' }}
                    onChange={e => update(idx, { [key]: e.target.value })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = { padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' };
const tdStyle = { padding: '8px 12px', verticalAlign: 'middle' };

// â”€â”€ Day 1 Kit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Day1Kit({ data }) {
  const pct = calcProgress(data);
  const blocked = countBlocked(data);

  const critPipelines = (data.checklist.pipelines || []).filter(i => i.type === 'Streaming' || i.type === 'Real-time' || i.docStatus === 'Verified Live').map(i => i.item);
  const contacts = (data.checklist.contacts || []).filter(i => i.docStatus === 'Handover Meeting Done' || i.docStatus === 'Introduced').map(i => i.item);
  const runbooks = (data.checklist.runbooks || []).filter(i => i.docStatus === 'Tested in Prod' || i.docStatus === 'Reviewed').map(i => i.item);
  const blockedItems = [];
  SECTION_DEFS.forEach(sec => {
    if (sec.isSpecial) return;
    (data.checklist[sec.id] || []).forEach(i => {
      if (i.status === 'Blocked') blockedItems.push(`[${sec.label}] ${i.item}`);
    });
  });

  const cards = [
    { icon: 'ðŸ”', title: 'Critical Pipelines', color: 'var(--red)', items: critPipelines, empty: 'Complete Pipeline Inventory first' },
    { icon: 'ðŸ“ž', title: 'Who to Call', color: 'var(--green)', items: contacts, empty: 'Complete Contacts section first' },
    { icon: 'ðŸ“‹', title: 'Runbooks Ready', color: 'var(--blue)', items: runbooks, empty: 'Complete Runbooks section first' },
    { icon: 'âš ï¸', title: 'Blocked / Unresolved', color: 'var(--amber)', items: blockedItems, empty: 'âœ“ No blocked items' },
  ];

  return (
    <div>
      {/* Readiness */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16, borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>KT Readiness</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{pct}%</span>
              <div style={{ width: 120, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--accent)', transition: 'width .4s' }} />
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: pct === 100 ? 'var(--green)' : pct > 60 ? 'var(--accent)' : 'var(--amber)', fontFamily: 'var(--mono)' }}>{pct}%</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{blocked} blocked items</div>
          </div>
        </div>
      </div>

      {/* 4-card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {cards.map(c => (
          <div key={c.title} className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{c.icon} {c.title}</div>
            {(c.items.length ? c.items : [c.empty]).slice(0, 5).map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: c.items.length ? 'var(--text2)' : 'var(--text4)', padding: '3px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                <span style={{ color: c.color, flexShrink: 0 }}>â€º</span>{item}
              </div>
            ))}
            {c.items.length > 5 && <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4 }}>+{c.items.length - 5} more</div>}
          </div>
        ))}
      </div>

      {/* Sessions summary */}
      {data.sessions.length > 0 && (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>ðŸ“… KT Sessions Summary ({data.sessions.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {data.sessions.map(s => <span key={s.id} className="tag" style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{s.topic}</span>)}
          </div>
          {data.sessions.filter(s => s.openQs).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Open Questions</div>
              {data.sessions.filter(s => s.openQs).map(s => (
                <div key={s.id} style={{ fontSize: 12, color: '#92400e', padding: '2px 0' }}>Â· {s.openQs}</div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€ Sign-off â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Signoff({ proj, data }) {
  const { actions } = useApp();
  const so = data.signoff;
  const pct = calcProgress(data);
  const blocked = countBlocked(data);
  const rkDone = data.reverseKT.filter(i => i.status === 'Passed').length;

  function updateSo(changes) {
    actions.updateSignoff(proj.id, changes);
  }

  const canSign = so.outgoingConfirmed && so.incomingConfirmed;

  const parties = [
    { key: 'outgoing', label: 'Outgoing Team', nameKey: 'outgoingName', roleKey: 'outgoingRole', confirmedKey: 'outgoingConfirmed', color: 'var(--accent)', confirmText: 'I confirm the KT documentation is complete and accurate to the best of my knowledge.' },
    { key: 'incoming', label: 'Incoming Team', nameKey: 'incomingName', roleKey: 'incomingRole', confirmedKey: 'incomingConfirmed', color: 'var(--blue)', confirmText: 'I confirm the KT has been received and I have sufficient knowledge to operate independently.' },
  ];

  return (
    <div>
      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Documentation', val: pct + '%', ok: pct > 80, color: pct > 80 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)' },
          { label: 'Blocked Items', val: blocked, ok: blocked === 0, color: blocked === 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'Reverse KT', val: `${rkDone}/${data.reverseKT.length}`, ok: rkDone === data.reverseKT.length, color: rkDone === data.reverseKT.length ? 'var(--green)' : 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center', borderTop: `3px solid ${s.ok ? 'var(--green)' : 'var(--amber)'}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, fontFamily: 'var(--mono)' }}>{String(s.val)}</div>
          </div>
        ))}
      </div>

      {/* Two-party confirmation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {parties.map(party => (
          <div key={party.key} className="card" style={{ padding: 16, borderTop: `3px solid ${party.color}` }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: party.color }}>{party.label}</div>
            {['Name', 'Role'].map(f => {
              const key = party[f.toLowerCase() + 'Key'];
              return (
                <div className="form-group" key={f} style={{ marginBottom: 10 }}>
                  <label>{f}</label>
                  <input type="text" placeholder={f} value={so[key] || ''} onChange={e => updateSo({ [key]: e.target.value })} />
                </div>
              );
            })}
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginTop: 8, fontWeight: 400 }}>
              <input type="checkbox" style={{ marginTop: 3, width: 'auto', accentColor: party.color }}
                checked={so[party.confirmedKey] || false}
                onChange={e => updateSo({ [party.confirmedKey]: e.target.checked })} />
              <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{party.confirmText}</span>
            </label>
          </div>
        ))}
      </div>

      {/* Caveats */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Caveats / Open Items / Exceptions</label>
        <textarea rows={3} placeholder="Document any outstanding items, known gaps, or agreed exceptionsâ€¦"
          value={so.caveats || ''} onChange={e => updateSo({ caveats: e.target.value })} style={{ resize: 'none' }} />
      </div>

      {/* Sign button or confirmation */}
      {so.signedAt ? (
        <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--radius)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>âœ…</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 15 }}>KT Signed Off</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Signed on {fmtDate(so.signedAt)}</div>
          </div>
        </div>
      ) : (
        <button
          style={{
            width: '100%', padding: 12, borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600,
            background: canSign ? 'var(--accent)' : 'var(--surface2)',
            color: canSign ? '#fff' : 'var(--text4)',
            border: `1px solid ${canSign ? 'var(--accent2)' : 'var(--border)'}`,
            cursor: canSign ? 'pointer' : 'not-allowed',
          }}
          onClick={() => { if (canSign) updateSo({ signedAt: new Date().toISOString() }); }}
        >{canSign ? 'âœ“ Confirm Sign-off' : 'Both parties must confirm before signing off'}</button>
      )}
    </div>
  );
}

export { SessionsSection, ReverseKTSection, Day1Kit, Signoff };
