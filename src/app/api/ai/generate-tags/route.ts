export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, locale } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    const systemPrompt = `Generate 7 highly relevant viral hashtags for this image scenario: "${prompt}". 
    Locale: ${locale || 'en'}. 
    ${locale === 'tr' ? 'Output hashtags in Turkish starting with #.' : 'Output hashtags in English starting with #.'}
    Return ONLY a comma-separated list of hashtags.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.5 }
        })
    });

    if (!response.ok) throw new Error("Tag Generation Failed");
    
    const data = await response.json();
    const tags = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return NextResponse.json({ tags: tags.trim() });

  } catch (error: any) {
    console.error('TAG GEN ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
