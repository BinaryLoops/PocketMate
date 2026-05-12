import 'server-only';

import { getAdminAuth } from '@/lib/firebase-admin';

export async function requireUserIdFromAuthHeader(req: Request): Promise<string> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1]) throw new Error('Missing Authorization: Bearer <firebase id token>');

  const decoded = getAdminAuth().verifyIdToken(m[1]);
  if (!decoded?.uid) throw new Error('Invalid Firebase token (no uid)');
  return decoded.uid;
}

