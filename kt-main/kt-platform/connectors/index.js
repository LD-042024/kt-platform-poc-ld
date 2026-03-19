// connectors/index.js — connector registry with safe dynamic loading
// Each connector is loaded independently — a broken one won't crash the server.

const CONNECTOR_IDS = ["github", "confluence", "database", "jira", "notion"];

// Load all connectors dynamically at startup
const loaded = {};

for (const id of CONNECTOR_IDS) {
  try {
    const mod = await import(`./${id}.js`);
    const key = Object.keys(mod).find(k => k.endsWith("Connector"));
    if (key) loaded[id] = mod[key];
  } catch (err) {
    console.warn(`⚠  connectors/${id}.js failed to load: ${err.message}`);
  }
}

export const CONNECTORS = {
  ...loaded,

  // Returns live status of all connectors
  async getStatus() {
    const results = {};
    for (const [id, connector] of Object.entries(loaded)) {
      const configured = connector.isConfigured?.() ?? false;
      let connected = false;
      let error = null;
      if (configured) {
        try { connected = await connector.testConnection(); }
        catch (e) { error = e.message; }
      }
      results[id] = { ...connector.meta, configured, connected, error };
    }
    // Include unconfigured connectors so the UI can still show them
    for (const id of CONNECTOR_IDS) {
      if (!results[id]) {
        results[id] = {
          label: id.charAt(0).toUpperCase() + id.slice(1),
          configured: false, connected: false, error: null,
        };
      }
    }
    return results;
  },
};
