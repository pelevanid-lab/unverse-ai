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

    const defaultSystemPrompt = `You are an expert AI image generation Prompt Engineer and Translator.

LANGUAGE RULE: 
- Translate everything to CLEAN NATURAL ENGLISH. 
- NO TURKISH or hybrid text in the output.
- The first sentence MUST be a clean direct 1-sentence translation of the user scenario.

MANDATORY PROTOCOL:
1. FULL BODY SHOT: Describe a "full body shot, head to toe".
2. OUTFIT VISIBILITY: The clothing is the priority.
3. SCENE FOUNDATION: Use the translated scenario as the absolute background.

User Scenario (Translate this): "${prompt}"

Subject Attributes:
- Identity: ${characterContext}
- Outfit: ${outfitContext}
- Style: ${styleContext}

Rules:
1. Translate the scenario to English first.
2. The entire output MUST be in English.
3. Output ONLY the raw prompt text (Starting with the translation).`;

    const finalSystemPrompt = systemInstructions || defaultSystemPrompt;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const geminiRequestBody = {
      contents: [{
        parts: [{ text: finalSystemPrompt }]
      }],
      generationConfig: {
        temperature: 0.8, // Slightly higher for for creativity
        maxOutputTokens: 300,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
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
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      throw new Error("Received empty response from Gemini.");
    }

    // Attempt to extract the clean prompt. We'll harden this to ALWAYS return English.
    // If Gemini returns a JSON-like string, we parse it, otherwise we treat the whole thing as enhancedPrompt.
    let translation = prompt; // Fallback
    let enhancedPrompt = rawText.trim();

    // Force Gemini to give us a clear translation in a structured way if possible
    // For now, we'll refine the system prompt to facilitate this.
    return NextResponse.json({ 
        enhancedPrompt: enhancedPrompt,
        translation: enhancedPrompt.split('.')[0] // Use the first sentence as a proxy for for translation if not structured
    });

  } catch (error: any) {
    console.error('AI PROMPT ENHANCE ERROR:', error);
    return NextResponse.json({ error: error.message || 'AI prompt enhance failed.' }, { status: 500 });
  }
}
