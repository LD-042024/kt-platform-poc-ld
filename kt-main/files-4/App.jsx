import React, { useEffect } from 'react';
import { AppProvider, useApp } from './AppContext';
import { api } from './client';
import Nav from './Nav';
import Dashboard from './Dashboard';
import Tracker from './Tracker';
import AgentStudio from './AgentStudio';
import Templates from './Templates';
import Guide from './Guide';

function AppInner() {
  const { state, actions } = useApp();

  // Check server status on mount + every 30s
  useEffect(() => {
    async function check() {
      try {
        const data = await api.status();
        actions.setServerStatus({ ok: true, ...data });
      } catch (e) {
        actions.setServerStatus({ ok: false, error: e.message });
      }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load projects from backend on mount (sync with what's saved on disk)
  useEffect(() => {
    async function loadProjects() {
      try {
        const result = await api.listProjects();
        if (result && result.projects && Array.isArray(result.projects)) {
          // Only load projects from backend that aren't already in local state
          const existingIds = new Set(state.app.projects.map(p => p.id));
          for (const proj of result.projects) {
            if (!existingIds.has(proj.id)) {
              const loaded = await api.loadProject(proj._folderName || proj.folderName);
              if (loaded && loaded.project) {
                actions.addProject(loaded.project);
                if (loaded.projectData) {
                  actions.updateProjectData(loaded.project.id, loaded.projectData);
                }
              }
            }
          }
        }
      } catch (e) {
        // Silently fail - projects may not exist on backend yet
      }
    }
    loadProjects();
  }, []);

  const pages = {
    dashboard: <Dashboard />,
    tracker:   <Tracker />,
    agent:     <AgentStudio />,
    templates: <Templates />,
    guide:     <Guide />,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Nav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {pages[state.page] || <Dashboard />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
