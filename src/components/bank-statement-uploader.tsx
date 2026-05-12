"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/hooks/use-app';
import type { Transaction } from '@/lib/types';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';

type ParsedRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  category: string;
};

export function BankStatementUploader() {
  const { importTransactions, profile, updateProfile } = useApp();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [summary, setSummary] = useState<{ totalRows: number; totalDebits: number; totalCredits: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const debitRows = useMemo(() => rows.filter((r) => r.direction === 'debit'), [rows]);
  const creditRows = useMemo(() => rows.filter((r) => r.direction === 'credit'), [rows]);

  const onParse = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/bank-statement/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to parse file');
      setRows(data.rows || []);
      setSummary(data.summary || null);
      toast({ title: 'Statement parsed', description: `Found ${data.summary?.totalRows || 0} entries.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Parse failed', description: e?.message || 'Could not parse statement.' });
    } finally {
      setLoading(false);
    }
  };

  const onImportDebits = async () => {
    if (!debitRows.length) return;
    setImporting(true);
    try {
      const tx: Transaction[] = debitRows.map((r) => ({
        id: r.id,
        date: r.date,
        description: r.description,
        amount: r.amount,
        category: r.category || 'Other',
      }));
      importTransactions(tx);
      toast({ title: 'Imported', description: `Imported ${tx.length} expense transactions.` });
    } finally {
      setImporting(false);
    }
  };

  const onApplyCreditsToIncome = () => {
    if (!profile || !summary) return;
    updateProfile({ income: summary.totalCredits });
    toast({
      title: 'Income updated',
      description: `Monthly income set to ₹${summary.totalCredits.toFixed(2)} based on statement credits.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Bank Statement Import (PDF/Excel)
        </CardTitle>
        <CardDescription>
          Upload YONO SBI or other bank statement files. We parse debit/credit entries and import them into your finances.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button onClick={onParse} disabled={!file || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-2">Analyze file</span>
          </Button>
        </div>

        {summary && (
          <div className="rounded-md border p-3 text-sm space-y-1">
            <p>Total parsed rows: <b>{summary.totalRows}</b></p>
            <p>Total debits (spendings): <b>₹{summary.totalDebits.toFixed(2)}</b></p>
            <p>Total credits (income inflow): <b>₹{summary.totalCredits.toFixed(2)}</b></p>
            <div className="pt-2 flex gap-2">
              <Button onClick={onImportDebits} disabled={!debitRows.length || importing}>
                {importing ? 'Importing...' : `Import ${debitRows.length} debits`}
              </Button>
              <Button variant="secondary" onClick={onApplyCreditsToIncome} disabled={!profile || summary.totalCredits <= 0}>
                Use credits as monthly income
              </Button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-md border p-2 text-sm">
            {rows.slice(0, 40).map((r) => (
              <div key={r.id} className="flex justify-between border-b py-1">
                <span className="truncate pr-2">{new Date(r.date).toLocaleDateString('en-IN')} - {r.description}</span>
                <span className={r.direction === 'credit' ? 'text-green-600' : 'text-foreground'}>
                  {r.direction === 'credit' ? '+' : '-'}₹{r.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Imported data may need review for bank-specific formats. Debit entries are added as expenses; credit totals can update your monthly income.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

