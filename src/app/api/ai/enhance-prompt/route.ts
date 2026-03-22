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

    // Build the context for for the and Prompt Engineer persona
    let characterContext = "A person";
    if (character) {
        characterContext = `Gender: ${character.gender || 'female'}, Hair: ${character.hairColor || 'blonde'}, Eyes: ${character.eyeColor || 'blue'}, Face: ${character.faceStyle || 'cute'}`;
    }

    const outfitContext = outfit ? `Outfit: wearing ${outfit}` : '';
    const styleContext = style && style !== 'none' ? `Style: ${style} atmosphere/lighting` : '';
    const compositionContext = composition === 'solo' ? 'Solo shot, 1 person' : 'Duo shot, 2 people';

    const defaultSystemPrompt = `You are an expert AI image generation Prompt Engineer. 
    Your job is to expand this English scenario into a 50-word cinematic prompt.
    
    MANDATORY: 
    - Describe a "full body shot, head to toe" view.
    - Focus on on clothing details and environment.
    - Use Wide-Angle lens descriptors (e.g. 35mm).
    
    User Scenario (in English): "${prompt}"
    
    Subject Attributes:
    - Identity: ${characterContext}
    - Outfit: ${outfitContext}
    - Style: ${styleContext}
    
    Output ONLY the raw prompt text.`;

    const finalSystemPrompt = systemInstructions || defaultSystemPrompt;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const geminiRequestBody = {
      contents: [{
        parts: [{ text: finalSystemPrompt }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 300,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
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
        throw new Error("Gemini Enhancement Failed.");
    }

    const geminiData = await geminiResponse.json();
    const RawEnhancedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!RawEnhancedText) {
      throw new Error("Received empty response from Gemini.");
    }

    // Clean up any remaining tags if Gemini hallucinated them
    const finalEnhancedText = RawEnhancedText.replace(/TRANSLATION:.*$/im, '').replace(/ENHANCEMENT:/i, '').trim();

    return NextResponse.json({ 
        enhancedPrompt: finalEnhancedText
    });

  } catch (error: any) {
    console.error('AI PROMPT ENHANCE ERROR:', error);
    return NextResponse.json({ error: error.message || 'AI prompt enhance failed.' }, { status: 500 });
  }
}
