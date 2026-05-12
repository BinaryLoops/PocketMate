
export type UserRole = 'Student' | 'Professional' | 'Housewife' | '';

export interface UserProfile {
  name?: string;
  role: UserRole;
  income: number;
  fixedExpenses: FixedExpense[];
  dailySpendingLimit: number;
  monthlyNeeds: number;
  monthlyWants: number;
  monthlySavings: number;
  emergencyFund: {
    target: number;
    current: number;
    history: EmergencyFundEntry[];
  };
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  timelineMonths?: number;
  startDate?: string; // Should be an ISO string
}

export interface Contribution {
    amount: number;
    date: string; // ISO string
}

export interface Goal {
  id:string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  timelineMonths: number;
  startDate?: string;
  contributions: Contribution[];
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO string for simplicity
  /** Optional metadata for imported transactions (Gmail/bank statements/etc.). */
  importSource?: string;
  importMessageId?: string;
  importRef?: string;
}

export const expenseCategories = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Shopping',
  'Entertainment',
  'Utilities',
  'Rent/EMI',
  'Healthcare',
  'Education',
  'Other',
];

// Represents a record of which month a payment was logged for a specific expense.
// e.g., { "expense-id-123": ["2024-01", "2024-02"] }
export type LoggedPayments = Record<string, string[]>;

export interface EmergencyFundEntry {
    id: string;
    amount: number;
    date: string; // ISO string
    type: 'deposit' | 'withdrawal';
    notes?: string;
}
    
