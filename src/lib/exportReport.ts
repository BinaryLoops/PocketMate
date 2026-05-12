import { UserProfile, Transaction, Goal } from '@/lib/types';

type ReportInput = {
  profile?: UserProfile | null;
  transactions?: Transaction[];
  goals?: Goal[];
};

export function buildOrganizedReport({ profile, transactions = [], goals = [] }: ReportInput) {
  const report: any = {
    generatedAt: new Date().toISOString(),
    summary: {
      name: profile?.name ?? null,
      role: profile?.role ?? null,
      income: profile?.income ?? null,
      monthlyNeeds: profile?.monthlyNeeds ?? null,
      monthlyWants: profile?.monthlyWants ?? null,
      monthlySavings: profile?.monthlySavings ?? null,
    },
    fixedExpenses: (profile?.fixedExpenses ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      amount: e.amount,
      timelineMonths: e.timelineMonths,
      startDate: e.startDate ?? null,
    })),
    transactions: transactions.map((t) => ({ id: t.id, date: t.date, description: t.description, amount: t.amount, category: t.category })),
    goals: goals.map((g) => ({ id: g.id, name: g.name, target: g.targetAmount, monthlyContribution: g.monthlyContribution })),
  };

  return report;
}

export function toJsonBlob(report: any) {
  const json = JSON.stringify(report, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export function transactionsToCsv(transactions: any[]) {
  const headers = ['id', 'date', 'description', 'amount', 'category'];
  const rows = transactions.map((t) => headers.map((h) => {
    const v = t[h as keyof typeof t];
    if (v == null) return '';
    return String(v).replace(/"/g, '""');
  }).join(','));

  return [headers.join(','), ...rows].join('\n');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
