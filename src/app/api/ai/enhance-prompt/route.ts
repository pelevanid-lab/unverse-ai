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

MANDATORY PROTOCOL (DO NOT DEVIATE):
1. FULL BODY SHOT: If an outfit is specified, you MUST describe a "full body shot, head to toe" view. NO portrait cropping.
2. OUTFIT VISIBILITY: The specified clothing MUST be the visual highlight. Clearly describe it.
3. SCENE FOUNDATION: The User Scenario is the absolute environment. No indoor/studio unless asked.
4. GENDER & ADULT: Maintain the adult persona and the specified gender.

User Scenario: "${prompt}"

Subject Attributes:
- OUTFIT (MANDATORY): ${outfitContext}
- SCENE (FOUNDATION): ${prompt}
- Identity: ${characterContext}
- ${styleContext}
- ${compositionContext} (If 'Solo', no extra people).

Rules:
1. Translate to English.
2. Use Wide-Angle lens descriptors (e.g., 35mm, f/4) to show the full body and environment.
3. Output ONLY the raw prompt text.`;

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
