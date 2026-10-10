'use client';

import { useEffect, useMemo, useState } from 'react';

const MCP_PATH = '/mcp';

export default function HomePage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [activeView, setActiveView] = useState('overview');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [toast, setToast] = useState('');
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleInstruction, setRuleInstruction] = useState('');
  const [activationCode, setActivationCode] = useState('');

  async function refresh() {
    const response = await fetch('/api/agent', { cache: 'no-store' });
    const payload = await response.json();
    setData(payload);
  }

  useEffect(() => {
    refresh();

    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      window.setTimeout(() => notify('Gmail connected successfully.'), 350);
      window.history.replaceState({}, '', '/');
    } else if (params.get('gmail') === 'error' || params.get('gmail') === 'invalid_state') {
      window.setTimeout(() => notify('Google connection failed. Please try again.'), 350);
      window.history.replaceState({}, '', '/');
    } else if (params.get('gmail') === 'denied') {
      window.setTimeout(() => notify('Google permission was not approved.'), 350);
      window.history.replaceState({}, '', '/');
    } else if (params.get('gmail_setup') === 'required') {
      window.setTimeout(() => notify('One-time seller Google setup is not completed yet.'), 350);
      window.history.replaceState({}, '', '/');
    } else if (params.get('gmail_setup') === 'complete') {
      window.setTimeout(() => notify('Google seller setup completed. Connect Gmail is ready.'), 350);
      window.history.replaceState({}, '', '/');
    }

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
      notify('Email AI Agent installed on your device.');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function notify(message) {
    setToast(message);
    window.clearTimeout(window.__emailAgentToast);
    window.__emailAgentToast = window.setTimeout(() => setToast(''), 2600);
  }

  async function installApp() {
    if (installed) {
      notify('Email AI Agent is already installed.');
      return;
    }

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
      notify('Safari: Share → Add to Home Screen.');
    } else {
      notify('Chrome: menu ⋮ → Add to Home screen / Install app.');
    }
  }

  async function action(payload, successMessage) {
    setBusy(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok || result.ok === false) {
        throw new Error(result.error || result.message || 'Action failed');
      }

      if (result.draft) setDraft(result.draft);
      await refresh();
      if (successMessage) notify(successMessage);
      return result;
    } catch (error) {
      notify(error.message || 'Action failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copyMcpUrl() {
    const url = `${window.location.origin}${MCP_PATH}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('MCP URL copied.');
    } catch {
      notify(url);
    }
  }

  async function connectGmail() {
    if (data?.status?.gmailConnected) {
      setShowGmailModal(true);
      return;
    }
    if (!data?.status?.gmailOAuthConfigured) {
      notify('One-time seller Google setup is not completed yet.');
      return;
    }
    window.location.href = '/api/agent?gmail=connect';
  }

  async function disconnectGmail() {
    const result = await action({ action: 'disconnect_gmail' }, 'Gmail disconnected.');
    if (result) setShowGmailModal(false);
  }

  async function activateGmail() {
    const code = activationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      notify('6-digit activation code enter karo.');
      return;
    }

    const result = await action(
      { action: 'activate_gmail', code },
      'Gmail activated successfully.'
    );

    if (result?.ok) setActivationCode('');
  }

  async function copyText(value, message = 'Copied.') {
    try {
      await navigator.clipboard.writeText(value);
      notify(message);
    } catch {
      notify(value);
    }
  }

  async function addRule(event) {
    event.preventDefault();
    if (!ruleName.trim() || !ruleInstruction.trim()) {
      notify('Rule name aur instruction dono required hain.');
      return;
    }

    const result = await action(
      { action: 'add_rule', name: ruleName, instruction: ruleInstruction },
      'AI rule added.'
    );

    if (result) {
      setRuleName('');
      setRuleInstruction('');
    }
  }

  const selectedMessage = useMemo(
    () => data?.inbox?.find((message) => message.id === selected) || null,
    [data, selected]
  );

  const filteredInbox = useMemo(() => {
    if (!data?.inbox) return [];
    if (activeView === 'needs-reply') {
      return data.inbox.filter((message) => message.status === 'needs_reply');
    }
    return data.inbox;
  }, [data, activeView]);

  if (!data) return <main className="loading">Loading Email AI Agent…</main>;

  const nav = [
    ['overview', 'Overview'],
    ['inbox', 'Inbox'],
    ['needs-reply', 'Needs Reply'],
    ['replies', 'Replies'],
    ['rules', 'AI Rules'],
    ['activity', 'Activity'],
    ...(data.status.isAdmin ? [['admin', 'Admin']] : []),
    ['plugin', 'ChatGPT Plugin']
  ];

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
          {nav.map(([key, label]) => (
            <button
              key={key}
              className={`nav-item ${activeView === key ? 'active' : ''}`}
              onClick={() => {
                if (key === 'replies') {
                  window.location.href = '/replies';
                  return;
                }
                setActiveView(key);
                setDraft(null);
              }}
            >
              {label}
              {key === 'inbox' && <span>{data.stats.inbox}</span>}
              {key === 'needs-reply' && <span>{data.stats.needsReply}</span>}
            </button>
          ))}
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
            <h1>{viewTitle(activeView)}</h1>
            <p>{viewSubtitle(activeView)}</p>
          </div>
          <div className="header-actions">
            {!installed && (
              <button className="install-button" onClick={installApp}>
                <span>↓</span>Add to mobile
              </button>
            )}
            <button className="primary gmail-header-button" onClick={connectGmail}>
              {data.status.gmailActivationRequired
                ? 'Activation Required'
                : data.status.gmailConnected
                  ? 'Gmail Connected'
                  : 'Connect Gmail'}
            </button>
          </div>
        </header>

        {activeView === 'overview' && (
          <>
            <section className="gold-banner">
              <div className="gold-icon">✦</div>
              <div>
                <strong>One control center. Two ways to work.</strong>
                <span>Use this dashboard yourself, or ask ChatGPT to operate the same email agent.</span>
              </div>
              <span className="gold-badge">MCP READY</span>
            </section>

            <section className="stats-grid">
              <Stat title="Inbox" value={data.stats.inbox} caption="Messages available" />
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

                <Toggle
                  label="Auto reply"
                  description="Allow eligible replies to be handled automatically."
                  checked={data.status.autoReply}
                  disabled={busy}
                  onChange={(enabled) => action({ action: 'set_auto_reply', enabled }, `Auto reply ${enabled ? 'enabled' : 'disabled'}.`)}
                />

                <Toggle
                  label="Require approval"
                  description="Block sending until you approve the final reply."
                  checked={data.status.approvalRequired}
                  disabled={busy}
                  onChange={(enabled) => action({ action: 'set_approval_required', enabled }, `Approval requirement ${enabled ? 'enabled' : 'disabled'}.`)}
                />

                <div className="connection-row">
                  <div>
                    <span className={data.status.gmailConnected ? 'dot online' : 'dot warn'} />
                    <b>Gmail</b>
                    <small>{data.status.gmailConnected ? 'Connected' : data.status.gmailOAuthConfigured ? 'Ready to authorize' : 'OAuth setup required'}</small>
                  </div>
                  <button className="small-button" onClick={connectGmail}>
                    {data.status.gmailConnected ? 'Connected' : 'Connect'}
                  </button>
                </div>
              </div>

              <div className="panel mcp-panel">
                <div className="mcp-orb">AI</div>
                <p className="eyebrow">CHATGPT CONTROL</p>
                <h2>MCP endpoint ready</h2>
                <p>ChatGPT can use the same inbox, rules and actions as this dashboard.</p>
                <code>{MCP_PATH}</code>
                <div className="plugin-actions">
                  <button className="gold-button" onClick={() => setActiveView('plugin')}>Setup plugin</button>
                  <button className="dark-ghost" onClick={copyMcpUrl}>Copy URL</button>
                </div>
              </div>
            </section>

            <InboxWorkspace
              data={data}
              messages={data.inbox}
              selected={selected}
              setSelected={setSelected}
              selectedMessage={selectedMessage}
              draft={draft}
              busy={busy}
              refresh={refresh}
              action={action}
            />
          </>
        )}

        {(activeView === 'inbox' || activeView === 'needs-reply') && (
          <InboxWorkspace
            data={data}
            messages={filteredInbox}
            selected={selected}
            setSelected={setSelected}
            selectedMessage={selectedMessage}
            draft={draft}
            busy={busy}
            refresh={refresh}
            action={action}
            fullWidth
          />
        )}

        {activeView === 'rules' && (
          <section className="rules-layout">
            <form className="panel rule-form" onSubmit={addRule}>
              <p className="eyebrow">NEW RULE</p>
              <h2>Add AI instruction</h2>
              <label>
                Rule name
                <input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="e.g. VIP clients" />
              </label>
              <label>
                Instruction
                <textarea value={ruleInstruction} onChange={(event) => setRuleInstruction(event.target.value)} placeholder="Tell the agent exactly how to behave." rows={5} />
              </label>
              <button className="primary full" disabled={busy}>Add rule</button>
            </form>

            <div className="panel rules-panel">
              <div className="panel-title"><div><p className="eyebrow">ACTIVE RULES</p><h2>Agent brain</h2></div><span className="pill">{data.rules?.length || 0} rules</span></div>
              <div className="rules-list">
                {(data.rules || []).map((rule) => (
                  <div className="rule-row" key={rule.id}>
                    <div>
                      <b>{rule.name}</b>
                      <p>{rule.instruction}</p>
                    </div>
                    <div className="rule-actions">
                      <button
                        className={`mini-toggle ${rule.enabled ? 'enabled' : ''}`}
                        onClick={() => action({ action: 'toggle_rule', ruleId: rule.id, enabled: !rule.enabled }, `Rule ${rule.enabled ? 'disabled' : 'enabled'}.`)}
                      >
                        {rule.enabled ? 'ON' : 'OFF'}
                      </button>
                      <button className="danger-link" onClick={() => action({ action: 'delete_rule', ruleId: rule.id }, 'Rule deleted.')}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeView === 'activity' && (
          <section className="panel activity-panel">
            <div className="panel-title">
              <div><p className="eyebrow">AUDIT LOG</p><h2>Recent activity</h2></div>
              <button className="secondary small-button" onClick={refresh}>Refresh</button>
            </div>
            <div className="activity-list">
              {(data.activity || []).map((item) => (
                <div className="activity-row" key={item.id}>
                  <span className="activity-dot" />
                  <div><b>{item.text}</b><small>{item.actor || 'system'} · {item.time}</small></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeView === 'admin' && data.status.isAdmin && (
          <section className="panel admin-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">ADMIN · PAYMENTS</p>
                <h2>Pending activations</h2>
              </div>
              <span className="pill">{data.pendingApprovals?.length || 0} pending</span>
            </div>

            <p className="admin-intro">
              Client ko code sirf payment receive hone ke baad do. Code ek dafa use hote hi expire ho jayega.
            </p>

            <div className="approval-list">
              {(data.pendingApprovals || []).length === 0 && (
                <div className="list-empty">No clients are waiting for activation.</div>
              )}

              {(data.pendingApprovals || []).map((client) => (
                <div className="approval-row" key={`${client.email}-${client.createdAt}`}>
                  <div>
                    <b>{client.email}</b>
                    <small>{client.createdAt ? new Date(client.createdAt).toLocaleString() : 'Waiting for payment'}</small>
                  </div>
                  <div className="activation-code-chip">
                    <strong>{client.activationCode}</strong>
                    <button onClick={() => copyText(client.activationCode, 'Activation code copied.')}>Copy</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeView === 'plugin' && (
          <section className="plugin-layout">
            <div className="panel plugin-card">
              <div className="plugin-hero-icon">AI</div>
              <p className="eyebrow">CHATGPT PLUGIN</p>
              <h2>Connect Email AI Agent to ChatGPT</h2>
              <p className="plugin-copy">Your MCP server is live. Add this endpoint in ChatGPT developer mode to control the same backend from chat.</p>
              <div className="endpoint-box">
                <code>{typeof window !== 'undefined' ? `${window.location.origin}${MCP_PATH}` : MCP_PATH}</code>
                <button onClick={copyMcpUrl}>Copy</button>
              </div>
              <div className="plugin-actions-row">
                <button className="primary" onClick={copyMcpUrl}>Copy MCP URL</button>
                <a className="secondary link-button" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT</a>
              </div>
            </div>

            <div className="panel steps-card">
              <p className="eyebrow">SETUP</p>
              <h2>3 quick steps</h2>
              <ol>
                <li><span>1</span><div><b>Enable Developer mode</b><p>ChatGPT Settings → Security and login → Developer mode.</p></div></li>
                <li><span>2</span><div><b>Add a plugin</b><p>Open Plugins, tap +, and create a developer-mode connection.</p></div></li>
                <li><span>3</span><div><b>Paste the MCP URL</b><p>Use the copied URL ending in <code>/mcp</code>.</p></div></li>
              </ol>
              <div className="status-strip"><span className="dot online" /> MCP endpoint is live</div>
            </div>
          </section>
        )}
      </section>

      {showGmailModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowGmailModal(false)}>
          <div className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowGmailModal(false)}>×</button>
            <div className="modal-icon">G</div>
            <p className="eyebrow">GMAIL CONNECTION</p>

            {data.status.gmailConnected ? (
              <>
                <h2>{data.status.gmailActivationRequired ? 'Activation required' : 'Gmail connected'}</h2>
                <p>
                  {data.status.gmailActivationRequired
                    ? 'Google connection complete hai. Seller activation code ke baad inbox unlock hoga.'
                    : 'Your account is connected through Google OAuth.'}
                </p>
                <div className="connected-account">
                  <span className={data.status.gmailActivationRequired ? 'dot warn' : 'dot online'} />
                  <div>
                    <b>{data.status.gmailEmail || 'Google account'}</b>
                    <small>{data.status.gmailActivationRequired ? 'Waiting for activation' : 'Inbox access active'}</small>
                  </div>
                </div>
                <button className="secondary full" disabled={busy} onClick={disconnectGmail}>Disconnect Gmail</button>
              </>
            ) : (
              <>
                <h2>Connect Gmail</h2>
                <p>Google will open its own secure account chooser and permission screen. Your password is never entered on this website.</p>
                <button className="primary full" onClick={() => { window.location.href = '/api/agent?gmail=connect'; }}>Continue with Google</button>
                <div className="google-security-note">One click here → choose Google account → Allow → connected automatically.</div>
              </>
            )}
          </div>
        </div>
      )}

      {!data.status.gmailConnected && data.status.gmailOAuthConfigured && (
        <div className="connect-gate">
          <div className="connect-gate-card">
            <div className="google-connect-icon">G</div>
            <p className="eyebrow">EMAIL AI AGENT</p>
            <h2>Connect your Gmail</h2>
            <p>
              Google ka official account chooser khulega. Apni Gmail select karo,
              permissions Allow karo, aur connection automatically complete ho jayega.
            </p>
            <button className="google-connect-button" onClick={connectGmail}>
              Continue with Google
            </button>
            <div className="connect-privacy">
              Password is website par kabhi enter nahi hota.
            </div>
          </div>
        </div>
      )}

      {data.status.gmailActivationRequired && (
        <div className="activation-gate">
          <div className="activation-card">
            <div className="activation-lock">✓</div>
            <p className="eyebrow">GOOGLE CONNECTED</p>
            <h2>Activation required</h2>
            <p>
              Gmail permission complete ho gayi hai. Payment ke baad seller se 6-digit activation code lo.
            </p>
            <div className="activation-account">{data.status.gmailEmail}</div>
            <input
              className="activation-input"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={activationCode}
              onChange={(event) => setActivationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') activateGmail();
              }}
            />
            <button className="primary full" disabled={busy} onClick={activateGmail}>
              {busy ? 'Checking…' : 'Activate Gmail'}
            </button>
            <button className="activation-disconnect" disabled={busy} onClick={disconnectGmail}>
              Use another Google account
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function InboxWorkspace({ messages, selected, setSelected, selectedMessage, draft, busy, refresh, action, fullWidth = false }) {
  return (
    <section className={`workspace-grid ${fullWidth ? 'workspace-full' : ''}`}>
      <div className="panel inbox-panel">
        <div className="panel-title">
          <div><p className="eyebrow">INBOX</p><h2>Recent conversations</h2></div>
          <button className="secondary small-button" onClick={refresh}>Refresh</button>
        </div>
        <div className="message-list">
          {messages.length === 0 && <div className="list-empty">No messages in this view.</div>}
          {messages.map((message) => (
            <button key={message.id} className={`message-row ${selected === message.id ? 'selected' : ''}`} onClick={() => setSelected(message.id)}>
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
            <button className="primary full" disabled={busy} onClick={() => action({ action: 'draft_reply', messageId: selectedMessage.id, instruction: 'Write a professional concise reply.' }, 'Draft generated.')}>Generate draft</button>
            {draft && (
              <div className="draft-box">
                <span>Draft preview</span>
                <pre>{draft.body}</pre>
                <button className="secondary full" disabled>Connect Gmail to send</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
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

function viewTitle(view) {
  return {
    overview: 'Your inbox, under control.',
    inbox: 'Inbox',
    'needs-reply': 'Needs reply',
    rules: 'AI rules',
    activity: 'Activity',
    admin: 'Admin approvals',
    plugin: 'ChatGPT plugin'
  }[view] || 'Email AI Agent';
}

function viewSubtitle(view) {
  return {
    overview: 'Manage everything manually here or control the same backend through ChatGPT.',
    inbox: 'Read messages, select conversations and generate reply drafts.',
    'needs-reply': 'Focus only on conversations that need your response.',
    rules: 'Tell the agent how it should behave for different emails.',
    activity: 'See what the dashboard, agent and ChatGPT control layer have changed.',
    admin: 'Approve paid clients by sharing their one-time activation code.',
    plugin: 'Connect this deployed MCP server to ChatGPT developer mode.'
  }[view] || '';
}
