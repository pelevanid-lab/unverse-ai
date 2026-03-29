export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { badPrompts } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    const systemPrompt = `Analyze these DISLIKED image prompts: "${badPrompts}". 
    Identify common disliked patterns in lighting, composition, style, and camera angles.
    Return a specific "negative prompt" string to avoid these issues.
    Output ONLY the comma-separated negative prompt text (e.g., "avoid flat lighting, avoid blurry faces").`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.1 }
        })
    });

    if (!response.ok) throw new Error("Negative Prompt Generation Failed");
    
    const data = await response.json();
    const negativePrompt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return NextResponse.json({ negativePrompt: negativePrompt.trim() });

  } catch (error: any) {
    console.error('NEGATIVE GEN ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
