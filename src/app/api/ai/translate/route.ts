import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, targetLang = 'en' } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    const isToEnglish = targetLang === 'en';
    
    const systemPrompt = isToEnglish 
        ? `You are a professional translator. Translate this text into natural, highly descriptive English. 
           - If it's a scene description, make it evocative.
           - If it is already English, polish it. 
           - Output ONLY the raw translation.`
        : `You are a professional translator. Translate this English text into natural ${targetLang}. 
           - Maintain the tone and descriptive quality.
           - Output ONLY the raw translation.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const geminiRequestBody = {
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nText to translate: "${text}"` }]
      }],
      generationConfig: {
        temperature: 0.3, // Lower temperature for accuracy
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
        const errText = await geminiResponse.text();
        console.error("Gemini Translation Error Details:", errText);
        throw new Error(`Gemini Translation Failed: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    const translation = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!translation) {
      throw new Error("Empty translation from Gemini.");
    }

    return NextResponse.json({ translation: translation.trim() });

  } catch (error: any) {
    console.error('TRANSLATION ERROR:', error);
    return NextResponse.json({ error: error.message || 'Translation failed.' }, { status: 500 });
  }
}
