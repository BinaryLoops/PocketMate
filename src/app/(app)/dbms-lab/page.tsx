"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/hooks/use-app';
import { useToast } from '@/hooks/use-toast';
import { Database, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';

type DbmsSummary = {
  uid: string;
  counts: Record<string, number>;
  totals: Record<string, number>;
  samples: { last5Transactions: any[] };
  relationalMapping: any;
  generatedAt: string;
};

type IntegrityResult = {
  stats: {
    goals: number;
    fixedExpenses: number;
    transactions: number;
    duplicatesDetected: number;
    issues: number;
  };
  issues: { level: 'warning' | 'error'; collection: string; docId: string; message: string }[];
  generatedAt: string;
};

/**
 * DBMS Lab (new, additive page)
 * - Shows schema/relationships in DBMS language
 * - Shows live per-user DB counts & sample queries
 * - Runs a read-only integrity check (like constraints + duplicate detection)
 *
 * Access: visit `/dbms-lab` after login.
 */
export default function DbmsLabPage() {
  const { user } = useApp();
  const { toast } = useToast();

  const [summary, setSummary] = useState<DbmsSummary | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingIntegrity, setLoadingIntegrity] = useState(false);

  const fetchJson = async (path: string) => {
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    return data;
  };

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = (await fetchJson('/api/dbms/summary')) as DbmsSummary;
      setSummary(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'DBMS summary failed', description: e?.message || 'Could not load summary' });
    } finally {
      setLoadingSummary(false);
    }
  };

  const runIntegrity = async () => {
    setLoadingIntegrity(true);
    try {
      const data = (await fetchJson('/api/dbms/integrity-check')) as IntegrityResult;
      setIntegrity(data);
      toast({ title: 'Integrity check complete', description: `Issues found: ${data.stats.issues}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Integrity check failed', description: e?.message || 'Could not run check' });
    } finally {
      setLoadingIntegrity(false);
    }
  };

  useEffect(() => {
    if (user) loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const schemaRows = useMemo(
    () => [
      { table: 'users', pk: 'uid', notes: 'Stored in Firebase Authentication (identity layer)' },
      { table: 'profiles', pk: 'uid', notes: '1:1 with user; contains budget fields + emergency fund' },
      { table: 'transactions', pk: 'uid_transactionId', notes: '1:N; includes optional import metadata (Gmail/statement)' },
      { table: 'goals', pk: 'uid_goalId', notes: '1:N; contributions history modeled as embedded array' },
      { table: 'fixed-expenses', pk: 'uid_expenseId', notes: '1:N; recurring expenses' },
      { table: 'gmailIntegrations', pk: 'uid', notes: '1:1; stores OAuth refresh token server-side (no passwords stored)' },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            DBMS Lab
          </h1>
          <p className="text-sm text-muted-foreground">
            A DBMS-focused view of PocketMate’s database design, relationships, queries, and integrity checks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadSummary} disabled={loadingSummary || !user}>
            <RefreshCw className="h-4 w-4" />
            <span className="ml-2">{loadingSummary ? 'Refreshing…' : 'Refresh'}</span>
          </Button>
          <Button onClick={runIntegrity} disabled={loadingIntegrity || !user}>
            <ShieldCheck className="h-4 w-4" />
            <span className="ml-2">{loadingIntegrity ? 'Checking…' : 'Run Integrity Check'}</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logical Schema (DBMS View)</CardTitle>
          <CardDescription>Firestore collections mapped as logical tables with keys and relationships.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table / Collection</TableHead>
                <TableHead>Primary Key</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schemaRows.map((r) => (
                <TableRow key={r.table}>
                  <TableCell className="font-medium">{r.table}</TableCell>
                  <TableCell>{r.pk}</TableCell>
                  <TableCell className="text-muted-foreground">{r.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Live Database Summary</CardTitle>
            <CardDescription>Counts and sample query results for your user account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!summary ? (
              <p className="text-sm text-muted-foreground">No data loaded yet.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.totals || {}).map(([k, v]) => (
                    <Badge key={k} variant="secondary">
                      {k}: {v}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  Generated at: {new Date(summary.generatedAt).toLocaleString()}
                </div>
                <div className="pt-3">
                  <p className="text-sm font-semibold mb-2">Sample query: last 5 transactions (ORDER BY date DESC)</p>
                  <div className="max-h-56 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(summary.samples?.last5Transactions || []).map((t: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs text-muted-foreground">
                              {t?.date ? new Date(t.date).toLocaleDateString('en-IN') : '—'}
                            </TableCell>
                            <TableCell className="truncate max-w-[220px]">{t?.description || '—'}</TableCell>
                            <TableCell className="text-right">₹{Number(t?.amount || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrity & Duplicate Detection</CardTitle>
            <CardDescription>
              Read-only checks that demonstrate DBMS constraints (required fields, types, uniqueness via fingerprint).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!integrity ? (
              <p className="text-sm text-muted-foreground">Run the integrity check to see results.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">transactions: {integrity.stats.transactions}</Badge>
                  <Badge variant="secondary">duplicates: {integrity.stats.duplicatesDetected}</Badge>
                  <Badge variant="secondary">issues: {integrity.stats.issues}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Generated at: {new Date(integrity.generatedAt).toLocaleString()}
                </div>

                <div className="max-h-56 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Level</TableHead>
                        <TableHead>Collection</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {integrity.issues.slice(0, 30).map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              {it.level}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{it.collection}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{it.message}</TableCell>
                        </TableRow>
                      ))}
                      {integrity.issues.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-sm text-muted-foreground">
                            No issues detected.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SQL vs Firestore (Mapping)</CardTitle>
          <CardDescription>Explain DBMS concepts using equivalent Firestore queries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border p-3">
            <p className="font-semibold mb-1">Example 1: All transactions for a user (latest first)</p>
            <p className="text-muted-foreground">
              SQL: <code>SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC;</code>
            </p>
            <p className="text-muted-foreground">
              Firestore: <code>where('userId','==',uid).orderBy('date','desc')</code>
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold mb-1">Example 2: Cascade delete (concept)</p>
            <p className="text-muted-foreground">
              SQL: <code>DELETE FROM users WHERE uid = ?;</code> with <code>ON DELETE CASCADE</code>
            </p>
            <p className="text-muted-foreground">
              Firestore: implemented in app logic via <code>deleteUserData(uid)</code> to delete profile + related docs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

