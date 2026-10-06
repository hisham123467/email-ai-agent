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
import {
  buildGoogleAuthUrl,
  createOAuthState,
  createTemplateDraft,
  decryptRefreshToken,
  encryptRefreshToken,
  exchangeCode,
  getGmailMessage,
  getGoogleProfile,
  gmailOAuthConfigured,
  listGmailInbox,
  refreshGoogleAccessToken,
  sendGmailReply,
  verifyOAuthState
} from '../../../lib/gmail-oauth';

export const dynamic = 'force-dynamic';

async function gmailSession() {
  if (!gmailOAuthConfigured()) return null;
  const cookieStore = await cookies();
  const encryptedRefresh = cookieStore.get('gmail_refresh')?.value;
  if (!encryptedRefresh) return null;

  try {
    const refreshToken = decryptRefreshToken(encryptedRefresh);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    return {
      accessToken,
      email: cookieStore.get('gmail_email')?.value || ''
    };
  } catch {
    return null;
  }
}

function statsForInbox(inbox) {
  return {
    inbox: inbox.length,
    needsReply: inbox.filter((m) => m.status === 'needs_reply').length,
    waiting: inbox.filter((m) => m.status === 'waiting').length,
    autoReplied: 0
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const gmailAction = url.searchParams.get('gmail');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (gmailAction === 'connect') {
    if (!gmailOAuthConfigured()) {
      const home = new URL('/', request.url);
      home.searchParams.set('gmail_setup', 'required');
      return NextResponse.redirect(home);
    }

    const loginHint = url.searchParams.get('login_hint') || '';
    return NextResponse.redirect(buildGoogleAuthUrl(createOAuthState(), loginHint));
  }

  if (code) {
    if (!gmailOAuthConfigured() || !verifyOAuthState(state)) {
      const home = new URL('/', request.url);
      home.searchParams.set('gmail', 'error');
      return NextResponse.redirect(home);
    }

    try {
      const tokens = await exchangeCode(code);
      if (!tokens.refresh_token) throw new Error('Google did not return a refresh token');
      const profile = await getGoogleProfile(tokens.access_token);

      const response = NextResponse.redirect(new URL('/?gmail=connected', request.url));
      response.cookies.set('gmail_refresh', encryptRefreshToken(tokens.refresh_token), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 180 * 24 * 60 * 60,
        path: '/'
      });
      response.cookies.set('gmail_email', profile.email || '', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 180 * 24 * 60 * 60,
        path: '/'
      });
      return response;
    } catch {
      const home = new URL('/', request.url);
      home.searchParams.set('gmail', 'error');
      return NextResponse.redirect(home);
    }
  }

  const dashboard = getDashboard();
  const session = await gmailSession();

  if (!session) {
    return Response.json(dashboard, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  try {
    const inbox = await listGmailInbox(session.accessToken, 15);
    return Response.json({
      ...dashboard,
      status: {
        ...dashboard.status,
        gmailConnected: true,
        gmailEmail: session.email || null,
        gmailOAuthConfigured: true,
        nextStep: 'Gmail connected'
      },
      stats: statsForInbox(inbox),
      inbox
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch {
    return Response.json({
      ...dashboard,
      status: {
        ...dashboard.status,
        gmailConnected: false,
        gmailOAuthConfigured: true,
        nextStep: 'Reconnect Gmail'
      }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.action === 'disconnect_gmail') {
      const response = Response.json({ ok: true });
      response.headers.append('Set-Cookie', 'gmail_refresh=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      response.headers.append('Set-Cookie', 'gmail_email=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return response;
    }

    if (body.action === 'set_auto_reply') {
      return Response.json({ ok: true, status: setAutoReply(body.enabled) });
    }

    if (body.action === 'set_approval_required') {
      return Response.json({ ok: true, status: setApprovalRequired(body.enabled) });
    }

    if (body.action === 'draft_reply') {
      const session = await gmailSession();
      if (session) {
        const message = await getGmailMessage(session.accessToken, body.messageId);
        return Response.json({ ok: true, draft: createTemplateDraft(message) });
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

      const session = await gmailSession();
      if (!session) {
        return Response.json({
          ok: false,
          code: 'GMAIL_NOT_CONNECTED',
          message: 'Connect Gmail first.'
        }, { status: 401 });
      }

      const sent = await sendGmailReply(session.accessToken, body.messageId, body.body);
      return Response.json({ ok: true, sent });
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
