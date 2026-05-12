// src/ai/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Correct model ID for v1beta endpoint
const MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

// Initialize Genkit with GoogleAI plugin
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  model: MODEL,
});

console.log(`[GenKit] Using model: ${MODEL}`);

export const config = {
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  model: MODEL,
};
