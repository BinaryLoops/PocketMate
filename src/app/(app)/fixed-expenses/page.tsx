
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/hooks/use-app';
import { Pie, PieChart, ResponsiveContainer, Cell, Legend, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Target, CheckCircle, RotateCcw } from 'lucide-react';
import { isAfter, addMonths, format, differenceInMonths, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function FixedExpensesPage() {
  const { profile, toggleFixedExpenseLoggedStatus, isFixedExpenseLoggedForCurrentMonth, getLoggedPaymentCount } = useApp();
  const fixedExpenses = profile?.fixedExpenses || [];
  
  const chartData = useMemo(() => {
    return fixedExpenses.map(exp => ({ name: exp.name, value: exp.amount }));
  }, [fixedExpenses]);

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    return fixedExpenses.filter(exp => {
      if (exp.startDate && exp.timelineMonths) {
        const endDate = addMonths(new Date(exp.startDate), exp.timelineMonths);
        return isAfter(endDate, now) && differenceInMonths(endDate, now) <= 3;
      }
      return false;
    }).map(exp => {
        const endDate = addMonths(new Date(exp.startDate!), exp.timelineMonths!);
        return {...exp, endDate };
    });
  }, [fixedExpenses]);

  const exportCSV = () => {
    if (!fixedExpenses || fixedExpenses.length === 0) return;
    const header = ['name', 'category', 'amount', 'timelineMonths', 'startDate'];
    const rows = fixedExpenses.map(e => [
      '"' + (e.name || '') + '"',
      '"' + (e.category || '') + '"',
      e.amount ?? 0,
      e.timelineMonths ?? '',
      e.startDate ?? ''
    ].join(','));

    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'fixed-expenses.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-4xl font-bold mb-3">Your Fixed Expenses</h1>
                <p className="text-lg text-muted-foreground">Track and manage your recurring monthly payments</p>
            </div>
            <Button asChild size="lg" className="px-8 py-6 text-lg">
                <Link href="/settings">
                    <span className="flex items-center gap-2">
                        Edit Expenses
                    </span>
                </Link>
            </Button>
        </div>

        <div className="space-y-8 mb-8">
          {/* Overview Card */}
          <Card>
              <CardHeader>
                  <CardTitle>Monthly Overview</CardTitle>
                  <CardDescription>Summary of your fixed expenses for {format(new Date(), 'MMMM yyyy')}</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-6 bg-card rounded-lg border">
                          <div className="text-sm text-muted-foreground mb-2">Total Monthly Fixed Expenses</div>
                          <div className="text-2xl font-bold">₹{fixedExpenses.reduce((acc, exp) => acc + exp.amount, 0).toFixed(2)}</div>
                      </div>
                      <div className="p-6 bg-card rounded-lg border">
                          <div className="text-sm text-muted-foreground mb-2">Expenses Paid This Month</div>
                          <div className="text-2xl font-bold">
                              {fixedExpenses.filter(exp => isFixedExpenseLoggedForCurrentMonth(exp.id)).length} / {fixedExpenses.length}
                          </div>
                      </div>
                      <div className="p-6 bg-card rounded-lg border">
                          <div className="text-sm text-muted-foreground mb-2">Payment Progress</div>
                          <Progress 
                              value={(fixedExpenses.filter(exp => isFixedExpenseLoggedForCurrentMonth(exp.id)).length / Math.max(1, fixedExpenses.length)) * 100} 
                              className="mt-2" />
                      </div>
                  </div>
              </CardContent>
          </Card>

          {/* Upcoming Deadlines Card */}
          {upcomingDeadlines.length > 0 && (
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Upcoming Deadlines
                      </CardTitle>
                      <CardDescription>Expenses ending in the next 3 months</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {upcomingDeadlines.map(exp => (
                              <div key={exp.id} className="p-4 bg-muted/50 rounded-lg border border-muted">
                                  <h3 className="font-semibold mb-2">{exp.name}</h3>
                                  <p className="text-sm text-muted-foreground">Ends: {format(exp.endDate, 'MMMM yyyy')}</p>
                                  <p className="text-sm font-medium mt-2">₹{exp.amount.toFixed(2)} / month</p>
                              </div>
                          ))}
                      </div>
                  </CardContent>
              </Card>
          )}

          {/* Three cards side-by-side: Quick Actions, Chart, EMI timelines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Export or manage your fixed expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" onClick={exportCSV} className="w-full">Export CSV</Button>
                  <Button asChild className="w-full">
                    <Link href="/settings">Manage in Settings</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/expenses">Add Expense</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses Breakdown</CardTitle>
                <CardDescription>How your fixed costs are distributed.</CardDescription>
              </CardHeader>
              <CardContent>
                {fixedExpenses.length > 0 ? (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>EMI & Loan Timelines</CardTitle>
                <CardDescription>Remaining duration for your time-bound expenses.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                {fixedExpenses.filter(e => e.timelineMonths).length > 0 ? fixedExpenses.filter(e => e.timelineMonths).map(exp => {
                    if (!exp.startDate || !exp.timelineMonths) return null;
                    const startDate = parseISO(exp.startDate);
                    const endDate = addMonths(startDate, exp.timelineMonths);
                    const totalMonths = exp.timelineMonths;
                    const elapsedMonths = getLoggedPaymentCount(exp.id);
                    const remainingMonths = totalMonths - elapsedMonths;
                    const progress = Math.max(0, Math.min(100, (elapsedMonths / totalMonths) * 100));

                    if (remainingMonths < 0) return null;

                    return (
                        <div key={exp.id}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-medium">{exp.name}</span>
                                <span className="text-sm text-muted-foreground">
                                    {elapsedMonths} / {totalMonths} months
                                </span>
                            </div>
                            <Progress value={progress} className="h-2.5" />
                            <p className="text-xs text-right mt-1 text-muted-foreground">
                              {remainingMonths > 0 ? `${remainingMonths} months left — ends ${format(endDate, 'MMM yyyy')}` : "Completed!"}
                            </p>
                        </div>
                    );
                }) : (
                    <div className="text-muted-foreground">No timeline expenses</div>
                )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      
        {/* Payment Logging Card */}
        <Card className="shadow-lg">
            <CardHeader className="p-8">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl flex items-center gap-3 mb-2">
                            <CheckCircle className="h-6 w-6" />
                            Log Payments
                        </CardTitle>
                        <CardDescription className="text-base">Track your fixed expenses for {format(new Date(), 'MMMM yyyy')}</CardDescription>
                    </div>
                    <Button variant="outline" size="lg" className="gap-2 px-6">
                        <RotateCcw className="h-5 w-5" />
                        Reset All
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {fixedExpenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Expense Details</TableHead>
                    <TableHead className="w-[20%]">Category</TableHead>
                    <TableHead className="w-[20%]">Amount</TableHead>
                    <TableHead className="w-[20%] text-right">Payment Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixedExpenses.map(exp => {
                    const isLogged = isFixedExpenseLoggedForCurrentMonth(exp.id);
                    return (
                      <TableRow key={exp.id} className="hover:bg-muted/50">
                        <TableCell>
                            <div>
                                <div className="font-medium">{exp.name}</div>
                                {exp.timelineMonths && (
                                    <div className="text-sm text-muted-foreground">
                                        {exp.timelineMonths} month commitment
                                    </div>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge 
                                variant="secondary" 
                                className="font-medium px-3 py-1">
                                {exp.category}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <div className="font-medium">₹{exp.amount.toFixed(2)}</div>
                            <div className="text-sm text-muted-foreground">Monthly</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={isLogged ? 'outline' : 'default'}
                            className={`w-[120px] ${isLogged ? 'bg-green-100 hover:bg-green-200 border-green-200' : ''}`}
                            onClick={() => toggleFixedExpenseLoggedStatus(exp.id)}
                          >
                            {isLogged ? (
                              <>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Mark as Unpaid
                              </>
                            ) : (
                               <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                               </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center h-[150px] text-center">
                  <p className="text-muted-foreground">No fixed expenses recorded.</p>
                  <p className="text-sm text-muted-foreground">Add them in your settings.</p>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Suggestions: full-width helpful tips below the table */}
      <Card>
        <CardHeader>
          <CardTitle>Suggestions</CardTitle>
          <CardDescription>Actions to optimize fixed costs</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>Review subscriptions quarterly and cancel unused ones.</li>
            <li>Consider bundling services to lower monthly fees.</li>
            <li>Set a calendar reminder to review loan rates before renewal.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
