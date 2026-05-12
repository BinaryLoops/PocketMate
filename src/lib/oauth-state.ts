import 'server-only';

import crypto from 'crypto';

type OAuthStatePayload = {
  uid: string;
  iat: number; // seconds
  nonce: string;
};

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToBuffer(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const normalized = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function requireSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('Missing OAUTH_STATE_SECRET');
  return secret;
}

export function createOAuthState(uid: string): string {
  const payload: OAuthStatePayload = {
    uid,
    iat: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const payloadJson = Buffer.from(JSON.stringify(payload), 'utf8');
  const payloadB64 = base64UrlEncode(payloadJson);

  const sig = crypto.createHmac('sha256', requireSecret()).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);

  return `${payloadB64}.${sigB64}`;
}

export function verifyOAuthState(state: string, maxAgeSeconds = 15 * 60): OAuthStatePayload {
  const [payloadB64, sigB64] = state.split('.');
  if (!payloadB64 || !sigB64) throw new Error('Invalid OAuth state');

  const expectedSig = crypto.createHmac('sha256', requireSecret()).update(payloadB64).digest();
  const actualSig = base64UrlDecodeToBuffer(sigB64);
  const ok = actualSig.length === expectedSig.length && crypto.timingSafeEqual(actualSig, expectedSig);
  if (!ok) throw new Error('Invalid OAuth state signature');

  const payload = JSON.parse(base64UrlDecodeToBuffer(payloadB64).toString('utf8')) as OAuthStatePayload;
  if (!payload?.uid) throw new Error('Invalid OAuth state payload');

  const age = Math.floor(Date.now() / 1000) - payload.iat;
  if (age < 0 || age > maxAgeSeconds) throw new Error('OAuth state expired');

  return payload;
}

