import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    const systemPrompt = `You are a character attribute extractor. 
    Analyze the following character description and and and extract detailed physical traits.
    The description might be in in Turkish or or English.
    
    RULES:
    - If the and and description is in in in Turkish, translate the and and concept to to English for for for the and and JSON values.
    - Example: "Kızıl saçlı" -> hairColor: "red". "Mavi gözlü" -> eyeColor: "blue".
    - "Dolgun hatlı" -> bodyStyle: "curvy/voluptuous".
    - "Uzun boylu" -> height: "tall".
    
    Response MUST be a raw JSON object with these fields:
    - gender: "female" | "male" | "other"
    - hairColor: string
    - eyeColor: string
    - faceStyle: string
    - bodyStyle: string
    - height: string
    - vibe: string
    
    Description: "${prompt}"
    
    Output ONLY valid JSON. No markdown blocks.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const geminiRequestBody = {
      contents: [{
        parts: [{ text: systemPrompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
        responseMimeType: "application/json"
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody)
    });

    if (!geminiResponse.ok) {
        throw new Error(`Gemini Parsing Failed: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    const jsonText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!jsonText) {
      throw new Error("Empty response from Gemini.");
    }

    const attributes = JSON.parse(jsonText);

    return NextResponse.json(attributes);

  } catch (error: any) {
    console.error('PARSE CHARACTER ERROR:', error);
    return NextResponse.json({ 
        gender: "female",
        hairColor: "unknown",
        eyeColor: "unknown",
        faceStyle: "natural",
        bodyStyle: "natural",
        height: "average",
        vibe: "casual"
    }); 
  }
}
