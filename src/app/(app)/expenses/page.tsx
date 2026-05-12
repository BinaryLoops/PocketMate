
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/hooks/use-app';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { AiRecommendations } from '@/components/ai-recommendations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isWithinInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Transaction } from '@/lib/types';
import { BankStatementUploader } from '@/components/bank-statement-uploader';

export default function ExpensesPage() {
  const { transactions } = useApp();
  const [timeRange, setTimeRange] = useState('all');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    if (timeRange === 'month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return transactions.filter(t => isWithinInterval(parseISO(t.date), { start, end }));
    }
    if (timeRange === 'week') {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      return transactions.filter(t => isWithinInterval(parseISO(t.date), { start, end }));
    }
    return transactions;
  }, [transactions, timeRange]);

  const expenseData = useMemo(() => {
    const categoryTotals = filteredTransactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as { [key: string]: number });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [filteredTransactions]);
  
  return (
    <div className="space-y-6">
      <BankStatementUploader />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expense Analysis</h1>
         <Tabs value={timeRange} onValueChange={setTimeRange}>
          <TabsList>
            <TabsTrigger value="all">All Time</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="grid gap-8 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Category Spending</CardTitle>
            <CardDescription>Comparing your spending across categories.</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={expenseData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={100} />
                    <Tooltip
                        formatter={(value: number) => `₹${value.toFixed(2)}`}
                        contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            borderColor: 'hsl(var(--border))',
                        }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <p className="text-muted-foreground">No expense data for this period.</p>
                  <p className="text-sm text-muted-foreground">Log expenses to see your breakdown.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <AiRecommendations />
        </div>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
                A list of your transactions for the selected period.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {sortedTransactions.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {sortedTransactions.map((t: Transaction) => (
                        <TableRow key={t.id}>
                        <TableCell>
                            {new Date(t.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            })}
                        </TableCell>
                        <TableCell className="font-medium">{t.description}</TableCell>
                        <TableCell>
                            <Badge variant="secondary">{t.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">₹{t.amount.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">No transactions for this period.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
