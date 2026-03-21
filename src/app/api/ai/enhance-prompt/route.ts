import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, character, style, composition, outfit } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    // Build the context for the Prompt Engineer persona
    let characterContext = "A person";
    if (character) {
        characterContext = `Gender: ${character.gender || 'female'}, Hair: ${character.hairColor || 'blonde'}, Eyes: ${character.eyeColor || 'blue'}, Face: ${character.faceStyle || 'cute'}`;
    }

    const outfitContext = outfit ? `Outfit: wearing ${outfit}` : '';
    const styleContext = style && style !== 'none' ? `Style: ${style} atmosphere/lighting` : '';
    const compositionContext = composition === 'solo' ? 'Solo shot, 1 person' : 'Duo shot, 2 people';

    const systemPrompt = `You are an expert AI image generation Prompt Engineer (for Midjourney/Flux).
Your job is to take a short, simple user prompt (which might be in Turkish or English) and expand it into a highly detailed, professional, 50-word english prompt for an AI image generator.

User's short input: "${prompt}"

Required Character Constraints:
- Identity: ${characterContext}
- ${outfitContext}
- ${styleContext}
- ${compositionContext}

Rules:
1. Translate everything to English perfectly.
2. Focus heavily on lighting, camera settings (e.g., 85mm lens, f/1.8), render quality (8k, photorealistic, incredibly detailed).
3. Seamlessly blend the user's idea with the character constraints.
4. Output ONLY the raw prompt text, no intro or outro, just the final comma-separated prompt string.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const geminiRequestBody = {
      contents: [{
        parts: [{ text: systemPrompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody)
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error("Gemini API Error (Enhance):", errorData);
      throw new Error("Failed to enhance prompt with Gemini.");
    }

    const geminiData = await geminiResponse.json();
    const enhancedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!enhancedText) {
      throw new Error("Received empty text from Gemini.");
    }

    return NextResponse.json({ enhancedPrompt: enhancedText.trim() });

  } catch (error: any) {
    console.error('AI PROMPT ENHANCE ERROR:', error);
    return NextResponse.json({ error: error.message || 'AI prompt enhance failed.' }, { status: 500 });
  }
}
