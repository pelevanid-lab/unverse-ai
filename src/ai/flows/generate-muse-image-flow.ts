'use server';
/**
 * @fileOverview A Genkit flow for generating AI Muse avatar or post images.
 *
 * - generateMuseImage - A function that generates an image for an AI Muse.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateMuseImageInputSchema = z.object({
  prompt: z.string().describe('A detailed description of the image to generate.'),
  aspectRatio: z.enum(['1:1', '16:9', '9:16']).optional().default('1:1'),
});
export type GenerateMuseImageInput = z.infer<typeof GenerateMuseImageInputSchema>;

const GenerateMuseImageOutputSchema = z.object({
  imageUrl: z.string().describe('The data URI of the generated image.'),
});
export type GenerateMuseImageOutput = z.infer<typeof GenerateMuseImageOutputSchema>;

export async function generateMuseImage(input: GenerateMuseImageInput): Promise<GenerateMuseImageOutput> {
  return generateMuseImageFlow(input);
}

const generateMuseImageFlow = ai.defineFlow(
  {
    name: 'generateMuseImageFlow',
    inputSchema: GenerateMuseImageInputSchema,
    outputSchema: GenerateMuseImageOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: input.prompt,
    });

    if (!media || !media.url) {
      throw new Error('Image generation failed.');
    }

    return {
      imageUrl: media.url,
    };
  }
);
