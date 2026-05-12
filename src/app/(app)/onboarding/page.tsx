
"use client";

import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApp } from '@/hooks/use-app';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Trash, Wallet, PiggyBank, ShoppingCart, ShieldAlert } from 'lucide-react';
import React from 'react';
import MicRecorder from '@/components/mic-recorder';
import { expenseCategories } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const fixedExpenseSchema = z.object({
  name: z.string().min(1, 'Expense name is required'),
  amount: z.coerce.number().min(0, 'Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  timelineMonths: z.coerce.number().optional().nullable(),
  startDate: z.string().optional(),
});

const onboardingSchema = z.object({
  role: z.enum(['Student', 'Professional', 'Housewife']),
  income: z.coerce.number().min(0, 'Income cannot be negative'),
  fixedExpenses: z.array(fixedExpenseSchema).optional(),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

function SummaryCard({ title, amount, icon, description }: { title: string; amount: number; icon: React.ReactNode; description: string; }) {
    return (
        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <div className="flex items-center gap-3">
                {icon}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </div>
            </div>
            <div className="text-sm font-bold">₹{amount.toFixed(2)}</div>
        </div>
    )
}

export default function OnboardingPage() {
  const { updateProfile } = useApp();
  const router = useRouter();
  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      income: 0,
      fixedExpenses: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fixedExpenses",
  });
  
  const watchedIncome = form.watch('income');
  const watchedFixedExpenses = form.watch('fixedExpenses');

  const { monthlyNeeds, monthlyWants, monthlySavings, dailyLimit } = React.useMemo(() => {
    const income = Number(watchedIncome) || 0;
    const fixedExpenses = watchedFixedExpenses || [];
    
    const needs = fixedExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const disposableIncome = income - needs;
    
    const wants = disposableIncome * 0.6;
    const savings = disposableIncome * 0.4;
    const daily = wants > 0 ? wants / 30 : 0;

    return { monthlyNeeds: needs, monthlyWants: wants, monthlySavings: savings, dailyLimit: daily };
  }, [watchedIncome, watchedFixedExpenses]);


  function onSubmit(data: OnboardingValues) {
    const fixedExpensesWithIds = (data.fixedExpenses || []).map(exp => ({
      id: (exp as any).id ?? `fe-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      ...(exp as any),
    }));

    const profileData = {
        ...data,
        fixedExpenses: fixedExpensesWithIds,
        emergencyFund: {
            target: 0,
            current: 0,
            history: [],
        }
    } as const;

    // Ensure the shape matches the expected Partial<UserProfile>
    updateProfile(profileData as any);
    router.push('/dashboard');
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to PocketMate!</CardTitle>
          <CardDescription>Let's set up your financial profile to tailor your experience.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                  control={form.control}
                  name="income"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Income (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What's your current role?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Student">Student</SelectItem>
                          <SelectItem value="Professional">Professional</SelectItem>
                          <SelectItem value="Housewife">Housewife</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <Label className="text-lg font-medium">Fixed Monthly Expenses</Label>
                <p className="text-sm text-muted-foreground mb-4">Enter expenses like rent, EMIs, or subscriptions. This helps us calculate your 'Needs'.</p>
                <div className="space-y-4">
                  {fields.map((field, index) => {
                     const timelineMonths = form.watch(`fixedExpenses.${index}.timelineMonths`);
                    return (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,1fr,auto] items-end gap-4 p-4 border rounded-lg">
                      <FormField
                        control={form.control}
                        name={`fixedExpenses.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expense Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Rent" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name={`fixedExpenses.${index}.category`}
                        render={({ field }) => (
                            <FormItem>
                               <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {expenseCategories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                      <FormField
                        control={form.control}
                        name={`fixedExpenses.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount (₹)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="Amount" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`fixedExpenses.${index}.timelineMonths`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Timeline (Months)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Optional" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                      
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                        <Trash className="h-4 w-4" />
                      </Button>

                      {!!timelineMonths && (
                        <FormField
                            control={form.control}
                            name={`fixedExpenses.${index}.startDate`}
                            render={({ field }) => (
                            <FormItem className="flex flex-col mt-2 md:col-span-2">
                                <FormLabel>Start Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? (
                                                format(new Date(field.value), "PPP")
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                        mode="single"
                                        selected={field.value ? new Date(field.value) : undefined}
                                        onSelect={(date) => field.onChange(date?.toISOString())}
                                        initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      )}
                    </div>
                  )})}
                </div>
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => append({ name: '', amount: 0, category: 'Other', timelineMonths: null, startDate: undefined })}
                  >
                    Add Expense
                  </Button>
              </div>
              
              <Card className="bg-secondary/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Your Financial Breakdown</CardTitle>
                    <CardDescription>Based on your disposable income (Income - Needs), we suggest a 60% (Wants) and 40% (Savings) split.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <SummaryCard title="Needs" amount={monthlyNeeds} icon={<Wallet className="h-5 w-5 text-primary" />} description="Your total fixed costs." />
                    <SummaryCard title="Wants" amount={monthlyWants} icon={<ShoppingCart className="h-5 w-5 text-accent" />} description="For discretionary spending." />
                    <SummaryCard title="Savings" amount={monthlySavings} icon={<PiggyBank className="h-5 w-5 text-green-500" />} description="For goals & emergencies." />
                     <Alert>
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Emergency Fund</AlertTitle>
                        <AlertDescription>
                        You can set a target and contribute to your emergency fund from the dedicated 'Emergency Fund' page after setup.
                        </AlertDescription>
                    </Alert>
                  </CardContent>
                   <CardFooter>
                     <div className="w-full flex justify-between items-center p-3 rounded-lg bg-primary/10">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">Suggested Daily Spending</span>
                            <span className="text-xs text-muted-foreground">This is your 'Wants' budget per day.</span>
                        </div>
                        <div className="text-xl font-bold text-primary">₹{dailyLimit.toFixed(2)}</div>
                     </div>
                  </CardFooter>
              </Card>

              <Button type="submit" className="w-full" size="lg">Complete Setup</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
