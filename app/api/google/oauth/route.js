import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GMAIL_EDGE = 'https://luptphcutecxkxvoijfc.supabase.co/functions/v1/email-ai-gmail';

export async function GET(request) {
  const url = new URL(request.url);
  const gmail = url.searchParams.get('gmail');

  if (gmail === 'finalize') {
    const session = url.searchParams.get('session');
    if (!session) {
      return NextResponse.redirect(new URL('/?gmail=error', request.url));
    }

    const response = NextResponse.redirect(new URL('/?gmail=connected', request.url));
    response.cookies.set('gmail_session', session, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 180 * 24 * 60 * 60,
      path: '/'
    });
    return response;
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/?gmail=denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?gmail=error', request.url));
  }

  const edge = new URL(GMAIL_EDGE);
  edge.searchParams.set('action', 'callback');
  edge.searchParams.set('code', code);
  edge.searchParams.set('state', state);
  return NextResponse.redirect(edge);
}
