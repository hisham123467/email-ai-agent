export const dynamic = 'force-dynamic';

function decodePayload(token) {
  const part = token.split('.')[1];
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(normalized, 'base64').toString('utf8');
  return JSON.parse(json);
}

export async function GET() {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    return Response.json({ ok: false, error: 'VERCEL_OIDC_TOKEN unavailable' }, { status: 500 });
  }
  const payload = decodePayload(token);
  return Response.json({
    ok: true,
    claims: {
      iss: payload.iss,
      aud: payload.aud,
      sub: payload.sub,
      owner: payload.owner,
      project: payload.project,
      environment: payload.environment,
      project_id: payload.project_id,
      team_id: payload.team_id
    }
  });
}
