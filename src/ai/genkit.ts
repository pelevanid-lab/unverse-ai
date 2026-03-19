import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit
// The plugin will automatically look for GOOGLE_GENAI_API_KEY in environment variables
export const ai = genkit({
  plugins: [
    googleAI()
  ],
  model: 'googleai/gemini-1.5-flash',
});
