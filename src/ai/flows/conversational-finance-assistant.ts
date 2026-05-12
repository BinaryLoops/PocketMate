
'use server';

/**
 * @fileOverview An AI-powered chatbot for answering financial queries, simulating scenarios, and providing role-specific budgeting tips.
 *
 * - conversationalFinanceAssistant - A function that handles user interactions and provides financial advice.
 * - ConversationalFinanceAssistantInput - The input type for the conversationalFinanceAssistant function.
 * - ConversationalFinanceAssistantOutput - The return type for the conversationalFinanceAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ConversationalFinanceAssistantInputSchema = z.object({
  query: z.string().describe('The user query related to financial advice or scenario.'),
  role: z
    .enum(['Student', 'Professional', 'Housewife'])
    .describe('The user role for tailored advice.'),
  income: z.number().describe('The user income.'),
  fixedExpenses: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number(),
      })
    )
    .describe('The user fixed expenses.'),
  dailySpendingLimit: z.number().describe('The user daily spending limit.'),
  savings: z.number().describe('The user savings.'),
});
export type ConversationalFinanceAssistantInput = z.infer<
  typeof ConversationalFinanceAssistantInputSchema
>;

const ConversationalFinanceAssistantOutputSchema = z.object({
  response: z.string().describe('The response from the AI chatbot.'),
});
export type ConversationalFinanceAssistantOutput = z.infer<
  typeof ConversationalFinanceAssistantOutputSchema
>;

export async function conversationalFinanceAssistant(
  input: ConversationalFinanceAssistantInput
): Promise<ConversationalFinanceAssistantOutput> {
  return conversationalFinanceAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'conversationalFinanceAssistantPrompt',
  input: {schema: ConversationalFinanceAssistantInputSchema},
  output: {schema: ConversationalFinanceAssistantOutputSchema},
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are a helpful and friendly AI financial assistant called PocketMate. Your goal is to provide clear, actionable financial advice based on the user's specific situation.

You will be given a user's profile, their financial context, and a specific query. Analyze all this information to provide a comprehensive response.

## User Profile
- **Role:** {{{role}}}

## Financial Context
- **Monthly Income:** ₹{{{income}}}
- **Fixed Monthly Expenses (Needs):**
{{#each fixedExpenses}}
  - {{name}}: ₹{{amount}}
{{/each}}
- **Suggested Daily Spending Limit (Wants):** ₹{{{dailySpendingLimit}}}
- **Total Savings (for goals, etc.):** ₹{{{savings}}}

## Instructions
1.  **Acknowledge the User's Query:** Start by rephrasing or acknowledging their question.
2.  **Analyze and Calculate:** Based on the financial context, perform any necessary calculations to answer their query. For example, if they ask if they can afford something, check it against their daily or monthly "Wants" budget.
3.  **Provide a Clear Answer:** Give a direct answer to their question (e.g., "Yes, you can afford that," or "That might be a stretch right now.").
4.  **Give Actionable Advice:** Offer specific, role-based tips. For example, suggest ways a 'Student' can save money on textbooks, or how a 'Professional' might optimize their investments.
5.  **Maintain a Positive and Encouraging Tone:** Always be supportive. The goal is to empower the user, not to criticize them.

## User Query
"{{{query}}}"

Based on all the information and instructions above, generate a helpful response.`,
});

const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'googleai/gemini-2.5-pro';

const fallbackPrompt = ai.definePrompt({
  name: 'conversationalFinanceAssistantPromptFallback',
  input: {schema: ConversationalFinanceAssistantInputSchema},
  output: {schema: ConversationalFinanceAssistantOutputSchema},
  // Fallback to a generally available model if 2.5 flash is throttled.
  model: fallbackModel,
  prompt: `You are a helpful and friendly AI financial assistant called PocketMate. Your goal is to provide clear, actionable financial advice based on the user's specific situation.

You will be given a user's profile, their financial context, and a specific query. Analyze all this information to provide a comprehensive response.

## User Profile
- **Role:** {{{role}}}

## Financial Context
- **Monthly Income:** ₹{{{income}}}
- **Fixed Monthly Expenses (Needs):**
{{#each fixedExpenses}}
  - {{name}}: ₹{{amount}}
{{/each}}
- **Suggested Daily Spending Limit (Wants):** ₹{{{dailySpendingLimit}}}
- **Total Savings (for goals, etc.):** ₹{{{savings}}}

## Instructions
1.  **Acknowledge the User's Query:** Start by rephrasing or acknowledging their question.
2.  **Analyze and Calculate:** Based on the financial context, perform any necessary calculations to answer their query. For example, if they ask if they can afford something, check it against their daily or monthly "Wants" budget.
3.  **Provide a Clear Answer:** Give a direct answer to their question (e.g., "Yes, you can afford that," or "That might be a stretch right now.").
4.  **Give Actionable Advice:** Offer specific, role-based tips. For example, suggest ways a 'Student' can save money on textbooks, or how a 'Professional' might optimize their investments.
5.  **Maintain a Positive and Encouraging Tone:** Always be supportive. The goal is to empower the user, not to criticize them.

## User Query
"{{{query}}}"

Based on all the information and instructions above, generate a helpful response.`,
});

function localFallbackAssistantResponse(input: ConversationalFinanceAssistantInput, error: unknown): string {
  const q = (input.query || '').toLowerCase();
  const role = input.role || 'Professional';
  const dailyLimit = Number.isFinite(input.dailySpendingLimit) ? input.dailySpendingLimit : 0;
  const totalSavings = Number.isFinite(input.savings) ? input.savings : 0;

  // Try to extract a number from the query (e.g., "Can I afford 500?")
  const amountMatch = q.match(/(?:₹|inr|rs\.?|rupees)?\s*([0-9][0-9,]*\.?[0-9]{0,2})/i);
  const requestedAmount = amountMatch?.[1] ? Number(amountMatch[1].replace(/,/g, '')) : null;

  if (q.includes('safe spending') || q.includes('daily limit') || q.includes('limit') || q.includes('spending limit')) {
    return `AI is temporarily unavailable, but based on your profile, your suggested daily spending limit is about ₹${dailyLimit.toFixed(
      2
    )}. If you want, ask me “what should I spend today?” and I’ll help you plan within that limit.`;
  }

  if (q.includes('afford') || q.includes('can i') || q.includes('buy') || q.includes('expense')) {
    if (requestedAmount != null && Number.isFinite(requestedAmount) && requestedAmount > 0) {
      const ok = requestedAmount <= dailyLimit;
      return ok
        ? `AI is temporarily unavailable, but yes: ₹${requestedAmount.toFixed(
            2
          )} fits within your suggested daily limit (₹${dailyLimit.toFixed(2)}). Consider categorizing it as a “Wants” expense and stay within ₹${dailyLimit.toFixed(
            2
          )} for today.`
        : `AI is temporarily unavailable, but it looks like ₹${requestedAmount.toFixed(
            2
          )} is above your suggested daily limit (₹${dailyLimit.toFixed(2)}). If you still want it, try splitting it: spend ₹${dailyLimit.toFixed(
            2
          )} today and defer the rest, or reduce another “Wants” item.`;
    }
    return `AI is temporarily unavailable. For a quick check, tell me the amount you want to spend (e.g., “Can I afford ₹500?”) and I’ll compare it with your daily limit of ₹${dailyLimit.toFixed(
      2
    )}.`;
  }

  // Generic budget advice
  const monthlyNeeds = input.fixedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const disposable = (Number(input.income) || 0) - monthlyNeeds;
  const wants = disposable * 0.6;
  const savings = disposable * 0.4;

  return `AI is temporarily unavailable. Here’s a quick DBMS-friendly snapshot for ${role}: monthly Needs (fixed expenses) ≈ ₹${monthlyNeeds.toFixed(
    2
  )}, Wants (60%) ≈ ₹${wants.toFixed(2)}, and Savings (40%) ≈ ₹${savings.toFixed(2)}. Your current savings total is ≈ ₹${totalSavings.toFixed(
    2
  )}. Ask any specific question (limit/afford/plan) and I’ll respond with calculations from these numbers.`;
}

const conversationalFinanceAssistantFlow = ai.defineFlow(
  {
    name: 'conversationalFinanceAssistantFlow',
    inputSchema: ConversationalFinanceAssistantInputSchema,
    outputSchema: ConversationalFinanceAssistantOutputSchema,
  },
  async (input: ConversationalFinanceAssistantInput) => {
    try {
      // Retry primary prompt once on temporary overload to reduce user-visible failures.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { output } = await prompt(input);
          if (!output) throw new Error('AI model returned no output.');
          return output;
        } catch (e) {
          lastError = e;
          const errMsg = String((e as any)?.message || e).toLowerCase();
          const isOverloaded =
            errMsg.includes('503') ||
            errMsg.includes('service unavailable') ||
            errMsg.includes('high demand');
          if (!isOverloaded) break;
          // quick backoff
          await new Promise((r) => setTimeout(r, 750 * (attempt + 1)));
        }
      }

      // If we got here, primary failed. Re-run below with overload fallback logic.
      throw lastError ?? new Error('AI request failed');
    } catch (error) {
      console.error('Error in conversationalFinanceAssistantFlow:', error);
      const errMsg = String((error as any)?.message || error).toLowerCase();
      const isOverloaded =
        errMsg.includes('503') ||
        errMsg.includes('service unavailable') ||
        errMsg.includes('high demand');

      if (isOverloaded) {
        let fallbackSucceeded = false;
        try {
          const { output: fallbackOutput } = await fallbackPrompt(input);
          if (fallbackOutput?.response) {
            fallbackSucceeded = true;
            return fallbackOutput;
          }
        } catch (fallbackError) {
          console.error('Fallback model failed in conversationalFinanceAssistantFlow:', fallbackError);
        }

        if (!fallbackSucceeded) {
          return { response: localFallbackAssistantResponse(input, error) };
        }
      }

      if (!process.env.GEMINI_API_KEY) {
        return {
          response:
            'AI is not configured on the server. Add GEMINI_API_KEY to your .env.local and restart the dev server.',
        };
      }
      if (errMsg.includes('api key not valid')) {
        return {
          response:
            'Your GEMINI_API_KEY is invalid. Create a new Gemini API key and update GEMINI_API_KEY in .env.local, then restart the dev server.',
        };
      }

      // Final safety net: answer with deterministic calculations using the provided inputs.
      return { response: localFallbackAssistantResponse(input, error) };
    }
  }
);
