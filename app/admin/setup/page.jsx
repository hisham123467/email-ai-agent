export const dynamic = 'force-dynamic';

const REDIRECT_URI = 'https://email-ai-agent-amber.vercel.app/api/google/oauth';
const EDGE_STATUS = 'https://luptphcutecxkxvoijfc.supabase.co/functions/v1/email-ai-gmail?action=status';

async function getSetupStatus() {
  try {
    const response = await fetch(EDGE_STATUS, { cache: 'no-store' });
    if (!response.ok) return { configured: false };
    return await response.json();
  } catch {
    return { configured: false };
  }
}

export default async function AdminSetupPage({ searchParams }) {
  const params = await searchParams;
  const key = String(params?.key || '');
  const error = String(params?.error || '');
  const status = await getSetupStatus();

  if (status.configured) {
    return (
      <main className="admin-setup-shell">
        <section className="admin-setup-card">
          <div className="admin-setup-logo">G</div>
          <p className="eyebrow">GOOGLE OAUTH READY</p>
          <h1>Google setup complete</h1>
          <p>
            Client ID aur Client Secret save ho chuke hain. Ab apna admin Google account
            connect karo aur Google permission screen par Allow dabao.
          </p>

          <a className="primary full setup-google-link" href="/api/agent?gmail=connect">
            Continue with Google
          </a>

          <div className="setup-note">
            Admin Gmail: <b>muhammadhishamoraginal@gmail.com</b>. Is account ko select karne
            par admin access automatically milega.
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-setup-shell">
      <section className="admin-setup-card">
        <div className="admin-setup-logo">G</div>
        <p className="eyebrow">ONE-TIME SELLER SETUP</p>
        <h1>Enable Google Gmail connection</h1>
        <p>
          Ye setup sirf ek dafa seller/admin ke liye hai. Save ke baad Google khulega,
          tum apna admin Gmail select karke Allow karoge. Uske baad future clients ko sirf
          Connect Gmail → Google Allow karna hoga.
        </p>

        {error && (
          <div className="setup-error">
            {error === 'invalid'
              ? 'Setup link invalid ya expired hai.'
              : error === 'missing'
                ? 'Client ID aur Client Secret dono required hain.'
                : 'Google setup save nahi ho saka. Dobara try karo.'}
          </div>
        )}

        <form className="admin-setup-form" method="post" action="/api/admin/google-setup">
          <input type="hidden" name="setupCode" value={key} />

          <label>
            Google Client ID
            <input
              name="clientId"
              autoComplete="off"
              placeholder="...apps.googleusercontent.com"
              required
            />
          </label>

          <label>
            Google Client Secret
            <input
              type="password"
              name="clientSecret"
              autoComplete="new-password"
              placeholder="Google OAuth client secret"
              required
            />
          </label>

          <label>
            Authorized Redirect URI
            <input className="setup-readonly" value={REDIRECT_URI} readOnly />
          </label>

          <button className="primary full" type="submit">
            Save & Continue with Google
          </button>
        </form>

        <div className="setup-note">
          Admin Gmail: <b>muhammadhishamoraginal@gmail.com</b>. Client ko ye page kabhi nahi
          dikhaya jayega.
        </div>
      </section>
    </main>
  );
}
