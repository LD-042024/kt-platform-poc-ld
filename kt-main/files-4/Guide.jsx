import React from 'react';

const GUIDE_SECTIONS = [
  { icon: '🚀', title: 'Getting Started', steps: [
    { title: 'Create a project', body: "Click '+ New Project' on the Dashboard. Enter the project name, tag it to a client, set the outgoing and incoming team names, and choose a target handover date." },
    { title: 'Set a GitHub keyword', body: "Add a keyword that matches your repository name (e.g. 'orders-pipeline'). This is what the Agent uses to find the right repos when scanning GitHub." },
    { title: 'Choose a template', body: "Select a prompt template that matches your project type. 'Full DE Project' works for most cases. Compliance-heavy projects should use 'Compliance-Sensitive'." },
  ]},
  { icon: '📋', title: 'KT Tracker', steps: [
    { title: 'Work through sections in order', body: "Start with Business Context and Data Context — these anchor everything else. Each section has smart dropdowns specific to that section type." },
    { title: 'Paste resource links', body: "Every checklist item has a Resource Link field. Paste the actual Confluence page URL, DAG link, repo URL, or table name. This turns the tracker into a live index of your real assets." },
    { title: 'Use statuses accurately', body: "Mark items In Progress when actively being documented, Done when verified, and Blocked when there's an impediment. Blocked items surface in the Day 1 Kit and Sign-off." },
    { title: 'Log KT sessions as you go', body: "After every handover meeting, log it in the KT Sessions section with topic, attendees, and any open questions raised. Open questions are auto-surfaced in the Day 1 Kit." },
    { title: 'Complete Reverse KT', body: "For each topic in the Reverse KT section, record when the incoming team has demonstrated their understanding. Set status to Passed only when you're confident they can operate independently." },
  ]},
  { icon: '🤖', title: 'Agent Studio', steps: [
    { title: 'Start the backend', body: "Open a terminal in the project folder and run: npm install && node server.js. The backend must be running for Agent features. Open the Configuration tab to verify connection." },
    { title: 'Run Populate', body: "Go to Populate KT tab, confirm your GitHub keyword and template, select which sections to populate, then click Run Agent. The agent scans GitHub and drafts content for each section." },
    { title: 'Review drafts in the tracker', body: "After the agent runs, banner notifications appear at the top of each section in the KT Tracker. Review the draft, click Accept to mark items In Progress, or Skip to dismiss." },
    { title: 'Ask questions', body: "Use the Ask Agent tab to query the project in natural language. The agent answers using GitHub data and your KT documentation. It cites sources so you know where information came from." },
  ]},
  { icon: '🎛', title: 'Prompt Templates', steps: [
    { title: 'Choose the right template', body: "Templates control how the agent interprets GitHub data. 'Surface' gives a quick gist. 'Deep' produces detailed drafts. Match depth to how much time the outgoing team has." },
    { title: 'Create custom templates', body: "Click '+ New Template' in the Templates page. Set focus areas (e.g. 'Security signals' for compliance projects), add custom context that gets injected into every agent prompt, and override depth per section." },
    { title: 'Per-section depth overrides', body: "You might want 'Deep' for Known Issues but 'Surface' for Contacts. Configure per-section overrides in the template editor." },
  ]},
  { icon: '✅', title: 'Sign-off Process', steps: [
    { title: 'Complete the Day 1 Kit first', body: "The Day 1 Kit auto-compiles from your filled sections. Before proceeding to sign-off, review it as the incoming team would — are the critical pipelines listed? Are contacts there? Are runbooks ready?" },
    { title: 'Resolve or waive blocked items', body: "Blocked items must either be resolved (status changed) or explicitly documented in the Caveats field of the Sign-off section. Never sign off with silent unknowns." },
    { title: 'Both parties must confirm', body: "The outgoing team lead and incoming team lead both check their respective confirmation boxes. This creates a formal record of the handover date and any documented caveats." },
  ]},
  { icon: '💡', title: 'KT Best Practices', steps: [
    { title: 'Start KT documentation during the project, not at the end', body: "The best KTs are built incrementally. Add runbook entries when incidents happen. Document decisions when they're made. Don't leave it all for the last 2 weeks." },
    { title: 'The incoming team should drive', body: "Reverse KT is more important than KT. The outgoing team explaining things is useful; the incoming team explaining things back is what proves understanding." },
    { title: "Blocked doesn't mean stuck", body: "Mark things Blocked early. It surfaces gaps that need escalation — access not granted, document doesn't exist, key person unavailable — giving time to resolve before the handover deadline." },
    { title: 'Link everything, explain the important things', body: "Links are the backbone of the tracker. But links alone don't transfer context. For the 3-5 most critical items, write enough notes that someone at 2am can understand without calling anyone." },
  ]},
];

const QUICK_REF = [
  ['Start backend', 'npm install && node server.js'],
  ['Check backend', 'Agent Studio → Configuration → Check Connection'],
  ['Run agent', 'Agent Studio → Populate KT → Run Agent'],
  ['Review drafts', 'KT Tracker → section banners → Accept/Skip'],
  ['Ask questions', 'Agent Studio → Ask Agent'],
  ['Sign off', 'KT Tracker → Sign-off section'],
];

export default function Guide() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ marginBottom: 8 }}>How to Use KT Platform</h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7 }}>A step-by-step guide to running a robust Data Engineering knowledge transfer using this tool.</p>
        </div>

        {GUIDE_SECTIONS.map(sec => (
          <div key={sec.title} style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--accent-border)' }}>
              <span style={{ fontSize: 22 }}>{sec.icon}</span>
              <h2 style={{ color: 'var(--accent2)' }}>{sec.title}</h2>
            </div>
            {sec.steps.map((step, i) => (
              <div key={i} className="card" style={{ padding: '16px 18px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-bg)', border: '2px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent2)', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{step.title}</div>
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Quick reference */}
        <div className="card" style={{ padding: 20, borderTop: '3px solid var(--accent)', marginTop: 8 }}>
          <h3 style={{ marginBottom: 14 }}>⌨ Quick Reference</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {QUICK_REF.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)', background: 'var(--surface2)', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
