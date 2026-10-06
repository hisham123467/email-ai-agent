import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const EDGE = 'https://luptphcutecxkxvoijfc.supabase.co/functions/v1/email-ai-gmail';

export async function POST(request) {
  const form = await request.formData();
  const setupCode = String(form.get('setupCode') || '');
  const clientId = String(form.get('clientId') || '');
  const clientSecret = String(form.get('clientSecret') || '');

  const body = new URLSearchParams({
    action: 'setup',
    setupCode,
    clientId,
    clientSecret,
    redirectUri: 'https://email-ai-agent-amber.vercel.app/api/google/oauth'
  });

  const response = await fetch(EDGE, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
    cache: 'no-store'
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) return NextResponse.redirect(location);
  }

  if (response.ok) {
    return NextResponse.redirect(new URL('/?gmail_setup=complete', request.url));
  }

  return NextResponse.redirect(
    new URL(
      `/admin/setup?key=${encodeURIComponent(setupCode)}&error=save`,
      request.url
    )
  );
}
