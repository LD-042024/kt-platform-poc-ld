import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { initAppState, initProjectData, DEFAULT_TEMPLATES, uid } from './data.js';

const STORAGE_KEY = 'kt_platform_v3';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function slugify(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildInitialState() {
  const saved = loadPersistedState();
  const freshApp = initAppState();

  let app = freshApp;
  let projectData = {};

  if (saved) {
    // Deduplicate projects by folder slug — disk enforces one folder per project name.
    // Keep the last entry per slug (most recently added/updated wins).
    const seen = new Map();
    for (const p of (saved.app?.projects || [])) {
      const key = p._folderName || slugify(p.name);
      seen.set(key, p);
    }
    app = { ...freshApp, ...saved.app, projects: Array.from(seen.values()) };
    if (!app.templates?.length) app.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));

    Object.entries(saved.projectData || {}).forEach(([id, data]) => {
      const fresh = initProjectData(id);
      projectData[id] = {
        ...fresh, ...data,
        checklist: { ...fresh.checklist, ...(data.checklist || {}) },
        reverseKT: data.reverseKT || fresh.reverseKT,
        sessions: data.sessions || [],
        signoff: { ...fresh.signoff, ...(data.signoff || {}) },
        agentDrafts: data.agentDrafts || {},
      };
    });
  }

  return {
    app,
    projectData,
    page: 'dashboard',
    activeProjectId: null,
    activeSection: 'biz_context',
    agentTab: 'populate',
    serverStatus: null,
    sourcesStatus: null,
    sourcesLoading: false,
    saving: false,
    lastSaved: null,
    agentLog: [],
    agentRunning: false,
    agentQuestion: '',
    agentAnswer: null,
    agentConversation: [],
    showNewProject: false,
    editTemplateId: null,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PAGE':        return { ...state, page: action.page, ...(action.extra || {}) };
    case 'SET_SECTION':     return { ...state, activeSection: action.section };
    case 'SET_AGENT_TAB':   return { ...state, agentTab: action.tab };
    case 'SET_PROJECT':     return { ...state, activeProjectId: action.id };
    case 'SHOW_NEW_PROJECT':return { ...state, showNewProject: action.show };
    case 'SET_EDIT_TEMPLATE':return { ...state, editTemplateId: action.id };
    case 'SET_SERVER_STATUS':return { ...state, serverStatus: action.status };
    case 'SET_SOURCES_STATUS':return { ...state, sourcesStatus: action.status, sourcesLoading: false };
    case 'SET_SOURCES_LOADING':return { ...state, sourcesLoading: action.loading };
    case 'SET_SAVING':      return { ...state, saving: action.saving };
    case 'SET_LAST_SAVED':  return { ...state, lastSaved: action.ts };
    case 'SET_AGENT_RUNNING':return { ...state, agentRunning: action.running };
    case 'SET_AGENT_LOG':   return { ...state, agentLog: action.log };
    case 'APPEND_AGENT_LOG':return { ...state, agentLog: [...state.agentLog, action.entry] };
    case 'SET_AGENT_ANSWER':return { ...state, agentAnswer: action.answer };
    case 'SET_AGENT_QUESTION':return { ...state, agentQuestion: action.q };
    case 'SET_AGENT_CONVERSATION':return { ...state, agentConversation: action.conv };

    case 'ADD_PROJECT': {
      // Guard: prevent duplicate project entries (same id or same folder slug)
      const newSlug = action.project._folderName || slugify(action.project.name);
      const alreadyExists = state.app.projects.some(
        p => p.id === action.project.id || (p._folderName || slugify(p.name)) === newSlug
      );
      if (alreadyExists) {
        // Update existing entry without navigating (handles StrictMode double-invoke)
        const projects = state.app.projects.map(p =>
          p.id === action.project.id ? { ...p, ...action.project } : p
        );
        return { ...state, app: { ...state.app, projects } };
      }
      const app = { ...state.app, projects: [...state.app.projects, action.project] };
      const projectData = { ...state.projectData, [action.project.id]: initProjectData(action.project.id) };
      return { ...state, app, projectData, activeProjectId: action.project.id, page: 'tracker', activeSection: 'biz_context', showNewProject: false };
    }
    case 'DELETE_PROJECT': {
      const projects = state.app.projects.filter(p => p.id !== action.id);
      const projectData = { ...state.projectData };
      delete projectData[action.id];
      const activeProjectId = state.activeProjectId === action.id ? null : state.activeProjectId;
      return { ...state, app: { ...state.app, projects }, projectData, activeProjectId };
    }
    case 'UPDATE_PROJECT': {
      const projects = state.app.projects.map(p => p.id === action.project.id ? { ...p, ...action.project } : p);
      return { ...state, app: { ...state.app, projects } };
    }
    case 'UPDATE_PROJECT_DATA': {
      return { ...state, projectData: { ...state.projectData, [action.id]: action.data } };
    }
    case 'UPDATE_CHECKLIST_ITEM': {
      const { projectId, sectionId, itemIdx, changes } = action;
      const data = state.projectData[projectId];
      const section = [...(data.checklist[sectionId] || [])];
      section[itemIdx] = { ...section[itemIdx], ...changes };
      const newData = { ...data, checklist: { ...data.checklist, [sectionId]: section } };
      return { ...state, projectData: { ...state.projectData, [projectId]: newData } };
    }
    case 'UPDATE_REVERSE_KT_ITEM': {
      const { projectId, itemIdx, changes } = action;
      const data = state.projectData[projectId];
      const reverseKT = [...data.reverseKT];
      reverseKT[itemIdx] = { ...reverseKT[itemIdx], ...changes };
      return { ...state, projectData: { ...state.projectData, [projectId]: { ...data, reverseKT } } };
    }
    case 'UPDATE_SIGNOFF': {
      const data = state.projectData[action.projectId];
      const newData = { ...data, signoff: { ...data.signoff, ...action.changes } };
      return { ...state, projectData: { ...state.projectData, [action.projectId]: newData } };
    }
    case 'ADD_SESSION': {
      const data = state.projectData[action.projectId];
      const newData = { ...data, sessions: [...data.sessions, action.session] };
      return { ...state, projectData: { ...state.projectData, [action.projectId]: newData } };
    }
    case 'DELETE_SESSION': {
      const data = state.projectData[action.projectId];
      const newData = { ...data, sessions: data.sessions.filter(s => s.id !== action.sessionId) };
      return { ...state, projectData: { ...state.projectData, [action.projectId]: newData } };
    }
    case 'SET_AGENT_DRAFTS': {
      const data = state.projectData[action.projectId];
      const newData = { ...data, agentDrafts: { ...data.agentDrafts, ...action.drafts } };
      return { ...state, projectData: { ...state.projectData, [action.projectId]: newData } };
    }
    case 'DISMISS_DRAFT': {
      const data = state.projectData[action.projectId];
      const agentDrafts = { ...data.agentDrafts };
      delete agentDrafts[action.sectionId];
      return { ...state, projectData: { ...state.projectData, [action.projectId]: { ...data, agentDrafts } } };
    }
    case 'SET_TEMPLATES': {
      return { ...state, app: { ...state.app, templates: action.templates } };
    }
    case 'SET_SERVER_URL': {
      return { ...state, app: { ...state.app, serverUrl: action.url } };
    }
    case 'LOAD_PROJECT_FROM_DISK': {
      const { project, projectData: loaded } = action;
      const projects = state.app.projects.find(p => p.id === project.id)
        ? state.app.projects.map(p => p.id === project.id ? { ...p, ...project } : p)
        : [...state.app.projects, project];
      return {
        ...state,
        app: { ...state.app, projects },
        projectData: { ...state.projectData, [project.id]: loaded },
        activeProjectId: project.id,
        lastSaved: project.savedAt,
        page: 'tracker',
      };
    }
    default: return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState);

  // Persist to localStorage whenever app or projectData changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        app: state.app,
        projectData: state.projectData,
      }));
    } catch {}
  }, [state.app, state.projectData]);

  const actions = useCallback(() => ({
    setPage:      (page, extra) => dispatch({ type: 'SET_PAGE', page, extra }),
    setSection:   (section) => dispatch({ type: 'SET_SECTION', section }),
    setAgentTab:  (tab) => dispatch({ type: 'SET_AGENT_TAB', tab }),
    setProject:   (id) => dispatch({ type: 'SET_PROJECT', id }),
    showNewProject: (show) => dispatch({ type: 'SHOW_NEW_PROJECT', show }),
    setEditTemplate: (id) => dispatch({ type: 'SET_EDIT_TEMPLATE', id }),
    setServerStatus: (status) => dispatch({ type: 'SET_SERVER_STATUS', status }),
    setSourcesStatus: (status) => dispatch({ type: 'SET_SOURCES_STATUS', status }),
    setSourcesLoading: (loading) => dispatch({ type: 'SET_SOURCES_LOADING', loading }),
    setSaving:    (saving) => dispatch({ type: 'SET_SAVING', saving }),
    setLastSaved: (ts) => dispatch({ type: 'SET_LAST_SAVED', ts }),
    setAgentRunning: (running) => dispatch({ type: 'SET_AGENT_RUNNING', running }),
    setAgentLog:  (log) => dispatch({ type: 'SET_AGENT_LOG', log }),
    appendAgentLog: (entry) => dispatch({ type: 'APPEND_AGENT_LOG', entry }),
    setAgentAnswer: (answer) => dispatch({ type: 'SET_AGENT_ANSWER', answer }),
    setAgentQuestion: (q) => dispatch({ type: 'SET_AGENT_QUESTION', q }),
    setAgentConversation: (conv) => dispatch({ type: 'SET_AGENT_CONVERSATION', conv }),
    addProject:   (project) => dispatch({ type: 'ADD_PROJECT', project }),
    deleteProject: (id) => dispatch({ type: 'DELETE_PROJECT', id }),
    updateProject: (project) => dispatch({ type: 'UPDATE_PROJECT', project }),
    updateProjectData: (id, data) => dispatch({ type: 'UPDATE_PROJECT_DATA', id, data }),
    updateChecklistItem: (projectId, sectionId, itemIdx, changes) => dispatch({ type: 'UPDATE_CHECKLIST_ITEM', projectId, sectionId, itemIdx, changes }),
    updateReverseKTItem: (projectId, itemIdx, changes) => dispatch({ type: 'UPDATE_REVERSE_KT_ITEM', projectId, itemIdx, changes }),
    updateSignoff: (projectId, changes) => dispatch({ type: 'UPDATE_SIGNOFF', projectId, changes }),
    addSession:   (projectId, session) => dispatch({ type: 'ADD_SESSION', projectId, session }),
    deleteSession: (projectId, sessionId) => dispatch({ type: 'DELETE_SESSION', projectId, sessionId }),
    setAgentDrafts: (projectId, drafts) => dispatch({ type: 'SET_AGENT_DRAFTS', projectId, drafts }),
    dismissDraft: (projectId, sectionId) => dispatch({ type: 'DISMISS_DRAFT', projectId, sectionId }),
    setTemplates: (templates) => dispatch({ type: 'SET_TEMPLATES', templates }),
    setServerUrl: (url) => dispatch({ type: 'SET_SERVER_URL', url }),
    loadProjectFromDisk: (project, projectData) => dispatch({ type: 'LOAD_PROJECT_FROM_DISK', project, projectData }),
  }), []);

  return (
    <AppContext.Provider value={{ state, actions: actions() }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
