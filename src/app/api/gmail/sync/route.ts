import { getAdminDb } from '@/lib/firebase-admin';
import { requireUserIdFromAuthHeader } from '@/lib/api-auth';
import { fetchAndParseTransactionsFromGmail } from '@/lib/gmail';

function boundedUnique(existing: string[] | undefined, add: string[], max = 500): string[] {
  const set = new Set<string>(existing || []);
  for (const v of add) set.add(v);
  // keep newest at end; slice to max
  return Array.from(set).slice(-max);
}

export async function POST(req: Request) {
  try {
    const uid = await requireUserIdFromAuthHeader(req);
    const body = (await req.json().catch(() => ({}))) as { maxMessages?: number };

    const adminDb = getAdminDb();
    const ref = adminDb.collection('gmailIntegrations').doc(uid);
    const snap = await ref.get();
    const integ = snap.exists ? (snap.data() as any) : null;
    if (!integ?.refreshToken) {
      return Response.json({ error: 'Gmail not connected' }, { status: 400 });
    }

    const processed = new Set<string>((integ.processedMessageIds as string[] | undefined) || []);
    const parsed = await fetchAndParseTransactionsFromGmail({
      refreshToken: integ.refreshToken as string,
      maxMessages: body.maxMessages ?? 25,
      afterIso: integ.lastSyncedAt as string | undefined,
      processedMessageIds: processed,
    });

    // Upsert imported transactions into Firestore transactions collection
    // and return them so the client can merge into local state too.
    const writes = parsed.map((t) =>
      adminDb
        .collection('transactions')
        .doc(`${uid}_${t.id}`)
        .set(
          {
            ...t,
            userId: uid,
            // Match existing Transaction shape where possible
            id: t.id,
            amount: t.amount,
            category: t.category,
            description: t.description,
            date: t.date,
            importSource: t.source,
            importMessageId: t.messageId,
            importRef: t.reference,
          },
          { merge: true }
        )
    );
    await Promise.all(writes);

    const messageIds = parsed.map((p) => p.messageId);
    const nowIso = new Date().toISOString();
    await ref.set(
      {
        lastSyncedAt: nowIso,
        updatedAt: nowIso,
        processedMessageIds: boundedUnique(integ.processedMessageIds, messageIds),
      },
      { merge: true }
    );

    return Response.json({
      imported: parsed.length,
      transactions: parsed.map((p) => ({
        id: p.id,
        amount: p.amount,
        category: p.category,
        description: p.description,
        date: p.date,
        importSource: p.source,
        importMessageId: p.messageId,
        importRef: p.reference,
      })),
    });
  } catch (e: any) {
    const status = e?.code || e?.status || e?.response?.status;
    const details =
      e?.response?.data?.error_description ||
      e?.response?.data?.error?.message ||
      e?.response?.data?.error ||
      e?.message;

    // Common: Gmail API 403 "Request had insufficient authentication scopes."
    if (String(details || '').toLowerCase().includes('insufficient authentication scopes')) {
      return Response.json(
        {
          error:
            'Gmail permission scopes are insufficient. In Google Cloud OAuth consent screen, add Gmail readonly scope, then disconnect and reconnect Gmail to re-consent.',
          details,
          status: status ?? 403,
          requiredScope: 'https://www.googleapis.com/auth/gmail.readonly',
        },
        { status: 400 }
      );
    }

    return Response.json(
      { error: details || 'Sync failed', status: status ?? 400 },
      { status: 400 }
    );
  }
}

