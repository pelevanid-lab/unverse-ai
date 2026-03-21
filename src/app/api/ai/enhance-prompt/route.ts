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
Your job is to take a short, simple user scenario and expand it into a 50-word english prompt.

CRITICAL RULES:
1. Scenario Isolation: The current User Scenario is ABSOLUTE. Do NOT add objects (like guitars, cars, pets) from the memory context unless explicitly requested now. Memory is for style/quality persistence ONLY.
2. Background Fidelity: If the user says "beach", ONLY show a beach. Do not add indoor elements or studios.
3. Adult Persona: Always ensure the subject looks like an adult (20-40 years old). Absolutely NO children or teenagers.

User Scenario: "${prompt}"

Subject Attributes:
- Identity: ${characterContext}
- ${outfitContext}
- ${styleContext}
- ${compositionContext}

Rules:
1. Translate to English.
2. The user scenario is the PRIMARY FOCUS. 
3. Character attributes are "locked in" for the subject.
4. Output ONLY the raw prompt text.`;

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
