
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApp } from '@/hooks/use-app';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from '@/components/ui/progress';
import { ShieldAlert, Plus, Minus, PiggyBank, Pencil, History, TrendingUp, TrendingDown, Goal } from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const fundActionSchema = z.object({
  amount: z.coerce.number().min(1, 'Amount must be positive'),
  notes: z.string().optional(),
});

type FundActionValues = z.infer<typeof fundActionSchema>;

function FundActionDialog({ type, children }: { type: 'deposit' | 'withdraw', children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { updateEmergencyFund } = useApp();
  
  const form = useForm<FundActionValues>({
    resolver: zodResolver(fundActionSchema),
    defaultValues: { amount: 1000, notes: '' },
  });

  function onSubmit(data: FundActionValues) {
    updateEmergencyFund(type, data.amount, data.notes);
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="xl:max-xl-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{type} Funds</DialogTitle>
          <DialogDescription>
            {type === 'deposit' ? 'Add money to your emergency fund.' : 'Withdraw money from your emergency fund.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 5000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder={type === 'withdraw' ? "e.g., Unplanned car repair" : "e.g., Monthly contribution"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full capitalize">{type}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SetTargetDialog() {
  const { profile, setEmergencyFundTarget } = useApp();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(profile?.emergencyFund.target || 0);

  const handleSave = () => {
    setEmergencyFundTarget(target);
    setOpen(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
            <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Emergency Fund Target</DialogTitle>
          <DialogDescription>Your target should ideally cover 3-6 months of essential living expenses.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
            <Label>Target Amount (₹)</Label>
            <Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Target</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function EmergencyFundPage() {
  const { profile } = useApp();

  const emergencyFund = profile?.emergencyFund;
  const progress = emergencyFund && emergencyFund.target > 0 ? (emergencyFund.current / emergencyFund.target) * 100 : 0;
  const sortedHistory = emergencyFund?.history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  if (!emergencyFund) {
    return (
      <div className="text-center">
        <p>Loading emergency fund data...</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalDeposits = emergencyFund?.history.filter(e => e.type === 'deposit').reduce((sum, e) => sum + e.amount, 0) || 0;
  const totalWithdrawals = emergencyFund?.history.filter(e => e.type === 'withdrawal').reduce((sum, e) => sum + e.amount, 0) || 0;
  const monthlyAdditions = emergencyFund?.history.filter(e => e.type === 'deposit' && new Date(e.date).getMonth() === new Date().getMonth()).reduce((sum, e) => sum + e.amount, 0) || 0;

  return (
    <div className="w-full h-full min-h-screen px-0 py-0 flex flex-col gap-6">
      {/* Header with action buttons */}
      <div className="w-full flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-[#4ADE80]"/>
          Emergency Fund
        </h1>
        <div className="flex gap-2">
          <FundActionDialog type="withdraw">
            <Button variant="outline">
              <Minus className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
          </FundActionDialog>
          <FundActionDialog type="deposit">
            <Button className="bg-[#4ADE80] hover:bg-[#4ADE80]/90">
              <Plus className="mr-2 h-4 w-4" />
              Deposit
            </Button>
          </FundActionDialog>
        </div>
      </div>

      {/* Motivational Banner */}
      <div className="w-full bg-gradient-to-r from-[#4ADE80]/80 to-blue-400/60 rounded-xl p-6 mb-2 flex items-center justify-between shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-white">Building your safety net is the first step to financial freedom!</h2>
          <p className="text-white/80 mt-2">Stay consistent and watch your emergency fund grow.</p>
        </div>
        <PiggyBank className="h-16 w-16 text-white/80 hidden md:block" />
      </div>

      {/* Summary Card */}
      <div className="w-full flex flex-col md:flex-row gap-6">
        <Card className="flex-1 bg-[#1a2332]">
          <CardHeader>
            <CardTitle className="text-lg text-[#4ADE80]">Emergency Fund Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-black/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">Total Deposited</p>
                <p className="text-xl font-bold text-green-400">₹{totalDeposits.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-black/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">Total Withdrawn</p>
                <p className="text-xl font-bold text-red-400">₹{totalWithdrawals.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-black/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">This Month's Addition</p>
                <p className="text-xl font-bold text-blue-400">₹{monthlyAdditions.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Visual Progress Card */}
        <Card className="flex-1 relative">
          <CardHeader>
              <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                      Fund Progress
                  </CardTitle>
                  <div className="text-right">
                      <p className="text-2xl font-bold">₹{emergencyFund.current.toFixed(2)}</p>
                      <div className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                          <span>Target: ₹{emergencyFund.target.toFixed(2)}</span>
                          <SetTargetDialog />
                      </div>
                  </div>
              </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-8">
               <div className="relative w-64 h-64 mb-8">
                 <div className="absolute inset-0 flex items-center justify-center">
                   <svg className="w-full h-full -rotate-90">
                     <circle
                       cx="128"
                       cy="128"
                       r="116"
                       className="stroke-current text-muted stroke-[12px] fill-none"
                     />
                     <circle
                       cx="128"
                       cy="128"
                       r="116"
                       className="stroke-[#4ADE80] stroke-[12px] fill-none transition-all duration-500 ease-out"
                       strokeDasharray={`${progress * 7.28} 728`}
                     />
                   </svg>
                   <div className="absolute flex flex-col items-center">
                     <div className="text-4xl font-bold mb-2">{progress.toFixed(1)}%</div>
                     <div className="text-sm text-muted-foreground">of target</div>
                   </div>
                 </div>
               </div>
               <div className="w-full space-y-4">
                 <Progress value={progress} className="h-4 w-full" />
                 <p className="text-center text-sm text-muted-foreground">
                   {progress >= 100 ? 'Target achieved! Consider increasing your target.' :
                    progress >= 50 ? 'Over halfway there! Keep going!' :
                    'Building your safety net steadily.'}
                 </p>
               </div>
          </CardContent>
        </Card>

        {/* Financial Health Score */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#4ADE80]" />
              Financial Health Score
            </CardTitle>
          </CardHeader>
          <CardContent className="py-8">
            <div className="space-y-6">
              <div className="p-5 rounded-lg bg-black/10">
                <div className="flex justify-between items-center mb-2">
                  <span>Emergency Fund Status</span>
                  <span className="font-semibold text-[#4ADE80]">{progress >= 100 ? 'Excellent' : progress >= 50 ? 'Good' : 'Building'}</span>
                </div>
                <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-[#4ADE80]" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
              </div>
              
              <div className="p-5 rounded-lg bg-black/10">
                <div className="flex justify-between items-center mb-2">
                  <span>Monthly Contributions</span>
                  <span className="font-semibold text-[#4ADE80]">{monthlyAdditions > 0 ? 'Active' : 'No deposits yet'}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {monthlyAdditions > 0 ? `Added ₹${monthlyAdditions} this month` : 'Start your monthly deposits'}
                </div>
              </div>
              
              <div className="p-5 rounded-lg bg-black/10">
                <div className="flex justify-between items-center mb-2">
                  <span>Withdrawal Frequency</span>
                  <span className="font-semibold text-[#4ADE80]">Low</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Maintaining healthy emergency fund levels
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievement Milestones */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#4ADE80]" />
              Fund Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="py-8">
            <div className="space-y-6">
              {/* Basic Safety Net */}
              <div className={`p-5 rounded-lg ${progress >= 25 ? 'bg-[#4ADE80]/10' : 'bg-black/10'} transition-all duration-300 hover:scale-[1.02] cursor-pointer`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center ${progress >= 25 ? 'bg-[#4ADE80]/20 text-[#4ADE80]' : 'bg-black/20'}`}>
                    {progress >= 25 ? '✓' : <ShieldAlert className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-lg">Basic Safety Net</p>
                        <p className="text-sm text-muted-foreground mt-1">One Month's Expenses</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${progress >= 25 ? 'text-[#4ADE80]' : 'text-muted-foreground'}`}>
                          ₹{(emergencyFund.target * 0.25).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Target</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-[#4ADE80] transition-all duration-500" 
                             style={{ width: `${Math.min(100, (progress/25)*100)}%` }} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {progress >= 25 
                          ? '🎉 Achieved! You can now handle basic emergencies.' 
                          : `₹${((0.25 * emergencyFund.target) - emergencyFund.current).toFixed(0)} more needed for basic safety`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Stable Foundation */}
              <div className={`p-5 rounded-lg ${progress >= 50 ? 'bg-[#4ADE80]/10' : 'bg-black/10'} transition-all duration-300 hover:scale-[1.02] cursor-pointer`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center ${progress >= 50 ? 'bg-[#4ADE80]/20 text-[#4ADE80]' : 'bg-black/20'}`}>
                    {progress >= 50 ? '✓' : <PiggyBank className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-lg">Stable Foundation</p>
                        <p className="text-sm text-muted-foreground mt-1">Three Months' Coverage</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${progress >= 50 ? 'text-[#4ADE80]' : 'text-muted-foreground'}`}>
                          ₹{(emergencyFund.target * 0.5).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Target</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-[#4ADE80] transition-all duration-500" 
                             style={{ width: `${Math.min(100, (progress/50)*100)}%` }} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {progress >= 50 
                          ? '💪 Great work! You have a solid financial foundation.' 
                          : `₹${((0.5 * emergencyFund.target) - emergencyFund.current).toFixed(0)} more for increased stability`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Financial Freedom */}
              <div className={`p-5 rounded-lg ${progress >= 100 ? 'bg-[#4ADE80]/10' : 'bg-black/10'} transition-all duration-300 hover:scale-[1.02] cursor-pointer`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center ${progress >= 100 ? 'bg-[#4ADE80]/20 text-[#4ADE80]' : 'bg-black/20'}`}>
                    {progress >= 100 ? '✓' : <Goal className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-lg">Financial Freedom</p>
                        <p className="text-sm text-muted-foreground mt-1">Six Months Secured</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${progress >= 100 ? 'text-[#4ADE80]' : 'text-muted-foreground'}`}>
                          ₹{emergencyFund.target.toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Target</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-[#4ADE80] transition-all duration-500" 
                             style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {progress >= 100 
                          ? '🌟 Maximum security achieved! Consider increasing your target.' 
                          : `₹${(emergencyFund.target - emergencyFund.current).toFixed(0)} away from total freedom`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History - Now Full Width */}
        <Card className="md:col-span-2 xl:col-span-3">
          <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Transaction History
              </CardTitle>
              <CardDescription>A log of all deposits and withdrawals from your fund.</CardDescription>
          </CardHeader>
          <CardContent>
               <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                  {sortedHistory && sortedHistory.length > 0 ? (
                      sortedHistory.map((entry) => (
                      <div key={entry.id} className="flex justify-between items-center rounded-md border p-4">
                          <div className="flex items-center gap-4">
                               {entry.type === 'deposit' ? <TrendingUp className="h-6 w-6 text-green-500" /> : <TrendingDown className="h-6 w-6 text-destructive" />}
                              <div>
                                  <p className={`font-semibold ${entry.type === 'deposit' ? 'text-green-500' : 'text-destructive'}`}>
                                      {entry.type === 'deposit' ? '+' : '-'} ₹{entry.amount.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                      {format(new Date(entry.date), 'PPP p')}
                                  </p>
                                   {entry.notes && <p className="text-sm mt-1">"{entry.notes}"</p>}
                              </div>
                          </div>
                          <div className={`text-sm font-semibold capitalize px-3 py-1 rounded-full ${entry.type === 'deposit' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                              {entry.type}
                          </div>
                      </div>
                      ))
                  ) : (
                      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
                          <PiggyBank className="h-12 w-12 text-muted-foreground" />
                          <h2 className="mt-4 text-xl font-semibold">No History Yet</h2>
                          <p className="mt-2 text-sm text-muted-foreground">
                          Make your first deposit to start building your safety net.
                          </p>
                      </div>
                  )}
                  </div>
              </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
