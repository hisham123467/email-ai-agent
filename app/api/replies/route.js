import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const GMAIL_EDGE = 'https://luptphcutecxkxvoijfc.supabase.co/functions/v1/email-ai-gmail';

async function getSession() {
  const store = await cookies();
  return store.get('gmail_session')?.value || '';
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: 'Connect Gmail first.' }, { status: 401 });
  }

  const url = new URL(GMAIL_EDGE);
  url.searchParams.set('action', 'reply_activity');
  url.searchParams.set('session', session);

  const response = await fetch(url, { cache: 'no-store' });
  const result = await response.json().catch(() => ({}));

  return Response.json(result, {
    status: response.status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: 'Connect Gmail first.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action =
    body.action === 'approve'
      ? 'approve_reply'
      : body.action === 'skip'
        ? 'skip_reply'
        : '';

  if (!action) {
    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  }

  const response = await fetch(GMAIL_EDGE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action,
      session,
      messageId: body.messageId,
      body: body.body
    }),
    cache: 'no-store'
  });

  const result = await response.json().catch(() => ({}));
  return Response.json(result, { status: response.status });
}
