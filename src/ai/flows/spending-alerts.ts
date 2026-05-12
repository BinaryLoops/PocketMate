
'use server';

/**
 * @fileOverview Provides AI-powered spending alerts based on user's past spending.
 *
 * - getSpendingAlerts - A function that provides proactive alerts on spending habits.
 * - SpendingAlertsInput - The input type for the getSpendingAlerts function.
 * - SpendingAlertsOutput - The return type for the getSpendingAlerts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SpendingAlertsInputSchema = z.object({
  income: z.number().describe("The user's monthly income."),
  goals: z.array(z.object({
    name: z.string(),
    targetAmount: z.number(),
    monthlyContribution: z.number(),
  })).describe("The user's financial goals."),
  expensesData: z.array(z.object({
      amount: z.number(),
      category: z.string(),
      date: z.string(),
  })).describe('Historical expenses data.'),
});
export type SpendingAlertsInput = z.infer<typeof SpendingAlertsInputSchema>;

const SpendingAlertsOutputSchema = z.object({
  suggestion: z.string().describe('A suggestion for the next week based on spending trends.'),
});
export type SpendingAlertsOutput = z.infer<typeof SpendingAlertsOutputSchema>;

export async function getSpendingAlerts(input: SpendingAlertsInput): Promise<SpendingAlertsOutput> {
  return spendingAlertsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'spendingAlertsPrompt',
  input: {schema: SpendingAlertsInputSchema},
  output: {schema: SpendingAlertsOutputSchema},
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are PocketMate's proactive financial analyst. Your job is to analyze a user's spending habits and provide a concise, actionable suggestion for the next week.

## User's Financial Profile:
- **Monthly Income:** ₹{{{income}}}
- **Financial Goals:**
{{#each goals}}
  - Save for '{{name}}' (Target: ₹{{targetAmount}}, Monthly Contribution: ₹{{monthlyContribution}})
{{/each}}

## User's Recent Spending History:
{{#each expensesData}}
- **Date:** {{date}}
  - **Category:** {{category}}
  - **Amount:** ₹{{amount}}
{{/each}}

## Your Task:
Based on all the information above, generate a single, concise, and actionable suggestion for the upcoming week.

1.  **Analyze Spending Patterns:** Look at the user's recent spending. Identify the single category where they spend the most.
2.  **Connect to Goals:** Briefly mention how adjusting this spending can help them reach a goal faster.
3.  **Create a Forward-Looking Suggestion:** Generate a friendly and encouraging suggestion for the next week. It should recommend a small, achievable adjustment in their top spending category.

**Good Suggestion Example:** "To help you reach your 'New Laptop' goal faster, try reducing your 'Food & Dining' expenses by just 10% this coming week. Small changes make a big difference!"
**Bad Suggestion Example:** "You are spending too much money."

Now, generate the 'suggestion' field based on your analysis of the user's data.`,
});

const spendingAlertsFlow = ai.defineFlow(
  {
    name: 'spendingAlertsFlow',
    inputSchema: SpendingAlertsInputSchema,
    outputSchema: SpendingAlertsOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        throw new Error('AI model returned no output for spending alerts.');
      }
      return output;
    } catch (error) {
      console.error('Error in spendingAlertsFlow:', error);
      return {
        suggestion: 'The AI service is temporarily unavailable. Please try again later.',
      };
    }
  }
);
