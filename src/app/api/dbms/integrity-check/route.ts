import { getAdminDb } from '@/lib/firebase-admin';
import { requireUserIdFromAuthHeader } from '@/lib/api-auth';

type Issue = {
  level: 'warning' | 'error';
  collection: string;
  docId: string;
  message: string;
};

function normalizeDesc(s: unknown): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

function roundTo5MinIso(iso: unknown): string {
  const ms = Date.parse(String(iso || ''));
  if (!Number.isFinite(ms)) return 'invalid';
  const rounded = Math.floor(ms / (5 * 60 * 1000)) * (5 * 60 * 1000);
  return new Date(rounded).toISOString();
}

function amtKey(n: unknown): string {
  const num = Number(n);
  return Number.isFinite(num) ? num.toFixed(2) : 'NaN';
}

function fingerprint(t: any): string {
  const ref = String(t?.importRef || '').trim();
  if (ref) return `ref:${ref}|amt:${amtKey(t?.amount)}`;
  return `t:${roundTo5MinIso(t?.date)}|amt:${amtKey(t?.amount)}|d:${normalizeDesc(t?.description)}`;
}

export async function GET(req: Request) {
  try {
    const uid = await requireUserIdFromAuthHeader(req);
    const db = getAdminDb();

    const issues: Issue[] = [];

    const [profileSnap, goalsSnap, fixedSnap, txSnap] = await Promise.all([
      db.collection('profiles').doc(uid).get(),
      db.collection('goals').where('userId', '==', uid).get(),
      db.collection('fixed-expenses').where('userId', '==', uid).get(),
      db.collection('transactions').where('userId', '==', uid).get(),
    ]);

    // Profile existence check
    if (!profileSnap.exists) {
      issues.push({
        level: 'warning',
        collection: 'profiles',
        docId: uid,
        message: 'Profile document missing. Complete onboarding to create profile.',
      });
    }

    // Required field checks (basic)
    for (const d of goalsSnap.docs) {
      const g = d.data();
      if (!g?.name || !Number.isFinite(Number(g?.targetAmount))) {
        issues.push({
          level: 'error',
          collection: 'goals',
          docId: d.id,
          message: 'Goal is missing required fields (name/targetAmount).',
        });
      }
    }

    for (const d of fixedSnap.docs) {
      const f = d.data();
      if (!f?.name || !Number.isFinite(Number(f?.amount))) {
        issues.push({
          level: 'error',
          collection: 'fixed-expenses',
          docId: d.id,
          message: 'Fixed expense is missing required fields (name/amount).',
        });
      }
    }

    // Transaction checks + duplicate detection
    const seen = new Map<string, string>(); // fingerprint -> firstDocId
    let duplicates = 0;

    for (const d of txSnap.docs) {
      const t = d.data();
      const amount = Number(t?.amount);
      const dateOk = Number.isFinite(Date.parse(String(t?.date || '')));

      if (!Number.isFinite(amount) || amount < 0) {
        issues.push({
          level: 'error',
          collection: 'transactions',
          docId: d.id,
          message: 'Transaction has invalid amount (must be a non-negative number).',
        });
      }

      if (!dateOk) {
        issues.push({
          level: 'error',
          collection: 'transactions',
          docId: d.id,
          message: 'Transaction has invalid date (must be ISO date string).',
        });
      }

      if (!t?.description) {
        issues.push({
          level: 'warning',
          collection: 'transactions',
          docId: d.id,
          message: 'Transaction description is empty.',
        });
      }

      const fp = fingerprint(t);
      const first = seen.get(fp);
      if (first) {
        duplicates++;
        issues.push({
          level: 'warning',
          collection: 'transactions',
          docId: d.id,
          message: `Possible duplicate detected (matches ${first}) using fingerprint uniqueness logic.`,
        });
      } else {
        seen.set(fp, d.id);
      }
    }

    return Response.json({
      uid,
      stats: {
        goals: goalsSnap.size,
        fixedExpenses: fixedSnap.size,
        transactions: txSnap.size,
        duplicatesDetected: duplicates,
        issues: issues.length,
      },
      issues: issues.slice(0, 200),
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Integrity check failed' }, { status: 400 });
  }
}

