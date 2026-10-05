'use client';

import { useEffect, useMemo, useState } from 'react';

export default function HomePage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  async function refresh() {
    const response = await fetch('/api/agent', { cache: 'no-store' });
    setData(await response.json());
  }

  useEffect(() => {
    refresh();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setInstalled(Boolean(standalone));

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installApp() {
    if (installed) return;

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstalled(true);
        setInstallPrompt(null);
      }
      return;
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      alert('Safari mein Share button dabao, phir “Add to Home Screen” select karo.');
    } else {
      alert('Chrome menu (⋮) kholo aur “Add to Home screen” ya “Install app” select karo.');
    }
  }

  async function action(payload) {
    setBusy(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.draft) setDraft(result.draft);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const selectedMessage = useMemo(
    () => data?.inbox?.find((message) => message.id === selected) || null,
    [data, selected]
  );

  if (!data) return <main className="loading">Loading Email AI Agent…</main>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-envelope">✦</span>
          </span>
          <div><strong>Email AI Agent</strong><small>Control Center</small></div>
        </div>

        <nav>
          <button className="nav-item active">Overview</button>
          <button className="nav-item">Inbox <span>{data.stats.inbox}</span></button>
          <button className="nav-item">Needs Reply <span>{data.stats.needsReply}</span></button>
          <button className="nav-item">AI Rules</button>
          <button className="nav-item">Activity</button>
          <button className="nav-item">ChatGPT Plugin</button>
        </nav>

        <button className="side-install" onClick={installApp}>
          <span>↓</span>
          <div>
            <b>{installed ? 'Installed on device' : 'Add to your mobile'}</b>
            <small>{installed ? 'Open from your home screen' : 'Install this dashboard as an app'}</small>
          </div>
        </button>

        <div className="side-status">
          <span className={data.status.mcpReady ? 'dot online' : 'dot'} />
          <div><b>ChatGPT MCP</b><small>{data.status.mcpReady ? 'Ready' : 'Offline'}</small></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">EMAIL AI WORKSPACE</p>
            <h1>Your inbox, under control.</h1>
            <p>Manage everything manually here or control the same backend through ChatGPT.</p>
          </div>
          <div className="header-actions">
            <button className="install-button" onClick={installApp}>
              <span>↓</span>{installed ? 'Installed' : 'Add to mobile'}
            </button>
            <button className="primary">Connect Gmail</button>
          </div>
        </header>

        <section className="gold-banner">
          <div className="gold-icon">✦</div>
          <div>
            <strong>One control center. Two ways to work.</strong>
            <span>Use this dashboard yourself, or ask ChatGPT to operate the exact same email agent.</span>
          </div>
          <span className="gold-badge">MCP READY</span>
        </section>

        <section className="stats-grid">
          <Stat title="Inbox" value={data.stats.inbox} caption="Demo messages" />
          <Stat title="Needs reply" value={data.stats.needsReply} caption="Action required" />
          <Stat title="Waiting" value={data.stats.waiting} caption="Awaiting response" />
          <Stat title="Auto replied" value={data.stats.autoReplied} caption="Last 24 hours" />
        </section>

        <section className="control-grid">
          <div className="panel control-panel">
            <div className="panel-title">
              <div><p className="eyebrow">AGENT CONTROL</p><h2>Automation</h2></div>
              <span className="pill">Development</span>
            </div>
            <Toggle label="Auto reply" description="Allow eligible replies to be handled automatically." checked={data.status.autoReply} disabled={busy} onChange={(enabled) => action({ action: 'set_auto_reply', enabled })} />
            <Toggle label="Require approval" description="Block sending until you approve the final reply." checked={data.status.approvalRequired} disabled={busy} onChange={(enabled) => action({ action: 'set_approval_required', enabled })} />
            <div className="connection-row">
              <div><span className="dot warn" /><b>Gmail</b><small>OAuth connection required</small></div>
              <button className="small-button">Connect</button>
            </div>
          </div>

          <div className="panel mcp-panel">
            <div className="mcp-orb">AI</div>
            <p className="eyebrow">CHATGPT CONTROL</p>
            <h2>MCP endpoint ready</h2>
            <p>ChatGPT can use the same inbox, rules and actions as this dashboard.</p>
            <code>/mcp</code>
            <div className="tool-tags"><span>list_inbox</span><span>draft_reply</span><span>send_reply</span><span>set_auto_reply</span></div>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="panel inbox-panel">
            <div className="panel-title">
              <div><p className="eyebrow">INBOX</p><h2>Recent conversations</h2></div>
              <button className="secondary small-button" onClick={refresh}>Refresh</button>
            </div>
            <div className="message-list">
              {data.inbox.map((message) => (
                <button key={message.id} className={`message-row ${selected === message.id ? 'selected' : ''}`} onClick={() => { setSelected(message.id); setDraft(null); }}>
                  <span className={`priority ${message.priority}`} />
                  <span className="message-copy">
                    <b>{message.name}</b>
                    <strong>{message.subject}</strong>
                    <small>{message.preview}</small>
                  </span>
                  <span className="message-meta"><small>{message.receivedAt}</small><em>{message.status.replace('_', ' ')}</em></span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel detail-panel">
            {!selectedMessage ? (
              <div className="empty-state">
                <div className="empty-icon">✦</div>
                <h3>Select an email</h3>
                <p>Open a conversation to prepare an AI-assisted reply.</p>
              </div>
            ) : (
              <>
                <p className="eyebrow">SELECTED EMAIL</p>
                <h2>{selectedMessage.subject}</h2>
                <p className="from">From {selectedMessage.name} · {selectedMessage.from}</p>
                <div className="email-body">{selectedMessage.preview}</div>
                <button className="primary full" disabled={busy} onClick={() => action({ action: 'draft_reply', messageId: selectedMessage.id, instruction: 'Write a professional concise reply.' })}>Generate draft</button>
                {draft && (
                  <div className="draft-box">
                    <span>Draft preview</span>
                    <pre>{draft.body}</pre>
                    <button className="secondary full" disabled>Send disabled until Gmail is connected</button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Stat({ title, value, caption }) {
  return <div className="stat-card"><span>{title}</span><strong>{value}</strong><small>{caption}</small></div>;
}

function Toggle({ label, description, checked, disabled, onChange }) {
  return (
    <div className="toggle-row">
      <div><b>{label}</b><small>{description}</small></div>
      <button disabled={disabled} aria-pressed={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><span /></button>
    </div>
  );
}
