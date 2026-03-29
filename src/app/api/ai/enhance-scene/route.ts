export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, character, style, composition, outfit } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    const characterContext = character ? 
        `Gender: ${character.gender || 'female'}, Hair: ${character.hairColor || 'blonde'}, Eyes: ${character.eyeColor || 'blue'}, Face: ${character.faceStyle || 'cute'}` : 
        "A person";

    const systemPrompt = `You are a professional AI Scene Designer. Expand the user input into a high-quality cinematic image prompt and extract metadata.

OUTPUT FORMAT (JSON ONLY):
{
  "enhancedPrompt": "The full cinematic prompt here (max 60 words). Must include traits: ${character?.hairColor || ''} hair, ${character?.eyeColor || ''} eyes.",
  "outfitSummary": "Brief clothing description",
  "environmentSummary": "Brief location description",
  "lightingSummary": "Brief lighting description",
  "propSummary": "Key objects"
}

STRICT CONSTRAINTS:
1. 80% focus on location, lighting, atmosphere.
2. Return ONLY valid JSON. No markdown backticks.
3. Keep subject identity consistent.

Input: "${prompt}"
Subject: ${characterContext}
Style: ${style || 'cinematic'}
Composition: ${composition || 'solo'}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { 
                temperature: 0.2, 
                responseMimeType: "application/json" 
            }
        })
    });

    if (!response.ok) throw new Error("Gemini Scene Enhancement Failed");
    
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return NextResponse.json(JSON.parse(text));

  } catch (error: any) {
    console.error('SCENE ENHANCE ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
