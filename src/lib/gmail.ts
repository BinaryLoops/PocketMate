import 'server-only';

import { google } from 'googleapis';

export type GmailIntegrationDoc = {
  userId: string;
  connectedEmail?: string;
  scopes?: string[];
  refreshToken: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastSyncedAt?: string; // ISO
  processedMessageIds?: string[]; // bounded list
};

export type ParsedMailTransaction = {
  id: string; // deterministic, e.g. gmail_<messageId>
  amount: number;
  description: string;
  category: string;
  date: string; // ISO
  source: 'gmail:gpay' | 'gmail:paytm' | 'gmail:unknown';
  messageId: string;
  reference?: string;
  subject?: string;
  from?: string;
};

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
] as const;

export function getGmailOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function buildGmailAuthUrl(state: string) {
  const oauth2 = getGmailOAuthClient();
  const scopes = (process.env.GMAIL_SCOPES?.split(',').map((s) => s.trim()).filter(Boolean) ??
    DEFAULT_SCOPES) as string[];

  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = getGmailOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    // This happens if the user previously consented and Google doesn't return refresh_token again.
    // We request prompt=consent, but users can still hit this in some cases.
    throw new Error('No refresh token returned from Google. Revoke app access and try again.');
  }
  return tokens;
}

export function gmailClientFromRefreshToken(refreshToken: string) {
  const oauth2 = getGmailOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

export async function fetchConnectedEmail(refreshToken: string): Promise<string | undefined> {
  const oauth2 = getGmailOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });
  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
  const me = await oauth2Api.userinfo.get();
  return me.data.email || undefined;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(normalized, 'base64');
  return buf.toString('utf8');
}

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, key: string): string | undefined {
  const found = headers?.find((h) => (h.name || '').toLowerCase() === key.toLowerCase());
  return found?.value || undefined;
}

function pickBodyText(payload: any): string {
  // Gmail message parts can be nested. Prefer text/plain, fallback to snippet-like extraction.
  const tryPart = (part: any): string | null => {
    if (!part) return null;
    const mime = part.mimeType;
    const bodyData = part.body?.data;
    if (mime === 'text/plain' && bodyData) return decodeBase64Url(bodyData);
    if (mime === 'text/html' && bodyData) return decodeBase64Url(bodyData).replace(/<[^>]+>/g, ' ');
    const parts = part.parts as any[] | undefined;
    if (parts && parts.length) {
      for (const p of parts) {
        const t = tryPart(p);
        if (t) return t;
      }
    }
    return null;
  };

  return tryPart(payload) ?? '';
}

function parseAmountINR(text: string): number | null {
  // Handles ₹1,234.56, INR 1234, Rs. 1234
  const patterns = [
    /₹\s*([0-9][0-9,]*\.?[0-9]{0,2})/i,
    /\bINR\s*([0-9][0-9,]*\.?[0-9]{0,2})/i,
    /\bRs\.?\s*([0-9][0-9,]*\.?[0-9]{0,2})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function guessSource(from: string | undefined, subject: string | undefined, text: string): ParsedMailTransaction['source'] {
  const hay = `${from || ''} ${subject || ''} ${text}`.toLowerCase();
  if (hay.includes('google pay') || hay.includes('gpay') || hay.includes('payments-noreply@google.com')) return 'gmail:gpay';
  if (hay.includes('paytm')) return 'gmail:paytm';
  return 'gmail:unknown';
}

function defaultCategoryFor(source: ParsedMailTransaction['source']): string {
  // Conservative default; user can recategorize later.
  if (source === 'gmail:gpay' || source === 'gmail:paytm') return 'Other';
  return 'Other';
}

function guessDescription(source: ParsedMailTransaction['source'], subject?: string, bodyText?: string): string {
  const base = subject?.trim() || '';
  if (base) return base.slice(0, 140);
  const t = (bodyText || '').replace(/\s+/g, ' ').trim();
  if (t) return t.slice(0, 140);
  return source === 'gmail:gpay' ? 'GPay transaction (imported)' : source === 'gmail:paytm' ? 'Paytm transaction (imported)' : 'Transaction (imported)';
}

function extractTransactionReference(text: string): string | undefined {
  const t = text.replace(/\s+/g, ' ');
  const patterns: RegExp[] = [
    /\bUTR[:\-\s]*([A-Z0-9]{10,22})\b/i,
    /\bRRN[:\-\s]*([0-9]{10,18})\b/i,
    /\bUPI(?:\s*Ref(?:erence)?\s*No\.?)?[:\-\s]*([0-9]{10,20})\b/i,
    /\bRef(?:erence)?\s*(?:No\.?|ID)?[:\-\s]*([A-Z0-9\-]{8,30})\b/i,
    /\bTxn\s*ID[:\-\s]*([A-Z0-9\-]{8,30})\b/i,
    /\bTransaction\s*ID[:\-\s]*([A-Z0-9\-]{8,30})\b/i,
    /\bBank\s*Ref(?:erence)?[:\-\s]*([A-Z0-9\-]{8,30})\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

export async function fetchAndParseTransactionsFromGmail(opts: {
  refreshToken: string;
  maxMessages?: number;
  afterIso?: string;
  processedMessageIds?: Set<string>;
}): Promise<ParsedMailTransaction[]> {
  const gmail = gmailClientFromRefreshToken(opts.refreshToken);
  const maxMessages = Math.min(Math.max(opts.maxMessages ?? 25, 1), 100);

  const qPieces: string[] = [];
  // Target typical senders/keywords; you can override via env for your region.
  const envQuery = process.env.GMAIL_FINANCE_QUERY?.trim();
  if (envQuery) {
    qPieces.push(`(${envQuery})`);
  } else {
    qPieces.push(
      [
        'from:(payments-noreply@google.com)',
        'OR subject:(Google Pay)',
        'OR (gpay)',
        'OR (paytm)',
      ].join(' ')
    );
  }

  if (opts.afterIso) {
    const after = Math.floor(new Date(opts.afterIso).getTime() / 1000);
    if (Number.isFinite(after) && after > 0) qPieces.push(`after:${after}`);
  }

  const q = qPieces.join(' ');

  const list = await gmail.users.messages.list({
    userId: 'me',
    q,
    maxResults: maxMessages,
  });

  const ids = (list.data.messages || []).map((m) => m.id).filter(Boolean) as string[];
  const out: ParsedMailTransaction[] = [];

  for (const messageId of ids) {
    if (opts.processedMessageIds?.has(messageId)) continue;

    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const payload = msg.data.payload;
    const headers = payload?.headers as any[] | undefined;
    const subject = getHeader(headers, 'Subject');
    const from = getHeader(headers, 'From');
    const internalDateMs = msg.data.internalDate ? Number(msg.data.internalDate) : NaN;
    const dateIso = Number.isFinite(internalDateMs) ? new Date(internalDateMs).toISOString() : new Date().toISOString();

    const bodyText = pickBodyText(payload);
    const textForParsing = `${subject || ''}\n${bodyText}`.slice(0, 100_000);
    const amount = parseAmountINR(textForParsing);
    if (!amount) continue;

    const source = guessSource(from, subject, bodyText);
    const reference = extractTransactionReference(textForParsing);
    const txId = reference ? `gmail_${reference}` : `gmail_${messageId}`;
    const tx: ParsedMailTransaction = {
      id: txId,
      amount,
      category: defaultCategoryFor(source),
      description: guessDescription(source, subject, bodyText),
      date: dateIso,
      source,
      messageId,
      reference,
      subject,
      from,
    };
    out.push(tx);
  }

  return out;
}

