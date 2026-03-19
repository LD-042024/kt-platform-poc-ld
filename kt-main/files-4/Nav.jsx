import React from 'react';
import { useApp } from './AppContext';

// Tabs that require an active project to be useful
const PROJECT_TABS = ['tracker', 'agent'];

export default function Nav() {
  const { state, actions } = useApp();

  const tabs = [
    { id: 'dashboard', label: '🏠 Dashboard' },
    { id: 'tracker', label: '📋 Tracker' },
    { id: 'agent', label: '🤖 Agent' },
    { id: 'templates', label: '📝 Templates' },
    { id: 'guide', label: '❓ Guide' },
  ];

  return (
    <nav style={{
      display: 'flex',
      gap: '1rem',
      padding: '0.5rem 1rem',
      backgroundColor: '#f3f4f6',
      borderBottom: '1px solid #d1d5db',
      alignItems: 'center'
    }}>
      <h1 style={{ margin: 0, marginRight: 'auto', fontSize: '1.2rem', fontWeight: 600 }}>
        KT Platform
      </h1>
      {tabs.map(tab => {
        const needsProject = PROJECT_TABS.includes(tab.id);
        const isDisabled = needsProject && !state.activeProjectId;
        const isActive = state.page === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => { if (!isDisabled) actions.setPage(tab.id); }}
            title={isDisabled ? 'Select a project first' : undefined}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              backgroundColor: isActive ? '#3b82f6' : 'transparent',
              color: isActive ? 'white' : isDisabled ? '#9ca3af' : '#1f2937',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontWeight: isActive ? 600 : 400,
              opacity: isDisabled ? 0.5 : 1,
            }}
          >
            {tab.label}
          </button>
        );
      })}
      {state.serverStatus && (
        <div style={{ marginLeft: '1rem', fontSize: '0.85rem', color: state.serverStatus.ok ? '#10b981' : '#ef4444' }}>
          {state.serverStatus.ok ? '✓ Connected' : '✗ Offline'}
        </div>
      )}
    </nav>
  );
}
