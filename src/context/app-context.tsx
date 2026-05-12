
"use client";

import React, { createContext, useState, ReactNode, useEffect } from 'react';
import type { UserProfile, Goal, Transaction, FixedExpense, LoggedPayments, Contribution, EmergencyFundEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // use named auth export from firebase lib
import { useRouter } from 'next/navigation';
import { format, formatISO, startOfDay, parseISO } from 'date-fns';
import { FirestoreService } from '@/lib/firestore';

interface AppContextType {
  user: User | null | undefined;
  authLoaded: boolean;
  profile: UserProfile | null | undefined; // Allow undefined for initial loading state
  goals: Goal[];
  transactions: Transaction[];
  onboardingComplete: boolean;
  updateProfile: (profile: Partial<Omit<UserProfile, 'monthlyNeeds' | 'monthlyWants' | 'monthlySavings' | 'dailySpendingLimit'>>) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'currentAmount' | 'contributions'>) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
  importTransactions: (transactions: Transaction[]) => void;
  updateGoal: (goalId: string, updatedGoal: Partial<Omit<Goal, 'id'>>) => void;
  getTodaysSpending: () => number;
  logout: () => void;
  deleteAccount: () => void;
  updateTransaction: (transactionId: string, updatedTransaction: Partial<Omit<Transaction, 'id' | 'date'>>) => void;
  deleteTransaction: (transactionId: string) => void;
  getTotalGoalContributions: () => number;
  contributeToGoal: (goalId: string, amount: number) => void;
  getCumulativeDailySavings: () => number;
  toggleFixedExpenseLoggedStatus: (expenseId: string) => void;
  isFixedExpenseLoggedForCurrentMonth: (expenseId: string) => boolean;
  getLoggedPaymentCount: (expenseId: string) => number;
  updateEmergencyFund: (action: 'deposit' | 'withdraw', amount: number, notes?: string) => void;
  setEmergencyFundTarget: (target: number) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const KART_I_QUO_PREFIX = 'kart-i-quo-';
const PROFILE_KEY = `${KART_I_QUO_PREFIX}profile`;
const GOALS_KEY = `${KART_I_QUO_PREFIX}goals`;
const TRANSACTIONS_KEY = `${KART_I_QUO_PREFIX}transactions`;
const LOGGED_PAYMENTS_KEY = `${KART_I_QUO_PREFIX}logged-payments`;

const calculateBudget = (income: number, fixedExpenses: { amount: number }[]): Pick<UserProfile, 'monthlyNeeds' | 'monthlyWants' | 'monthlySavings' | 'dailySpendingLimit'> => {
    const needs = fixedExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const disposableIncome = income - needs;
    
    const wants = disposableIncome * 0.6;
    const savings = disposableIncome * 0.4;
    const daily = wants > 0 ? wants / 30 : 0;

    return {
        monthlyNeeds: needs,
        monthlyWants: wants,
        monthlySavings: savings,
        dailySpendingLimit: daily,
    };
};


export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined); // Start as undefined
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loggedPayments, setLoggedPayments] = useState<LoggedPayments>({});
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
            // User is signed in, load their data
             try {
                const storedProfile = localStorage.getItem(PROFILE_KEY);
                if (storedProfile) {
                    let parsedProfile: UserProfile = JSON.parse(storedProfile);
                    const budget = calculateBudget(parsedProfile.income, parsedProfile.fixedExpenses);
                    const updatedProfile = { 
                        ...parsedProfile, 
                        emergencyFund: parsedProfile.emergencyFund || { target: 0, current: 0, history: [] },
                        ...budget 
                    };
                    setProfile(updatedProfile);
                    setOnboardingComplete(!!updatedProfile.role);
                } else {
                    setProfile(null); // Explicitly set to null if no profile exists
                }

                const storedGoals = localStorage.getItem(GOALS_KEY);
                setGoals(storedGoals ? JSON.parse(storedGoals) : []);
                const storedTransactions = localStorage.getItem(TRANSACTIONS_KEY);
                setTransactions(storedTransactions ? JSON.parse(storedTransactions) : []);
                const storedLoggedPayments = localStorage.getItem(LOGGED_PAYMENTS_KEY);
                setLoggedPayments(storedLoggedPayments ? JSON.parse(storedLoggedPayments) : {});

            } catch (error) {
                console.error("Failed to load data from localStorage", error);
                setProfile(null);
            }
        } else {
            // User is signed out, clear data
            setProfile(null);
            setGoals([]);
            setTransactions([]);
            setLoggedPayments({});
            setOnboardingComplete(false);
        }
    // Mark that auth state has been determined at least once
    setAuthLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const persistState = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to persist ${key} to localStorage`, error);
    }
  };

  const updateProfile = (newProfileData: Partial<Omit<UserProfile, 'monthlyNeeds' | 'monthlyWants' | 'monthlySavings' | 'dailySpendingLimit'>>) => {
    const income = newProfileData.income ?? profile?.income ?? 0;
    const fixedExpenses = newProfileData.fixedExpenses?.map(exp => ({
        ...exp,
        id: exp.id || Math.random().toString(),
        startDate: (exp.timelineMonths && !exp.startDate) ? formatISO(new Date()) : exp.startDate
    })) ?? profile?.fixedExpenses ?? [];
    
    const budget = calculateBudget(income, fixedExpenses);

    const updatedProfile: UserProfile = { 
        ...profile, 
        ...newProfileData,
        fixedExpenses,
        ...budget,
        emergencyFund: profile?.emergencyFund || { target: 0, current: 0, history: [] }
    } as UserProfile;
    
    setProfile(updatedProfile);
    setOnboardingComplete(true);
    persistState(PROFILE_KEY, updatedProfile);

    // Also persist profile to Firestore for DBMS / cloud storage
    if (user?.uid) {
      FirestoreService.saveProfile(user.uid, updatedProfile).catch((error) => {
        console.error('Failed to save profile to Firestore', error);
      });
    }
  };

  const addGoal = (goalData: Omit<Goal, 'id' | 'currentAmount' | 'contributions'>) => {
    const newGoal: Goal = {
      ...goalData,
      id: Date.now().toString(),
      currentAmount: 0,
      startDate: goalData.timelineMonths ? formatISO(new Date()) : undefined,
      contributions: [],
    };
    const newGoals = [...goals, newGoal];
    setGoals(newGoals);
    persistState(GOALS_KEY, newGoals);

    // Persist goal to Firestore
    if (user?.uid) {
      FirestoreService.saveGoal(user.uid, newGoal).catch((error: unknown) => {
        console.error('Failed to save goal to Firestore', error);
      });
    }
    toast({
      title: 'Goal Added!',
      description: `You're now saving for "${newGoal.name}".`,
    });
  };

  const addTransaction = (transactionData: Omit<Transaction, 'id' | 'date'>) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: Date.now().toString(),
      date: new Date().toISOString(),
    };
    const newTransactions = [newTransaction, ...transactions];
    setTransactions(newTransactions);
    persistState(TRANSACTIONS_KEY, newTransactions);

    // Persist transaction to Firestore
    if (user?.uid) {
      FirestoreService.saveTransaction(user.uid, newTransaction).catch((error) => {
        console.error('Failed to save transaction to Firestore', error);
      });
    }
  };

  const importTransactions = (incoming: Transaction[]) => {
    if (!incoming.length) return;

    const normalizeDesc = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .slice(0, 80);

    const roundTo5MinIso = (iso: string) => {
      const ms = Date.parse(iso);
      if (!Number.isFinite(ms)) return 'invalid';
      const rounded = Math.floor(ms / (5 * 60 * 1000)) * (5 * 60 * 1000);
      return new Date(rounded).toISOString();
    };

    const amtKey = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : 'NaN');

    const fingerprint = (t: Transaction) => {
      const ref = (t.importRef || '').trim();
      if (ref) return `ref:${ref}|amt:${amtKey(t.amount)}`;
      return `t:${roundTo5MinIso(t.date)}|amt:${amtKey(t.amount)}|d:${normalizeDesc(t.description)}`;
    };

    const existingById = new Map(transactions.map((t) => [t.id, t]));
    const existingFingerprints = new Set(transactions.map(fingerprint));

    const accepted: Transaction[] = [];
    for (const tx of incoming) {
      if (!tx?.id) continue;

      // Primary: same id means same transaction
      if (existingById.has(tx.id)) {
        existingById.set(tx.id, { ...existingById.get(tx.id)!, ...tx });
        continue;
      }

      // Secondary: detect duplicates by robust fingerprint
      const fp = fingerprint(tx);
      if (existingFingerprints.has(fp)) continue;

      existingFingerprints.add(fp);
      existingById.set(tx.id, tx);
      accepted.push(tx);
    }

    const merged = Array.from(existingById.values()).sort((a, b) => {
      const ad = Date.parse(a.date);
      const bd = Date.parse(b.date);
      return (Number.isFinite(bd) ? bd : 0) - (Number.isFinite(ad) ? ad : 0);
    });

    setTransactions(merged);
    persistState(TRANSACTIONS_KEY, merged);

    if (user?.uid) {
      // Best-effort sync; Firestore keys are userId_txId already in FirestoreService.saveTransaction
      Promise.all(
        accepted
          .filter((t) => t?.id && Number.isFinite(t.amount))
          .map((t) => FirestoreService.saveTransaction(user.uid, t).catch((e) => e))
      ).catch(() => {});
    }

    toast({
      title: 'Transactions Imported',
      description: `Imported ${accepted.length} new transaction(s).`,
    });
  };

  const updateGoal = (goalId: string, updatedData: Partial<Omit<Goal, 'id'>>) => {
    const newGoals = goals.map(g => 
        g.id === goalId ? { ...g, ...updatedData, startDate: (g.timelineMonths && !g.startDate) ? formatISO(new Date()) : g.startDate } : g
    );
    setGoals(newGoals);
    persistState(GOALS_KEY, newGoals);

    // Also update in Firestore
    if (user?.uid) {
      const updatedGoal = newGoals.find(g => g.id === goalId);
      if (updatedGoal) {
        FirestoreService.saveGoal(user.uid, updatedGoal).catch((error: unknown) => {
          console.error('Failed to update goal in Firestore', error);
        });
      }
    }
    toast({
        title: 'Goal Updated',
        description: 'Your goal has been successfully updated.',
    });
  };
  
  const updateTransaction = (transactionId: string, updatedData: Partial<Omit<Transaction, 'id' | 'date'>>) => {
    const newTransactions = transactions.map(t =>
      t.id === transactionId ? { ...t, ...updatedData } : t
    );
    setTransactions(newTransactions);
    persistState(TRANSACTIONS_KEY, newTransactions);

    // Also update in Firestore
    if (user?.uid) {
      const updatedTx = newTransactions.find(t => t.id === transactionId);
      if (updatedTx) {
        FirestoreService.saveTransaction(user.uid, updatedTx).catch((error) => {
          console.error('Failed to update transaction in Firestore', error);
        });
      }
    }
    toast({
        title: 'Transaction Updated',
        description: 'Your expense has been successfully updated.',
    });
  };

  const deleteTransaction = (transactionId: string) => {
    const newTransactions = transactions.filter(t => t.id !== transactionId);
    setTransactions(newTransactions);
    persistState(TRANSACTIONS_KEY, newTransactions);

    // Also delete from Firestore
    if (user?.uid) {
      FirestoreService.deleteTransaction(user.uid, transactionId).catch((error) => {
        console.error('Failed to delete transaction from Firestore', error);
      });
    }
    toast({
        title: 'Transaction Deleted',
        description: 'Your expense has been removed.',
    });
  };

  const getTodaysSpending = () => {
    const today = new Date().toISOString().split('T')[0];
    return transactions
      .filter(t => t.date.startsWith(today))
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getTotalGoalContributions = () => {
    return goals.reduce((sum, g) => sum + g.monthlyContribution, 0);
  }

  const getCumulativeDailySavings = () => {
    if (!profile || transactions.length === 0) {
      return 0;
    }

    const spendingByDay = transactions
      .reduce((acc, t) => {
        const day = startOfDay(parseISO(t.date)).toISOString();
        if (!acc[day]) {
          acc[day] = 0;
        }
        acc[day] += t.amount;
        return acc;
      }, {} as { [key: string]: number });
    
    const today = startOfDay(new Date()).toISOString();

    let cumulativeSavings = 0;
    for (const day in spendingByDay) {
      if (day !== today) {
        const spending = spendingByDay[day];
        const saving = profile.dailySpendingLimit - spending;
        if (saving > 0) {
            cumulativeSavings += saving;
        }
      }
    }

    return cumulativeSavings;
  };

  const contributeToGoal = (goalId: string, amount: number) => {
    const newContribution: Contribution = {
        amount,
        date: new Date().toISOString(),
    };

    const newGoals = goals.map(goal => {
      if (goal.id === goalId) {
        const newCurrentAmount = goal.currentAmount + amount;
        return { 
            ...goal, 
            currentAmount: newCurrentAmount > goal.targetAmount ? goal.targetAmount : newCurrentAmount,
            contributions: [newContribution, ...(goal.contributions || [])],
         };
      }
      return goal;
    });
    setGoals(newGoals);
    persistState(GOALS_KEY, newGoals);
    toast({
      title: 'Contribution Successful!',
      description: `You've added ₹${amount.toFixed(2)} to your goal.`,
    });
  };

  const isFixedExpenseLoggedForCurrentMonth = (expenseId: string) => {
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    return loggedPayments[expenseId]?.includes(currentMonthKey) || false;
  };
  
  const getLoggedPaymentCount = (expenseId: string) => {
    return loggedPayments[expenseId]?.length || 0;
  };

  const toggleFixedExpenseLoggedStatus = (expenseId: string) => {
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const existingLogs = loggedPayments[expenseId] || [];
    const isLogged = existingLogs.includes(currentMonthKey);
    
    let newLogs;
    if (isLogged) {
      newLogs = existingLogs.filter(month => month !== currentMonthKey);
      toast({ title: 'Expense marked as unpaid.' });
    } else {
      newLogs = [...existingLogs, currentMonthKey];
      toast({ title: 'Expense marked as paid.' });
    }

    const updatedLoggedPayments = {
      ...loggedPayments,
      [expenseId]: newLogs,
    };
    
    setLoggedPayments(updatedLoggedPayments);
    persistState(LOGGED_PAYMENTS_KEY, updatedLoggedPayments);
  };

  const updateEmergencyFund = (action: 'deposit' | 'withdraw', amount: number, notes?: string) => {
    if (!profile) return;

    const newEntry: EmergencyFundEntry = {
        id: Date.now().toString(),
        amount,
        date: new Date().toISOString(),
        type: action === 'deposit' ? 'deposit' : 'withdrawal',
        notes,
    };

    const newCurrent = action === 'deposit' 
        ? profile.emergencyFund.current + amount 
        : profile.emergencyFund.current - amount;

    const updatedProfile: UserProfile = {
        ...profile,
        emergencyFund: {
            ...profile.emergencyFund,
            current: newCurrent < 0 ? 0 : newCurrent,
            history: [newEntry, ...profile.emergencyFund.history],
        },
    };

    setProfile(updatedProfile);
    persistState(PROFILE_KEY, updatedProfile);
    toast({
        title: `Fund ${action === 'deposit' ? 'Added' : 'Withdrawn'}`,
        description: `₹${amount.toFixed(2)} has been ${action === 'deposit' ? 'added to' : 'withdrawn from'} your emergency fund.`,
    });
  };

  const setEmergencyFundTarget = (target: number) => {
    if (!profile) return;
    const updatedProfile: UserProfile = {
        ...profile,
        emergencyFund: {
            ...profile.emergencyFund,
            target,
        },
    };
    setProfile(updatedProfile);
    persistState(PROFILE_KEY, updatedProfile);
     toast({
        title: `Target Updated`,
        description: `Your new emergency fund target is ₹${target.toFixed(2)}.`,
    });
  };


  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
       console.error("Logout failed", error);
       toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred while logging out. Please try again.",
       })
    }
  };

  const deleteAccount = async () => {
    try {
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem(GOALS_KEY);
        localStorage.removeItem(TRANSACTIONS_KEY);
        localStorage.removeItem(LOGGED_PAYMENTS_KEY);

        if (auth.currentUser) {
          await signOut(auth);
        }

        toast({
            title: "Account Deleted",
            description: "Your account and all data have been successfully deleted.",
        });

        router.push('/signup');
    } catch (error) {
        console.error("Account deletion failed", error);
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "An error occurred while deleting your account. Please try again.",
        });
    }
  };

  const value: AppContextType = {
    user,
    authLoaded,
    profile,
    goals,
    transactions,
    onboardingComplete,
    updateProfile,
    addGoal,
    addTransaction,
    importTransactions,
    updateGoal,
    getTodaysSpending,
    logout,
    deleteAccount,
    updateTransaction,
    deleteTransaction,
    getTotalGoalContributions,
    contributeToGoal,
    getCumulativeDailySavings,
    toggleFixedExpenseLoggedStatus,
    isFixedExpenseLoggedForCurrentMonth,
    getLoggedPaymentCount,
    updateEmergencyFund,
    setEmergencyFundTarget,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
