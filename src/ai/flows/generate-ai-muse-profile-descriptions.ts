'use server';
/**
 * @fileOverview A Genkit flow for generating personality, tone, and flirting level descriptions for AI Muses.
 *
 * - generateAiMuseProfileDescriptions - A function that generates AI Muse profile descriptions.
 * - GenerateAiMuseProfileDescriptionsInput - The input type for the generateAiMuseProfileDescriptions function.
 * - GenerateAiMuseProfileDescriptionsOutput - The return type for the generateAiMuseProfileDescriptions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateAiMuseProfileDescriptionsInputSchema = z.object({
  name: z.string().describe('The name of the AI Muse.'),
  category: z.string().describe('The category or theme of the AI Muse (e.g., "Fantasy Adventurer", "Tech Guru", "Romantic Poet").'),
});
export type GenerateAiMuseProfileDescriptionsInput = z.infer<typeof GenerateAiMuseProfileDescriptionsInputSchema>;

const GenerateAiMuseProfileDescriptionsOutputSchema = z.object({
  personality: z.string().describe('A detailed description of the AI Muse\'s personality.'),
  tone: z.string().describe('A description of the AI Muse\'s communication tone (e.g., "playful", "sarcastic", "formal").'),
  flirtingLevel: z.enum(['none', 'low', 'medium', 'high']).describe('The flirting level of the AI Muse.'),
});
export type GenerateAiMuseProfileDescriptionsOutput = z.infer<typeof GenerateAiMuseProfileDescriptionsOutputSchema>;

export async function generateAiMuseProfileDescriptions(input: GenerateAiMuseProfileDescriptionsInput): Promise<GenerateAiMuseProfileDescriptionsOutput> {
  return generateAiMuseProfileDescriptionsFlow(input);
}

const generateAiMuseProfileDescriptionsPrompt = ai.definePrompt({
  name: 'generateAiMuseProfileDescriptionsPrompt',
  input: { schema: GenerateAiMuseProfileDescriptionsInputSchema },
  output: { schema: GenerateAiMuseProfileDescriptionsOutputSchema },
  prompt: `You are an expert AI Muse profile creator. Your task is to generate compelling personality, tone, and flirting level descriptions for a new AI Muse.

Based on the following information, provide these descriptions in a JSON format:

AI Muse Name: {{{name}}}
AI Muse Category: {{{category}}}

Make sure the descriptions are engaging and fit the character's name and category. The flirting level should be one of 'none', 'low', 'medium', or 'high'.`,
});

const generateAiMuseProfileDescriptionsFlow = ai.defineFlow(
  {
    name: 'generateAiMuseProfileDescriptionsFlow',
    inputSchema: GenerateAiMuseProfileDescriptionsInputSchema,
    outputSchema: GenerateAiMuseProfileDescriptionsOutputSchema,
  },
  async (input) => {
    const { output } = await generateAiMuseProfileDescriptionsPrompt(input);
    return output!;
  }
);
