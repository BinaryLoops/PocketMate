import { getAdminDb } from '@/lib/firebase-admin';
import { exchangeCodeForTokens, fetchConnectedEmail } from '@/lib/gmail';
import { verifyOAuthState } from '@/lib/oauth-state';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Always redirect back to settings with a status.
  const appBase = process.env.APP_BASE_URL || 'http://localhost:3000';
  const redirect = new URL('/settings', appBase);

  try {
    if (error) throw new Error(error);
    if (!code) throw new Error('Missing code');
    if (!state) throw new Error('Missing state');

    const { uid } = verifyOAuthState(state);
    const tokens = await exchangeCodeForTokens(code);

    const connectedEmail = await fetchConnectedEmail(tokens.refresh_token!);

    await getAdminDb().collection('gmailIntegrations').doc(uid).set(
      {
        userId: uid,
        refreshToken: tokens.refresh_token,
        scopes: tokens.scope ? tokens.scope.split(' ') : undefined,
        connectedEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    redirect.searchParams.set('gmail', 'connected');
    return Response.redirect(redirect.toString(), 302);
  } catch (e: any) {
    redirect.searchParams.set('gmail', 'error');
    redirect.searchParams.set('msg', e?.message || 'callback_failed');
    return Response.redirect(redirect.toString(), 302);
  }
}

