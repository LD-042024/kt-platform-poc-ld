import React, { useState } from 'react';

// ─── Common Styles ────────────────────────────────────────────────────────

const styles = {
  btn: {
    padding: '0.5rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    backgroundColor: 'white',
    color: '#1f2937',
    transition: 'all 0.2s',
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
  },
  btnSmall: {
    padding: '0.25rem 0.75rem',
    fontSize: '0.85rem',
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '1rem',
    backgroundColor: 'white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  input: {
    padding: '0.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
  },
  select: {
    padding: '0.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
};

// ─── Button Component ──────────────────────────────────────────────────────

export function Btn({ children, primary, small, onClick, style, ...props }) {
  const btnStyle = {
    ...styles.btn,
    ...(primary && styles.btnPrimary),
    ...(small && styles.btnSmall),
    ...style,
  };
  return <button onClick={onClick} style={btnStyle} {...props}>{children}</button>;
}

// ─── Card Component ────────────────────────────────────────────────────────

export function Card({ children, style, ...props }) {
  return <div style={{ ...styles.card, ...style }} {...props}>{children}</div>;
}

// ─── Modal Component ───────────────────────────────────────────────────────

export function Modal({ isOpen, title, children, onClose, onConfirm, confirmText = 'Confirm' }) {
  // If isOpen is explicitly false, don't render. If isOpen is undefined/not provided, still render.
  if (isOpen === false) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <Card style={{ minWidth: '400px', maxWidth: '600px' }}>
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>
        )}
        <div style={{ marginBottom: '1.5rem' }}>{children}</div>
        {(onClose || onConfirm) && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            {onClose && <Btn onClick={onClose}>Cancel</Btn>}
            {onConfirm && <Btn primary onClick={onConfirm}>{confirmText}</Btn>}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── ProgressBar Component ─────────────────────────────────────────────────

export function ProgressBar({ percentage, label }) {
  return (
    <div>
      {label && <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>{label}</div>}
      <div style={{
        width: '100%',
        height: '24px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(percentage, 100)}%`,
          backgroundColor: '#10b981',
          transition: 'width 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}>
          {percentage > 10 && `${percentage}%`}
        </div>
        {percentage <= 10 && (
          <div style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>{percentage}%</div>
        )}
      </div>
    </div>
  );
}

// ─── SelectCustom Component ────────────────────────────────────────────────

export function SelectCustom({ value, onChange, options, placeholder = 'Select...', disabled = false }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...styles.select, opacity: disabled ? 0.6 : 1 }}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

// ─── MultiSelectCustom Component ───────────────────────────────────────────

export function MultiSelectCustom({ values = [], onChange, options, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = (option) => {
    const newValues = values.includes(option)
      ? values.filter(v => v !== option)
      : [...values, option];
    onChange(newValues);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.input,
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        <span>{values.length > 0 ? `${values.length} selected` : placeholder}</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 10,
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          {options.map((option) => (
            <label key={option} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              backgroundColor: values.includes(option) ? '#f0f9ff' : 'white',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <input
                type="checkbox"
                checked={values.includes(option)}
                onChange={() => toggle(option)}
                style={{ marginRight: '0.5rem', cursor: 'pointer' }}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Input Component ───────────────────────────────────────────────────────

export function Input({ value, onChange, placeholder, type = 'text', style, ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...styles.input, ...style }}
      {...props}
    />
  );
}

// ─── Textarea Component ────────────────────────────────────────────────────

export function Textarea({ value, onChange, placeholder, rows = 4, style, ...props }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...styles.input, ...style }}
      {...props}
    />
  );
}

// ─── Default Export (for Modal) ────────────────────────────────────────────

export default Modal;
