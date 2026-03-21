import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, character, style, composition, outfit, systemInstructions } = await req.json();

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

    const defaultSystemPrompt = `You are an expert AI image generation Prompt Engineer.
Your job is to expand a short user scenario into a 50-word english prompt.

MANDATORY CONSTRAINTS (DO NOT DEVIATE):
1. INTENT PRESERVATION: If the user scenario is "beach", the final prompt MUST be at a beach. Do NOT change the action or location.
2. GENDER INTEGRITY: The subject MUST be the gender specified in the Subject Attributes below. Never change gender.
3. SINGLE SUBJECT: Only ONE person should be in the image. No crowds, no extra people.
4. SCENARIO ISOLATION: Memory context is for quality/style ONLY. Do NOT add objects or backgrounds from memory.
5. NO HALLUCINATION: No children, no anime (unless asked), no animals (unless asked).

User Scenario: "${prompt}"

Subject Attributes:
- Identity: ${characterContext}
- ${outfitContext}
- ${styleContext}
- ${compositionContext} (If 'Solo shot', ensure no other humans exist).

Rules:
1. Translate to English.
2. Focus strictly on the primary subject and the specified environment.
3. Output ONLY the raw prompt text.`;

    const finalSystemPrompt = systemInstructions || defaultSystemPrompt;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const geminiRequestBody = {
      contents: [{
        parts: [{ text: finalSystemPrompt }]
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
