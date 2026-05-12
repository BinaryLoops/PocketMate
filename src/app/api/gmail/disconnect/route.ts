import { getAdminDb } from '@/lib/firebase-admin';
import { requireUserIdFromAuthHeader } from '@/lib/api-auth';

export async function POST(req: Request) {
  try {
    const uid = await requireUserIdFromAuthHeader(req);
    const ref = getAdminDb().collection('gmailIntegrations').doc(uid);

    await ref.set(
      {
        refreshToken: null,
        connectedEmail: null,
        scopes: null,
        lastSyncedAt: null,
        processedMessageIds: [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Failed to disconnect' }, { status: 400 });
  }
}

