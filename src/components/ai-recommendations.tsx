
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApp } from '@/hooks/use-app';
import { getExpenseAdjustmentRecommendations, ExpenseAdjustmentRecommendationsInput } from '@/ai/flows/expense-adjustment-recommendations';
import { Wand2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AI_DISABLED } from '@/lib/ai-disabled';

export function AiRecommendations() {
  const { profile, goals, transactions } = useApp();
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGetRecommendations = async () => {
    if (AI_DISABLED) return;
    if (!profile) {
      toast({
        variant: 'destructive',
        title: 'Profile Not Found',
        description: 'Please complete onboarding first.',
      });
      return;
    }

    setIsLoading(true);
    setRecommendations([]);

    try {
      const input: ExpenseAdjustmentRecommendationsInput = {
        income: profile.income,
        fixedExpenses: profile.fixedExpenses,
        goals: goals.map(g => ({
          name: g.name,
          target: g.targetAmount,
          timelineMonths: g.timelineMonths,
        })),
        currentExpenses: transactions
          .filter(t => t.category)
          .map(t => ({
          name: t.category,
          amount: t.amount,
        })),
        discretionarySpendingLimit: profile.dailySpendingLimit,
      };

      const result = await getExpenseAdjustmentRecommendations(input);
      setRecommendations(result.recommendations);
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not fetch AI recommendations. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary"/>
          AI Expense Advisor
        </CardTitle>
        <CardDescription>Get personalized tips on how to adjust your spending to meet your goals.</CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length > 0 && (
          <div className="space-y-3 mb-6">
            <h4 className="font-semibold">Here are some suggestions:</h4>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              {recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center items-center my-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Analyzing your spending...</p>
          </div>
        )}

        <Button onClick={handleGetRecommendations} disabled={isLoading || AI_DISABLED} className="w-full">
          {AI_DISABLED ? 'AI temporarily disabled' : isLoading ? 'Generating...' : 'Get AI Recommendations'}
        </Button>
      </CardContent>
    </Card>
  );
}
