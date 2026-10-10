import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  addRule,
  createReplyDraft,
  deleteRule,
  getDashboard,
  setApprovalRequired,
  setAutoReply,
  toggleRule
} from '../../../lib/agent-service';

export const dynamic = 'force-dynamic';

const GMAIL_EDGE = 'https://luptphcutecxkxvoijfc.supabase.co/functions/v1/email-ai-gmail';
const CALLBACK_URL = 'https://email-ai-agent-amber.vercel.app/api/google/oauth';
const SUPABASE_REST = 'https://luptphcutecxkxvoijfc.supabase.co/rest/v1/rpc';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hLYqtM0lFdf9etSrkgOH6A_eyEhS5-w';

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_REST}/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Database action failed');
  return payload;
}

async function edgeStatus() {
  try {
    const response = await fetch(`${GMAIL_EDGE}?action=status`, { cache: 'no-store' });
    return await response.json();
  } catch {
    return { configured: false };
  }
}

async function edgeDashboard(session) {
  if (!session) return null;
  try {
    const url = new URL(GMAIL_EDGE);
    url.searchParams.set('action', 'dashboard');
    url.searchParams.set('session', session);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function statsForInbox(inbox, workerStats = null) {
  return {
    inbox: inbox.length,
    needsReply: inbox.filter((m) => m.status === 'needs_reply').length,
    waiting: inbox.filter((m) => m.status === 'waiting').length,
    autoReplied: Number(workerStats?.autoReplied24h || 0)
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const gmailAction = url.searchParams.get('gmail');

  if (gmailAction === 'connect') {
    const edge = new URL(GMAIL_EDGE);
    edge.searchParams.set('action', 'start');
    edge.searchParams.set('return_url', CALLBACK_URL);
    return NextResponse.redirect(edge);
  }

  const dashboard = getDashboard();
  const cookieStore = await cookies();
  const session = cookieStore.get('gmail_session')?.value || '';
  const status = await edgeStatus();

  let sessionStatus = { connected: false };
  let persistentSettings = null;
  let workerStats = null;
  if (session) {
    [sessionStatus, persistentSettings, workerStats] = await Promise.all([
      rpc('email_ai_session_status', { p_session: session }).catch(() => ({ connected: false })),
      rpc('email_ai_get_settings', { p_session: session }).catch(() => null),
      rpc('email_ai_get_worker_stats', { p_session: session }).catch(() => null)
    ]);
  }

  if (sessionStatus?.connected && sessionStatus.status === 'pending') {
    return Response.json({
      ...dashboard,
      status: {
        ...dashboard.status,
        gmailConnected: true,
        gmailEmail: sessionStatus.email || null,
        gmailOAuthConfigured: Boolean(status.configured),
        gmailActivationRequired: true,
        isAdmin: false,
        autoReply: Boolean(persistentSettings?.autoReply),
        approvalRequired: persistentSettings?.approvalRequired !== false,
        nextStep: 'Enter activation code'
      },
      stats: { inbox: 0, needsReply: 0, waiting: 0, autoReplied: Number(workerStats?.autoReplied24h || 0) },
      inbox: [],
      pendingApprovals: []
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  if (sessionStatus?.connected && sessionStatus.status === 'active') {
    const gmail = await edgeDashboard(session);
    const inbox = Array.isArray(gmail?.inbox) ? gmail.inbox : [];

    return Response.json({
      ...dashboard,
      status: {
        ...dashboard.status,
        gmailConnected: true,
        gmailEmail: sessionStatus.email || gmail?.email || null,
        gmailOAuthConfigured: Boolean(status.configured),
        gmailActivationRequired: false,
        isAdmin: Boolean(sessionStatus.isAdmin),
        autoReply: Boolean(persistentSettings?.autoReply),
        approvalRequired: persistentSettings?.approvalRequired !== false,
        nextStep: sessionStatus.isAdmin ? 'Admin connected' : 'Gmail connected'
      },
      stats: statsForInbox(inbox, workerStats),
      inbox,
      pendingApprovals: Array.isArray(sessionStatus.pendingApprovals)
        ? sessionStatus.pendingApprovals
        : []
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  return Response.json({
    ...dashboard,
    status: {
      ...dashboard.status,
      gmailConnected: false,
      gmailEmail: null,
      gmailOAuthConfigured: Boolean(status.configured),
      gmailActivationRequired: false,
      isAdmin: false,
      nextStep: status.configured ? 'Connect Gmail' : 'Seller Google setup required'
    },
    pendingApprovals: []
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const session = cookieStore.get('gmail_session')?.value || '';

    if (body.action === 'activate_gmail') {
      if (!session) {
        return Response.json({ ok: false, error: 'Gmail session not found' }, { status: 401 });
      }

      const result = await rpc('email_ai_activate_session', {
        p_session: session,
        p_code: String(body.code || '')
      });

      return Response.json(result, { status: result?.ok ? 200 : 400 });
    }

    if (body.action === 'disconnect_gmail') {
      if (session) {
        const url = new URL(GMAIL_EDGE);
        url.searchParams.set('action', 'disconnect');
        url.searchParams.set('session', session);
        await fetch(url, { cache: 'no-store' }).catch(() => {});
      }
      const response = Response.json({ ok: true });
      response.headers.append('Set-Cookie', 'gmail_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return response;
    }

    if (body.action === 'set_auto_reply') {
      if (!session) {
        return Response.json({ ok: false, error: 'Connect Gmail first.' }, { status: 401 });
      }
      const settings = await rpc('email_ai_set_settings', {
        p_session: session,
        p_auto_reply: Boolean(body.enabled),
        p_approval_required: null
      });
      return Response.json({ ok: Boolean(settings?.ok), settings, status: settings });
    }

    if (body.action === 'set_approval_required') {
      if (!session) {
        return Response.json({ ok: false, error: 'Connect Gmail first.' }, { status: 401 });
      }
      const settings = await rpc('email_ai_set_settings', {
        p_session: session,
        p_auto_reply: null,
        p_approval_required: Boolean(body.enabled)
      });
      return Response.json({ ok: Boolean(settings?.ok), settings, status: settings });
    }

    if (body.action === 'draft_reply') {
      if (session && body.messageId) {
        const url = new URL(GMAIL_EDGE);
        url.searchParams.set('action', 'message');
        url.searchParams.set('session', session);
        url.searchParams.set('message_id', body.messageId);
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          const result = await response.json();
          const message = result.message;
          return Response.json({
            ok: true,
            draft: {
              id: `draft_${Date.now()}`,
              messageId: message.id,
              to: message.from,
              subject: message.subject?.startsWith('Re:') ? message.subject : `Re: ${message.subject || ''}`,
              body: `Hi ${message.name || 'there'},\n\nThanks for your message. I have received your update and I am reviewing it. I will follow up with the relevant details shortly.\n\nBest regards,\nHisham`,
              status: 'draft_only',
              gmail: true
            }
          });
        }
      }
      return Response.json({ ok: true, draft: createReplyDraft(body) });
    }

    if (body.action === 'send_reply') {
      const dashboard = getDashboard();
      if (dashboard.status.approvalRequired) {
        return Response.json({
          ok: false,
          code: 'APPROVAL_REQUIRED',
          message: 'Approval is required before sending.'
        }, { status: 409 });
      }

      if (!session) {
        return Response.json({
          ok: false,
          code: 'GMAIL_NOT_CONNECTED',
          message: 'Connect Gmail first.'
        }, { status: 401 });
      }

      const response = await fetch(GMAIL_EDGE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          session,
          messageId: body.messageId,
          body: body.body
        }),
        cache: 'no-store'
      });
      const result = await response.json();
      return Response.json(result, { status: response.status });
    }

    if (body.action === 'add_rule') {
      return Response.json({ ok: true, rule: addRule(body) });
    }

    if (body.action === 'toggle_rule') {
      return Response.json({ ok: true, rule: toggleRule(body) });
    }

    if (body.action === 'delete_rule') {
      return Response.json({ ok: true, rule: deleteRule(body) });
    }

    return Response.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    );
  }
}
