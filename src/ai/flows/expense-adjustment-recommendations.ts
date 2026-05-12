
'use server';
/**
 * @fileOverview AI-powered expense adjustment recommendations flow.
 *
 * - getExpenseAdjustmentRecommendations - A function that provides recommendations on how to adjust expenses to meet financial goals.
 * - ExpenseAdjustmentRecommendationsInput - The input type for the getExpenseAdjustmentRecommendations function.
 * - ExpenseAdjustmentRecommendationsOutput - The return type for the getExpenseAdjustmentRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExpenseAdjustmentRecommendationsInputSchema = z.object({
  income: z.number().describe('The user’s total monthly income in Indian Rupees.'),
  fixedExpenses: z.array(
    z.object({
      name: z.string().describe('The name of the fixed expense.'),
      amount: z.number().describe('The amount of the fixed expense in Indian Rupees.'),
    })
  ).describe('A list of the user’s fixed monthly expenses.'),
  goals: z.array(
    z.object({
      name: z.string().describe('The name of the financial goal.'),
      target: z.number().describe('The target amount for the financial goal in Indian Rupees.'),
      timelineMonths: z.number().optional().describe('The timeline for the financial goal in months.'),
    })
  ).describe('A list of the user’s financial goals.'),
  currentExpenses: z.array(
    z.object({
      name: z.string().describe('The name of the expense.'),
      amount: z.number().describe('The amount spent on the expense in Indian Rupees.'),
    })
  ).describe('A list of the user’s current expenses.'),
  discretionarySpendingLimit: z.number().describe('The user’s daily discretionary spending limit.'),
});

export type ExpenseAdjustmentRecommendationsInput = z.infer<
  typeof ExpenseAdjustmentRecommendationsInputSchema
>;

const ExpenseAdjustmentRecommendationsOutputSchema = z.object({
  recommendations: z
    .array(z.string())
    .describe('A list of recommendations on how to adjust expenses to meet financial goals.'),
});

export type ExpenseAdjustmentRecommendationsOutput = z.infer<
  typeof ExpenseAdjustmentRecommendationsOutputSchema
>;

export async function getExpenseAdjustmentRecommendations(
  input: ExpenseAdjustmentRecommendationsInput
): Promise<ExpenseAdjustmentRecommendationsOutput> {
  return expenseAdjustmentRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'expenseAdjustmentRecommendationsPrompt',
  input: {schema: ExpenseAdjustmentRecommendationsInputSchema},
  output: {schema: ExpenseAdjustmentRecommendationsOutputSchema},
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are a personal finance advisor. Your task is to provide a list of specific and actionable tips to help a user adjust their spending to meet their financial goals.

## User's Financial Profile:
- **Monthly Income:** ₹{{income}}
- **Fixed Expenses:**
{{#each fixedExpenses}}
  - {{name}}: ₹{{amount}}
{{/each}}
- **Financial Goals:**
{{#each goals}}
  - Save for '{{name}}' (Target: ₹{{target}} within {{timelineMonths}} months)
{{/each}}
- **Recent Discretionary Spending:**
{{#each currentExpenses}}
  - {{name}}: ₹{{amount}}
{{/each}}
- **Daily Spending Limit (for 'Wants'):** ₹{{discretionarySpendingLimit}}

## Your Instructions:
1.  **Analyze the User's Data:** Review their income, fixed costs, goals, and especially their recent spending habits.
2.  **Focus on Low-Hanging Fruit:** Identify 2-3 categories from their 'Recent Discretionary Spending' where they can make small, impactful changes.
3.  **Generate Actionable Tips:** For each category, provide a concise, actionable tip. The tips should be realistic and easy to implement.
4.  **Be Specific and Concise:** Do not give generic advice. Your tips must be direct and in bullet-point format.
5.  **Contextualize for India:** Where possible, make sure the tips are relevant to an Indian context.
6.  **Focus on Expense Reduction Only:** Do not suggest increasing income. All tips must be about reducing spending.

Based on these instructions, generate a list of tips for the 'recommendations' field.`,
});

const expenseAdjustmentRecommendationsFlow = ai.defineFlow(
  {
    name: 'expenseAdjustmentRecommendationsFlow',
    inputSchema: ExpenseAdjustmentRecommendationsInputSchema,
    outputSchema: ExpenseAdjustmentRecommendationsOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        throw new Error('AI model returned no output.');
      }
      return output;
    } catch (error) {
      console.error('Error in expenseAdjustmentRecommendationsFlow:', error);
      return {
        recommendations: [
          'Sorry, I am having trouble generating recommendations right now. Please try again in a moment.',
        ],
      };
    }
  }
);
