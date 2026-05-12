import { getAdminDb } from '@/lib/firebase-admin';
import { requireUserIdFromAuthHeader } from '@/lib/api-auth';
import { buildGmailAuthUrl } from '@/lib/gmail';
import { createOAuthState } from '@/lib/oauth-state';

export async function POST(req: Request) {
  try {
    const uid = await requireUserIdFromAuthHeader(req);

    // Optional: mark intent to connect (helps debugging/status)
    await getAdminDb().collection('gmailIntegrations').doc(uid).set(
      {
        userId: uid,
        connectStartedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const state = createOAuthState(uid);
    const url = buildGmailAuthUrl(state);
    return Response.json({ url });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Failed to create auth URL' }, { status: 400 });
  }
}

