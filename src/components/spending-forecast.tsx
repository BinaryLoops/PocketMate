
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApp } from '@/hooks/use-app';
import { getSpendingAlerts, SpendingAlertsInput } from '@/ai/flows/spending-alerts';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { subDays, isAfter } from 'date-fns';
import { AI_DISABLED } from '@/lib/ai-disabled';

export function SpendingForecast() {
  const { profile, goals, transactions } = useApp();
  const [forecast, setForecast] = useState<{ predictedLimit: string; suggestion: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGetForecast = async () => {
    if (AI_DISABLED) return;
    if (!profile) {
       toast({
        variant: 'destructive',
        title: 'Profile Not Found',
        description: 'Please complete onboarding first.',
      });
      return;
    }
    if (transactions.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Not Enough Data',
        description: 'Log at least 3 expenses before getting a forecast.',
      });
      return;
    }

    setIsLoading(true);
    setForecast(null);

    try {
      // 1. Calculate the predicted limit locally
      const sevenDaysAgo = subDays(new Date(), 7);
      const recentTransactions = transactions.filter(t => isAfter(new Date(t.date), sevenDaysAgo));
      const averageDailySpending = recentTransactions.reduce((sum, t) => sum + t.amount, 0) / 7;
      
      const suggestedLimit = Math.max(0, profile.dailySpendingLimit - (averageDailySpending - profile.dailySpendingLimit));
      const predictedLimit = `Based on your recent spending, we recommend a daily limit of around ₹${suggestedLimit.toFixed(2)} for the next week to stay on track.`;

      // 2. Call the AI for qualitative alerts
      const input: SpendingAlertsInput = {
        income: profile.income,
        goals: goals.map(g => ({ name: g.name, targetAmount: g.targetAmount, monthlyContribution: g.monthlyContribution })),
        expensesData: transactions
          .filter(t => t.category)
          .slice(0, 20) // Limit to last 20 transactions for performance
          .map(t => ({ amount: t.amount, category: t.category, date: t.date })),
      };

      const result = await getSpendingAlerts(input);
      setForecast({
        predictedLimit,
        suggestion: result.suggestion,
      });

    } catch (error) {
      console.error('Error fetching AI forecast:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not fetch AI forecast. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary"/>
          AI Spending Forecast
        </CardTitle>
        <CardDescription>Get AI-powered predictions on your future spending habits and receive proactive suggestions.</CardDescription>
      </CardHeader>
      <CardContent>
        {forecast && (
          <div className="space-y-4 mb-6">
            <Alert>
              <AlertTitle className="font-semibold">Recommended Daily Limit</AlertTitle>
              <AlertDescription>{forecast.predictedLimit}</AlertDescription>
            </Alert>
            <Alert variant="default">
              <AlertTitle className="font-semibold">Weekly Suggestion</AlertTitle>
              <AlertDescription>{forecast.suggestion}</AlertDescription>
            </Alert>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center items-center my-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Analyzing your spending patterns...</p>
          </div>
        )}

        <Button onClick={handleGetForecast} disabled={isLoading || AI_DISABLED} className="w-full">
          {AI_DISABLED ? 'AI temporarily disabled' : isLoading ? 'Forecasting...' : 'Get AI Forecast'}
        </Button>
      </CardContent>
    </Card>
  );
}
