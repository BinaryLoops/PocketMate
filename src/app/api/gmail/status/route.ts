import { getAdminDb } from '@/lib/firebase-admin';
import { requireUserIdFromAuthHeader } from '@/lib/api-auth';

export async function GET(req: Request) {
  try {
    const uid = await requireUserIdFromAuthHeader(req);
    const snap = await getAdminDb().collection('gmailIntegrations').doc(uid).get();
    const data = snap.exists ? (snap.data() as any) : null;

    return Response.json({
      connected: !!data?.refreshToken,
      connectedEmail: data?.connectedEmail || null,
      scopes: data?.scopes || null,
      updatedAt: data?.updatedAt || null,
      lastSyncedAt: data?.lastSyncedAt || null,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Failed to read status' }, { status: 401 });
  }
}

