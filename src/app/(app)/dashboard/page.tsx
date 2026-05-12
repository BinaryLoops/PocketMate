
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { IndianRupee, Target, TrendingUp, TrendingDown, PiggyBank, Wallet, ShoppingCart, ShieldCheck, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/hooks/use-app';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { SpendingForecast } from '@/components/spending-forecast';

function StatCard({ title, value, icon, change, changeType }: { title: string, value: string, icon: React.ReactNode, change?: string, changeType?: 'increase' | 'decrease' }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className="text-xs text-muted-foreground flex items-center">
            {changeType === 'increase' ? <TrendingUp className="h-4 w-4 mr-1 text-green-500" /> : <TrendingDown className="h-4 w-4 mr-1 text-red-500" />}
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile, goals, transactions, getTodaysSpending, getTotalGoalContributions, getCumulativeDailySavings } = useApp();

  const totalGoalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalGoalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  
  const todaysSpending = getTodaysSpending();
  
  const overallSpending = transactions.reduce((sum, t) => sum + t.amount, 0);
  const income = profile?.income || 0;
  const spendingVsIncome = income > 0 ? `${((overallSpending / income) * 100).toFixed(0)}% of income` : '';

  const recentTransactions = transactions.slice(0, 7).reverse();
  const chartData = recentTransactions.map(t => ({
      date: new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short'}),
      amount: t.amount,
  }));

  const {
    monthlyNeeds,
    monthlyWants,
    monthlySavings,
    dailySpendingLimit,
    goalContributions,
  } = React.useMemo(() => {
    if (!profile) {
      return {
        monthlyNeeds: 0,
        monthlyWants: 0,
        monthlySavings: 0,
        dailySpendingLimit: 0,
        goalContributions: 0,
      };
    }
    
    const totalGoalContributions = getTotalGoalContributions();
  
    return {
      monthlyNeeds: profile.monthlyNeeds,
      monthlyWants: profile.monthlyWants,
      monthlySavings: profile.monthlySavings,
      dailySpendingLimit: profile.dailySpendingLimit,
      goalContributions: totalGoalContributions,
    };
  }, [profile, getTotalGoalContributions]);
  
  const todaysSavings = dailySpendingLimit - todaysSpending;
  const cumulativeSavings = getCumulativeDailySavings();

  const emergencyFund = profile?.emergencyFund;
  const emergencyFundProgress = emergencyFund && emergencyFund.target > 0 ? (emergencyFund.current / emergencyFund.target) * 100 : 0;


  if (!profile) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Welcome to PocketMate!</h2>
        <p className="text-muted-foreground mb-6">Please complete the onboarding to start managing your finances.</p>
        <Button asChild>
          <Link href="/onboarding">Start Onboarding</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center pb-4 border-b">
        <p className="text-sm text-muted-foreground">
          Made by: Ayush (24BCE1548) and Niteesh Vemulapalli (24BCE1555)
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Monthly Income" 
          value={`₹${income.toFixed(2)}`}
          icon={<IndianRupee className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard 
          title="Overall Spending" 
          value={`₹${overallSpending.toFixed(2)}`}
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
          change={spendingVsIncome}
          changeType={income > overallSpending ? 'increase' : 'decrease'}
        />
        <StatCard
          title="Total Daily Savings"
          value={`₹${(cumulativeSavings).toFixed(2)}`}
          icon={<PiggyBank className="h-4 w-4 text-muted-foreground" />}
          change={todaysSavings >= 0 ? `+ ₹${todaysSavings.toFixed(2)} today` : `- ₹${Math.abs(todaysSavings).toFixed(2)} today`}
          changeType={todaysSavings >= 0 ? "increase" : "decrease"}
        />
        <StatCard 
          title="Total Goal Savings" 
          value={`₹${totalGoalSaved.toFixed(2)}`}
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
            <CardHeader>
            <CardTitle>Financial Breakdown</CardTitle>
            <CardDescription>Your monthly budget allocated across Needs, Wants, and Savings.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted/50 flex flex-col justify-center items-center">
                    <Wallet className="h-6 w-6 text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Needs</p>
                    <p className="text-lg font-bold">₹{monthlyNeeds.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 flex flex-col justify-center items-center">
                    <ShoppingCart className="h-6 w-6 text-accent mb-2" />
                    <p className="text-sm text-muted-foreground">Wants</p>
                    <p className="text-lg font-bold">₹{monthlyWants.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 flex flex-col justify-center items-center">
                    <PiggyBank className="h-6 w-6 text-green-500 mb-2" />
                    <p className="text-sm text-muted-foreground">Savings</p>
                    <p className="text-lg font-bold">₹{monthlySavings.toFixed(2)}</p>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Monthly Savings Allocation</h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground"><Target className="h-4 w-4" /> Committed to Goals</span>
                        <span className="font-semibold">₹{goalContributions.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Available for Emergency Fund</span>
                        <span className="font-semibold">₹{Math.max(0, monthlySavings - goalContributions).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-base font-bold pt-2 border-t">
                        <span>Total Monthly Savings</span>
                        <span>₹{monthlySavings.toFixed(2)}</span>
                    </div>
                </div>
              </div>
            </CardContent>
        </Card>
         <Link href="/emergency-fund" className="block">
          <Card className="h-full hover:border-primary/50 transition-colors flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-primary" />
                    Emergency Fund
                </CardTitle>
                 <CardDescription>
                    Your safety net for unexpected events. Current balance:
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center">
                 <div className="text-4xl font-bold">
                    ₹{(emergencyFund?.current || 0).toFixed(2)}
                 </div>
            </CardContent>
            <CardFooter>
                 <Button className="w-full" variant="secondary">Manage Fund</Button>
            </CardFooter>
          </Card>
        </Link>
      </div>


      <div className="grid gap-6 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Recent Spending</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`}/>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => `₹${value.toFixed(2)}`}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Active Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.length > 0 ? goals.map(goal => (
              <div key={goal.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{goal.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ₹{goal.currentAmount.toFixed(2)} / ₹{goal.targetAmount.toFixed(2)}
                  </span>
                </div>
                <Progress value={(goal.currentAmount / goal.targetAmount) * 100} />
              </div>
            )) : (
              <div className="text-center text-muted-foreground py-8">
                <p>You haven't set any goals yet.</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/goals">Set a Goal</Link>
                </Button>
              </div>
            )}
            {goals.length > 0 && (
              <Button className="w-full mt-4" asChild>
                <Link href="/goals">Manage Goals</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <SpendingForecast />

    </div>
  );
}
