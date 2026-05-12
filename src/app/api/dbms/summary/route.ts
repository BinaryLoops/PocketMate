import { getAdminDb } from '@/lib/firebase-admin';
import { requireUserIdFromAuthHeader } from '@/lib/api-auth';

/**
 * DBMS demo endpoint:
 * - Returns per-user counts for each "logical table" (Firestore collection).
 * - Returns sample "query" results to show ordering/filtering in Firestore.
 *
 * This is read-only and does NOT affect existing features.
 */
export async function GET(req: Request) {
  try {
    const uid = await requireUserIdFromAuthHeader(req);
    const db = getAdminDb();

    const [profileSnap, goalsSnap, txSnap, fixedSnap, gmailSnap] = await Promise.all([
      db.collection('profiles').doc(uid).get(),
      db.collection('goals').where('userId', '==', uid).get(),
      db.collection('transactions').where('userId', '==', uid).orderBy('date', 'desc').limit(5).get(),
      db.collection('fixed-expenses').where('userId', '==', uid).get(),
      db.collection('gmailIntegrations').doc(uid).get(),
    ]);

    const last5Transactions = txSnap.docs.map((d) => d.data());

    return Response.json({
      uid,
      counts: {
        profiles: profileSnap.exists ? 1 : 0,
        goals: goalsSnap.size,
        transactions: txSnap.size, // last 5 only (see totals below)
        fixedExpenses: fixedSnap.size,
        gmailIntegrations: gmailSnap.exists ? 1 : 0,
      },
      totals: {
        // totals are computed separately to demonstrate aggregation-style queries
        goals: goalsSnap.size,
        fixedExpenses: fixedSnap.size,
        // NOTE: transactions total can be large; for demo we fetch count by scanning user transactions.
        // For production, prefer Firestore count aggregation.
        transactions: (await db.collection('transactions').where('userId', '==', uid).get()).size,
      },
      samples: {
        last5Transactions,
      },
      relationalMapping: {
        usersPrimaryKey: 'Firebase Auth UID',
        foreignKeyLikeField: 'userId',
        docIdPatterns: {
          profiles: 'uid',
          goals: 'uid_goalId',
          transactions: 'uid_transactionId',
          fixedExpenses: 'uid_expenseId',
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Failed to build DBMS summary' }, { status: 400 });
  }
}

