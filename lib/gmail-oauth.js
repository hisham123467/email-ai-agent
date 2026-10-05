import crypto from 'crypto';

const DEFAULT_REDIRECT_URI = 'https://email-ai-agent-amber.vercel.app/api/google/callback';
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

export function gmailOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI;
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString('base64url');
}

export function buildGoogleAuthUrl(state) {
  if (!gmailOAuthConfigured()) throw new Error('Google OAuth is not configured');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCode(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code'
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || payload.error || 'Google token exchange failed');
  return payload;
}

export function encryptRefreshToken(value) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error('Google OAuth secret is missing');
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptRefreshToken(value) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error('Google OAuth secret is missing');
  const raw = Buffer.from(value, 'base64url');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export async function refreshGoogleAccessToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }),
    cache: 'no-store'
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || payload.error || 'Unable to refresh Google access');
  return payload.access_token;
}

export async function getGoogleProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Unable to read Google profile');
  return payload;
}

function header(message, name) {
  return message?.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || '';
}

export function extractEmail(value) {
  const match = String(value || '').match(/<([^>]+)>/);
  return (match ? match[1] : String(value || '')).trim();
}

export function extractName(value) {
  const raw = String(value || '');
  const before = raw.split('<')[0].trim().replace(/^"|"$/g, '');
  return before || extractEmail(raw).split('@')[0] || 'Sender';
}

export async function listGmailInbox(accessToken, limit = 15) {
  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=${Math.max(1, Math.min(limit, 25))}`,
    { headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  );
  const list = await listResponse.json();
  if (!listResponse.ok) throw new Error(list.error?.message || 'Unable to read Gmail inbox');

  const ids = (list.messages || []).map((item) => item.id);
  const messages = await Promise.all(
    ids.map(async (id) => {
      const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
      url.searchParams.set('format', 'metadata');
      ['From', 'Subject', 'Date', 'Message-ID'].forEach((h) => url.searchParams.append('metadataHeaders', h));
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      });
      const message = await response.json();
      if (!response.ok) return null;
      const from = header(message, 'From');
      const labels = message.labelIds || [];
      return {
        id: message.id,
        threadId: message.threadId,
        from: extractEmail(from),
        name: extractName(from),
        subject: header(message, 'Subject') || '(No subject)',
        preview: message.snippet || '',
        receivedAt: header(message, 'Date') || '',
        priority: labels.includes('IMPORTANT') ? 'high' : 'normal',
        status: labels.includes('SENT') ? 'waiting' : 'needs_reply',
        gmail: true
      };
    })
  );

  return messages.filter(Boolean);
}

export async function getGmailMessage(accessToken, messageId) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`);
  url.searchParams.set('format', 'metadata');
  ['From', 'To', 'Subject', 'Date', 'Message-ID', 'References'].forEach((h) => url.searchParams.append('metadataHeaders', h));

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  const message = await response.json();
  if (!response.ok) throw new Error(message.error?.message || 'Unable to load Gmail message');

  const from = header(message, 'From');
  return {
    id: message.id,
    threadId: message.threadId,
    from: extractEmail(from),
    name: extractName(from),
    subject: header(message, 'Subject') || '(No subject)',
    messageIdHeader: header(message, 'Message-ID'),
    references: header(message, 'References'),
    preview: message.snippet || ''
  };
}

export function createTemplateDraft(message) {
  return {
    id: `draft_${Date.now()}`,
    messageId: message.id,
    to: message.from,
    subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
    body: `Hi ${message.name},\n\nThanks for your message. I have received your update and I am reviewing it. I will follow up with the relevant details shortly.\n\nBest regards,\nHisham`,
    status: 'draft_only',
    gmail: true
  };
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

export async function sendGmailReply(accessToken, messageId, body) {
  const original = await getGmailMessage(accessToken, messageId);
  const subject = original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`;
  const refs = [original.references, original.messageIdHeader].filter(Boolean).join(' ').trim();

  const mime = [
    `To: ${original.from}`,
    `Subject: ${subject}`,
    original.messageIdHeader ? `In-Reply-To: ${original.messageIdHeader}` : '',
    refs ? `References: ${refs}` : '',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body
  ].filter((line) => line !== '').join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      raw: base64url(mime),
      threadId: original.threadId
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Unable to send Gmail reply');
  return payload;
}
