import React, { useState } from 'react';
import { useApp } from './AppContext';
import { SECTION_DEFS, DEFAULT_CHECKLIST_ITEMS, safeUrl } from './data';
import { MultiSelectCustom, SelectCustom } from './UI';

const STATUS_COLORS = {
  'Not Started': '#cbd5e1',
  'In Progress': 'var(--blue)',
  'Done': 'var(--green)',
  'Blocked': 'var(--red)',
};

const STATUS_BG = {
  'Not Started': { bg: 'var(--surface2)', color: 'var(--text3)', border: 'var(--border)' },
  'In Progress': { bg: 'var(--blue-bg)', color: 'var(--blue)', border: 'var(--blue-border)' },
  'Done':        { bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)' },
  'Blocked':     { bg: 'var(--red-bg)', color: 'var(--red)', border: 'var(--red-border)' },
};

function FieldInput({ field, value, onChange }) {
  if (field.type === 'multiselect-custom') {
    return <MultiSelectCustom options={field.options} values={Array.isArray(value) ? value : (value ? [value] : [])} onChange={onChange} />;
  }
  if (field.type === 'select-custom') {
    return <SelectCustom options={field.options} value={value} onChange={onChange} />;
  }
  return (
    <select style={{ fontSize: 11, padding: '3px 6px' }} value={value || ''} onChange={e => onChange(e.target.value)}>
      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ChecklistItem({ item, idx, sec, projectId, isLast }) {
  const { actions } = useApp();
  const [open, setOpen] = useState(false);

  const isDone = item.status === 'Done';
  const isBlocked = item.status === 'Blocked';
  const isIP = item.status === 'In Progress';
  const accentColor = isDone ? 'var(--green)' : isBlocked ? 'var(--red)' : isIP ? 'var(--blue)' : 'var(--border2)';
  const dotColor = STATUS_COLORS[item.status] || '#cbd5e1';
  const statusStyle = STATUS_BG[item.status] || STATUS_BG['Not Started'];
  const fields = sec.fields || [];

  function update(changes) {
    actions.updateChecklistItem(projectId, sec.id, idx, changes);
  }

  const borderRadiusStyle = idx === 0
    ? (isLast ? 'var(--radius)' : '6px 6px 0 0')
    : (isLast ? '0 0 6px 6px' : '0');

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${accentColor}`, borderRadius: borderRadiusStyle,
      borderTop: idx > 0 ? 'none' : undefined,
      boxShadow: open ? '0 0 0 2px var(--accent-border)' : undefined,
    }}>
      {/* Header row — click to expand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 1, background: dotColor }} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.45, color: isDone ? 'var(--text4)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
          {item.item}
        </div>

        {/* Badges when collapsed */}
        {!open && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="tag" style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, fontSize: 10 }}>{item.status}</span>
            {fields.map(f => {
              const rawVal = item[f.key];
              const strVal = Array.isArray(rawVal) ? rawVal.join(',') : String(rawVal ?? '');
              if (!strVal || strVal === (f.options?.[0] || '')) return null;
              return (
                <span key={f.key} className="tag" style={{ fontSize: 10, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                  {strVal.split(',')[0].trim()}{strVal.includes(',') ? ' +' : ''}
                </span>
              );
            })}
            {item.notes && <span style={{ fontSize: 10, color: 'var(--text4)' }}>📝</span>}
            {item.link && <a href={safeUrl(item.link)} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}>↗</a>}
          </div>
        )}
        <span style={{ fontSize: 10, color: 'var(--text4)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Edit form */}
      {open && (
        <div style={{ padding: '10px 14px 14px 32px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Status + Fields row */}
          <div style={{ display: 'grid', gridTemplateColumns: `120px ${fields.map(() => '1fr').join(' ')}`, gap: 10, alignItems: 'start' }}>
            <div>
              <label>Status</label>
              <select style={{ fontSize: 11, padding: '3px 6px' }} value={item.status}
                onChange={e => update({ status: e.target.value })}>
                {['Not Started','In Progress','Done','Blocked'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {fields.map(f => (
              <div key={f.key}>
                <label>{f.label}</label>
                <FieldInput field={f} value={item[f.key] || ''} onChange={v => update({ [f.key]: v })} />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label>Notes</label>
            <textarea rows={4} placeholder="Add notes, context, caveats…" value={item.notes || ''}
              onChange={e => update({ notes: e.target.value })}
              style={{ resize: 'none', fontSize: 12 }} />
          </div>

          {/* Link */}
          <div>
            <label>Resource Link</label>
            <input type="url" placeholder="https://…" value={item.link || ''}
              onChange={e => update({ link: e.target.value })}
              style={{ fontSize: 12 }} />
            {item.link && safeUrl(item.link) !== '#' && (
              <a href={safeUrl(item.link)} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: 'var(--accent)', display: 'inline-block', marginTop: 4 }}>
                Open link ↗
              </a>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>✓ Done editing</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChecklistSection({ proj, data, sec }) {
  const { actions } = useApp();
  const [allOpen, setAllOpen] = useState(false);

  // Ensure items exist, heal if missing
  let items = data.checklist[sec.id];
  if (!items) {
    const freshItems = DEFAULT_CHECKLIST_ITEMS[sec.id] || [];
    items = freshItems.map(item => ({
      item, notes: '', link: '', status: 'Not Started',
      ...Object.fromEntries((sec.fields || []).map(f => [f.key, ''])),
    }));
    actions.updateProjectData(proj.id, {
      ...data,
      checklist: { ...data.checklist, [sec.id]: items },
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setAllOpen(o => !o)}>
          {allOpen ? '✓ Collapse All' : '✏ Expand All'}
        </button>
      </div>
      {items.map((item, idx) => (
        <ChecklistItem
          key={idx} item={item} idx={idx} sec={sec}
          projectId={proj.id} isLast={idx === items.length - 1}
        />
      ))}
    </div>
  );
}
