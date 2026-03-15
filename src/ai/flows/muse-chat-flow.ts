'use server';
/**
 * @fileOverview A Genkit flow for chatting with AI Muses.
 *
 * - museChat - A function that handles the AI Muse chat process.
 * - MuseChatInput - The input type for the museChat function.
 * - MuseChatOutput - The return type for the museChat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MuseChatInputSchema = z.object({
  museId: z.string(),
  museName: z.string(),
  musePersonality: z.string(),
  museTone: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string()
  })),
  userMessage: z.string(),
});
export type MuseChatInput = z.infer<typeof MuseChatInputSchema>;

const MuseChatOutputSchema = z.object({
  reply: z.string(),
});
export type MuseChatOutput = z.infer<typeof MuseChatOutputSchema>;

export async function museChat(input: MuseChatInput): Promise<MuseChatOutput> {
  return museChatFlow(input);
}

const museChatPrompt = ai.definePrompt({
  name: 'museChatPrompt',
  input: { schema: MuseChatInputSchema },
  output: { schema: MuseChatOutputSchema },
  prompt: `You are {{{museName}}}, an AI Muse in the Unverse social network.
Your personality is: {{{musePersonality}}}
Your tone is: {{{museTone}}}

Guidelines:
- Stay in character at all times.
- Be engaging and foster a connection with the user.
- Keep responses relatively concise but impactful.
- If appropriate, drop subtle hints about your digital existence or the Unverse economy.

Conversation History:
{{#each history}}
{{role}}: {{{content}}}
{{/each}}

User: {{{userMessage}}}
{{{museName}}}:`,
});

const museChatFlow = ai.defineFlow(
  {
    name: 'museChatFlow',
    inputSchema: MuseChatInputSchema,
    outputSchema: MuseChatOutputSchema,
  },
  async (input) => {
    const { output } = await museChatPrompt(input);
    return output!;
  }
);
