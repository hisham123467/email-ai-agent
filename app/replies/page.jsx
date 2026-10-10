'use client';

import { useEffect, useState } from 'react';

export default function RepliesPage() {
  const [data, setData] = useState({ history: [], approvals: [] });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const response = await fetch('/api/replies', { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(result.error || 'Unable to load replies.');
      return;
    }

    setData({
      history: Array.isArray(result.history) ? result.history : [],
      approvals: Array.isArray(result.approvals) ? result.approvals : []
    });
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => window.clearInterval(timer);
  }, []);

  async function act(action, item, body = '') {
    setBusy(item.messageId);
    setNotice('');

    try {
      const response = await fetch('/api/replies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          messageId: item.messageId,
          body
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || 'Action failed');
      }

      setNotice(
        action === 'approve'
          ? 'Reply approved, sent, and learned by Heart Mail.'
          : 'Reply skipped.'
      );

      await refresh();
    } catch (error) {
      setNotice(error.message || 'Action failed.');
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="shell">
      <header className="top">
        <a href="/">← Dashboard</a>
        <div>
          <p>HEART MAIL</p>
          <h1>Replies & Approvals</h1>
          <span>See every automatic reply and approve important messages.</span>
        </div>
        <button onClick={refresh}>Refresh</button>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <section className="stats">
        <div><small>Pending approval</small><strong>{data.approvals.length}</strong></div>
        <div><small>Reply records</small><strong>{data.history.length}</strong></div>
        <div><small>Engine</small><strong>Heart Mail 0.1</strong></div>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="heading">
            <div><p>NEEDS YOUR APPROVAL</p><h2>Important replies</h2></div>
            <em>{data.approvals.length}</em>
          </div>

          {data.approvals.length === 0 && (
            <div className="empty">Nothing is waiting for approval.</div>
          )}

          <div className="list">
            {data.approvals.map((item) => (
              <ApprovalCard
                key={item.messageId}
                item={item}
                busy={busy}
                act={act}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="heading">
            <div><p>AUTO REPLY LOG</p><h2>Who got what reply</h2></div>
            <em>{data.history.length}</em>
          </div>

          {data.history.length === 0 && (
            <div className="empty">No reply activity yet.</div>
          )}

          <div className="list">
            {data.history.map((item) => (
              <article className="history" key={item.messageId + item.processedAt}>
                <div className="row">
                  <div>
                    <b>{item.senderEmail || 'Unknown sender'}</b>
                    <span>{item.subject || '(No subject)'}</span>
                  </div>
                  <i className={'status ' + item.status}>
                    {item.status === 'sent'
                      ? 'SENT'
                      : item.status === 'needs_approval'
                        ? 'APPROVAL'
                        : 'FAILED'}
                  </i>
                </div>

                {item.replyText && <pre>{item.replyText}</pre>}
                {item.error && item.status === 'failed' && (
                  <div className="error">{item.error}</div>
                )}
                <small>{item.processedAt ? new Date(item.processedAt).toLocaleString() : ''}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <style jsx>{`
        *{box-sizing:border-box}
        .shell{min-height:100vh;background:#f5f4ef;color:#111;padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .top,.stats,.grid,.notice{max-width:1180px;margin-left:auto;margin-right:auto}
        .top{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;margin-bottom:16px}
        .top a,.top button{background:#fff;border:1px solid #ddd7ca;border-radius:10px;padding:10px 13px;color:#111;text-decoration:none;font-weight:800}
        .top button{cursor:pointer}
        .top p,.heading p{margin:0;color:#987323;font-size:10px;font-weight:900;letter-spacing:.15em}
        .top h1{margin:3px 0 4px;font-size:32px}.top span{color:#6d695f;font-size:13px}
        .notice{margin-bottom:12px;background:#111;color:#fff;padding:10px 12px;border-radius:10px}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
        .stats div,.panel{background:#fff;border:1px solid #e2ddd1;border-radius:14px}
        .stats div{padding:14px;display:flex;flex-direction:column;gap:4px}.stats small{color:#777168}.stats strong{font-size:19px}
        .grid{display:grid;grid-template-columns:1fr 1.15fr;gap:12px;align-items:start}
        .panel{padding:16px}.heading{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}
        .heading h2{margin:3px 0 0;font-size:20px}.heading em{font-style:normal;background:#f1ead7;color:#8d681d;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:900}
        .list{display:flex;flex-direction:column;gap:9px}.empty{padding:20px;text-align:center;color:#777;background:#faf9f6;border-radius:11px}
        .history,.approval{border:1px solid #e5e0d5;border-radius:12px;padding:12px;background:#fcfbf8}
        .row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.row>div{display:flex;flex-direction:column;gap:2px;min-width:0}
        .row b{font-size:13px;overflow-wrap:anywhere}.row span{font-size:12px;color:#666;overflow-wrap:anywhere}
        .status{font-style:normal;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:900;white-space:nowrap}
        .status.sent{background:#e9f5ec;color:#23663a}.status.needs_approval{background:#fff0c9;color:#8d6200}.status.failed{background:#fde8e8;color:#9f2929}
        pre{white-space:pre-wrap;word-break:break-word;margin:10px 0 7px;padding:10px;background:#fff;border:1px solid #e6e1d7;border-radius:9px;font:12px/1.45 inherit}
        textarea{width:100%;margin:10px 0 8px;padding:11px;border:1px solid #dcd5c6;border-radius:9px;min-height:120px;font:14px/1.45 inherit;resize:vertical}
        .actions{display:grid;grid-template-columns:1fr auto;gap:7px}.actions button{border:0;border-radius:9px;padding:10px 12px;font-weight:900;cursor:pointer}
        .approve{background:#111;color:#fff}.skip{background:#efede7;color:#333}.actions button:disabled{opacity:.55}
        .error{color:#a62f2f;font-size:12px;margin-top:7px}.history>small{color:#8a857b}
        @media(max-width:780px){
          .shell{padding:12px 9px 28px}.top{grid-template-columns:1fr;gap:8px}.top h1{font-size:26px}.top a,.top button{width:100%;text-align:center}
          .stats{grid-template-columns:1fr 1fr}.stats div:last-child{grid-column:1/-1}.grid{grid-template-columns:1fr}.panel{padding:13px}
          .row{flex-direction:column}.actions{grid-template-columns:1fr 1fr}
        }
      `}</style>
    </main>
  );
}

function ApprovalCard({ item, busy, act }) {
  const [body, setBody] = useState(item.replyText || '');

  return (
    <article className="approval">
      <div className="row">
        <div>
          <b>{item.senderEmail || 'Unknown sender'}</b>
          <span>{item.subject || '(No subject)'}</span>
        </div>
        <i className="status needs_approval">APPROVAL</i>
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Reply draft"
      />

      <div className="actions">
        <button
          className="approve"
          disabled={busy === item.messageId || !body.trim()}
          onClick={() => act('approve', item, body.trim())}
        >
          {busy === item.messageId ? 'Sending…' : 'Approve & Send'}
        </button>
        <button
          className="skip"
          disabled={busy === item.messageId}
          onClick={() => act('skip', item)}
        >
          Skip
        </button>
      </div>
    </article>
  );
}
