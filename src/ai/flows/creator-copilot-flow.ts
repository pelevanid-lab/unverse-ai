'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CreatorUniqInputSchema = z.object({
  idea: z.string().describe('The short idea or context provided by the creator.'),
  contentType: z.enum(['public', 'premium', 'limited']).describe('The type of content being created.'),
  creatorName: z.string().optional().describe('The name of the creator for personalization.'),
});

const CreatorUniqOutputSchema = z.object({
  caption: z.string().describe('A catchy social media caption based on the idea.'),
  teaser: z.string().describe('A short, intriguing teaser specifically for gated content.'),
  suggestedPriceULC: z.number().describe('A suggested price in ULC based on the idea and content type.'),
  explanation: z.string().describe('A brief explanation of why this price was suggested.'),
});

export const creatorUniqFlow = ai.defineFlow(
  {
    name: 'creatorUniqFlow',
    inputSchema: CreatorUniqInputSchema,
    outputSchema: CreatorUniqOutputSchema,
  },
  async (input) => {
    const prompt = `
      You are Uniq Engine for Unverse, a SocialFi platform.
      Your goal is to help creators craft high-performing content descriptions and pricing strategies.

      Creator Name: ${input.creatorName || 'A talented creator'}
      Content Idea: ${input.idea}
      Content Type: ${input.contentType}

      Based on this:
      1. Write a professional, engaging, and catchy caption.
      2. If it's Premium or Limited, write a separate "Teaser" (a hook to make people want to unlock).
      3. Suggest a fair price in ULC (Unlock Currency). 
         - Note: 1 ULC = 0.015 USDC. 
         - High quality premium posts usually range from 5 to 50 ULC.
         - Rare limited editions can go from 50 to 500 ULC.
      4. Provide a very short explanation for the price.

      Return the result in structured JSON format.
    `;

    const response = await ai.generate({
      prompt,
      config: {
        temperature: 0.7,
      },
    });

    return response.output();
  }
);
