
"use client";

import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApp } from '@/hooks/use-app';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Trash, CalendarIcon, ShieldAlert, Mail, RefreshCw, Loader2 } from 'lucide-react';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { expenseCategories } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const fixedExpenseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Expense name is required'),
  amount: z.coerce.number().min(0, 'Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  timelineMonths: z.coerce.number().optional().nullable(),
  startDate: z.string().optional(),
});

const profileSchema = z.object({
  role: z.enum(['Student', 'Professional', 'Housewife']),
  income: z.coerce.number().min(0, 'Income cannot be negative'),
  fixedExpenses: z.array(fixedExpenseSchema).optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;


export default function SettingsPage() {
  const { profile, updateProfile, deleteAccount, user, importTransactions } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [gmailStatus, setGmailStatus] = React.useState<{
    connected: boolean;
    connectedEmail: string | null;
    lastSyncedAt: string | null;
    scopes?: string[] | null;
  } | null>(null);
  const [isGmailLoading, setIsGmailLoading] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  const readJson = async (res: Response) => {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Non-JSON response (${res.status}). ${text.slice(0, 120)}`);
    }
    return res.json();
  };

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      role: profile?.role || 'Professional',
      income: profile?.income || 0,
      fixedExpenses: profile?.fixedExpenses || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fixedExpenses",
  });

  React.useEffect(() => {
    if (profile) {
            // Map role to allowed enum values; if it's empty/unknown, default to undefined
            const mappedRole = ['Student', 'Professional', 'Housewife'].includes(profile.role as string)
                ? (profile.role as 'Student' | 'Professional' | 'Housewife')
                : undefined;

            form.reset({
                role: mappedRole,
                income: profile.income,
                fixedExpenses: profile.fixedExpenses.map(exp => ({...exp, timelineMonths: exp.timelineMonths || null })),
            });
    }
  }, [profile, form]);

  const loadGmailStatus = React.useCallback(async () => {
    if (!user) return;
    setIsGmailLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/gmail/status', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to load Gmail status');
      setGmailStatus({
        connected: !!data.connected,
        connectedEmail: data.connectedEmail ?? null,
        lastSyncedAt: data.lastSyncedAt ?? null,
        scopes: data.scopes ?? null,
      });
    } catch (e: any) {
      console.error(e);
      setGmailStatus(null);
    } finally {
      setIsGmailLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    const gmail = searchParams.get('gmail');
    const msg = searchParams.get('msg');
    if (gmail === 'connected') {
      toast({ title: 'Gmail connected', description: 'You can now sync GPay/Paytm emails into transactions.' });
      router.replace('/settings');
    } else if (gmail === 'error') {
      toast({
        variant: 'destructive',
        title: 'Gmail connection failed',
        description: msg ? decodeURIComponent(msg) : 'Please try again.',
      });
      router.replace('/settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    loadGmailStatus();
  }, [loadGmailStatus]);

  const handleConnectGmail = async () => {
    if (!user) return;
    setIsGmailLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/gmail/auth-url', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to start Gmail auth');
      window.location.href = data.url;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message || 'Failed to connect Gmail' });
      setIsGmailLoading(false);
    }
  };

  const handleSyncGmail = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxMessages: 50 }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || 'Sync failed');

      const imported = (data.transactions || []) as any[];
      importTransactions(
        imported.map((t) => ({
          id: t.id,
          amount: t.amount,
          category: t.category,
          description: t.description,
          date: t.date,
          importSource: t.importSource,
          importMessageId: t.importMessageId,
          importRef: t.importRef,
        }))
      );
      await loadGmailStatus();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Sync failed', description: e?.message || 'Could not sync Gmail' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!user) return;
    setIsDisconnecting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/gmail/disconnect', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || 'Disconnect failed');
      toast({ title: 'Gmail disconnected', description: 'You can reconnect to grant the correct scopes.' });
      await loadGmailStatus();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Disconnect failed', description: e?.message || 'Could not disconnect Gmail' });
    } finally {
      setIsDisconnecting(false);
    }
  };

  function onSubmit(data: ProfileValues) {
    updateProfile(data as any);
    toast({
        title: "Profile Updated",
        description: "Your financial details have been successfully updated.",
    })
    router.push('/dashboard');
  }

  return (
    <div className="space-y-6">
        <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
            <CardTitle className="text-2xl font-headline">Profile Settings</CardTitle>
            <CardDescription>Update your personal and financial information here. Your budget is calculated based on your disposable income.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>What's your current role?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                </div>
                
                <div>
                <Label className="text-lg font-medium">Fixed Monthly Expenses</Label>
                <p className="text-sm text-muted-foreground mb-4">Update your recurring expenses like rent, EMIs, or subscriptions.</p>
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
                                <Input placeholder="Expense Name" {...field} />
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
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Amount (₹)" {...field} />
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
                                <FormLabel>Timeline</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="Months (Opt)" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
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
                    onClick={() => append({ id: `new-${Date.now()}`, name: '', amount: 0, category: 'Other', timelineMonths: null, startDate: undefined })}
                    >
                    Add Expense
                    </Button>
                </div>

                <Button type="submit" className="w-full" size="lg">Save Changes</Button>
            </form>
            </Form>
        </CardContent>
        </Card>

        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gmail Import (GPay / Paytm)
            </CardTitle>
            <CardDescription>
              Connect your Gmail to automatically fetch payment confirmation emails and import them as transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-semibold">
                  Status:{' '}
                  {isGmailLoading ? 'Loading…' : gmailStatus?.connected ? 'Connected' : 'Not connected'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {gmailStatus?.connectedEmail ? `Connected email: ${gmailStatus.connectedEmail}` : 'No Gmail account linked yet.'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {gmailStatus?.lastSyncedAt ? `Last sync: ${new Date(gmailStatus.lastSyncedAt).toLocaleString()}` : 'Last sync: —'}
                </p>
                {!!gmailStatus?.scopes?.length && (
                  <p className="text-xs text-muted-foreground">
                    Scopes: {gmailStatus.scopes.join(' ')}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleConnectGmail} disabled={isGmailLoading || !user} variant="secondary">
                  {isGmailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  <span className="ml-2">Connect Gmail</span>
                </Button>
                <Button onClick={handleSyncGmail} disabled={isSyncing || !gmailStatus?.connected || !user}>
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2">Sync now</span>
                </Button>
                {gmailStatus?.connected && (
                  <Button onClick={handleDisconnectGmail} disabled={isDisconnecting || !user} variant="outline">
                    {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-semibold">×</span>}
                    <span className="ml-2">Disconnect</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full max-w-4xl mx-auto border-destructive">
            <CardHeader>
                <CardTitle className="font-headline text-destructive flex items-center gap-2">
                    <ShieldAlert />
                    Danger Zone
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-semibold">Delete Account</p>
                        <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data. This action cannot be undone.</p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete My Account</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your account and remove all of your data from our servers.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={deleteAccount}>Yes, Delete My Account</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
