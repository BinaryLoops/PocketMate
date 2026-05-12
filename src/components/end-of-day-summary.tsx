
"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApp } from '@/hooks/use-app';
import { TrendingDown, TrendingUp, PartyPopper, Wallet } from 'lucide-react';
import { Progress } from './ui/progress';

const SUMMARY_HOUR_THRESHOLD = 20; // 8 PM
const LAST_SUMMARY_KEY = 'PocketMate-last-summary-date';

export function EndOfDaySummary() {
  const { profile, getTodaysSpending } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const now = new Date();
    const lastSummaryDate = localStorage.getItem(LAST_SUMMARY_KEY);
    const todayStr = now.toISOString().split('T')[0];

    // Show summary if it's after the threshold hour and it hasn't been shown today
    if (now.getHours() >= SUMMARY_HOUR_THRESHOLD && lastSummaryDate !== todayStr) {
      setIsOpen(true);
      localStorage.setItem(LAST_SUMMARY_KEY, todayStr);
    }
  }, []);

  const todaysSpending = getTodaysSpending();
  const dailyLimit = profile?.dailySpendingLimit || 0;
  const remaining = dailyLimit - todaysSpending;
  const isOverBudget = remaining < 0;
  const progress = dailyLimit > 0 ? (todaysSpending / dailyLimit) * 100 : 0;
  
  const savedAmount = dailyLimit - todaysSpending;

  const handleClose = () => setIsOpen(false);

  if (!profile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-center mb-4">
             {isOverBudget ? (
                <div className="rounded-full bg-destructive/10 p-3">
                    <Wallet className="h-10 w-10 text-destructive" />
                </div>
             ) : (
                <div className="rounded-full bg-green-500/10 p-3">
                    <PartyPopper className="h-10 w-10 text-green-500" />
                </div>
             )}
          </div>
          <DialogTitle className="text-center text-2xl">
            {isOverBudget ? "Budget Exceeded" : "Great Job Today!"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isOverBudget 
              ? "Looks like you've gone a bit over your daily budget. Let's aim to get back on track tomorrow!"
              : "You've stayed within your spending limit. Keep up the fantastic work!"
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                 <div className="flex justify-between font-medium">
                    <span>Spent Today</span>
                    <span>₹{todaysSpending.toFixed(2)} / ₹{dailyLimit.toFixed(2)}</span>
                </div>
                <Progress value={progress} />
            </div>

            <div className={`flex items-center justify-center gap-2 p-3 rounded-lg ${isOverBudget ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-600'}`}>
                {isOverBudget ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                <p className="font-bold text-lg">
                    {isOverBudget ? `₹${Math.abs(remaining).toFixed(2)} Over Budget` : `₹${savedAmount.toFixed(2)} Saved`}
                </p>
            </div>
        </div>
        <Button onClick={handleClose} className="w-full">
            Got It
        </Button>
      </DialogContent>
    </Dialog>
  );
}
