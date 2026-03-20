import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text, targetLang = 'en' } = await req.json();
        
        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        // Using the public Google Translate API (No API Key Required)
        // client=gtx is the Google Translate Extension identity.
        // sl=auto auto-detects the source language, tl is the target language.
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google Translate API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Google Translate returns an array structure. 
        // data[0] contains the translated chunks.
        let translatedText = "";
        if (data && data[0] && Array.isArray(data[0])) {
            data[0].forEach((chunk: any) => {
                if (chunk[0]) translatedText += chunk[0];
            });
        } else {
             return NextResponse.json({ error: "Invalid response from translate API" }, { status: 500 });
        }

        return NextResponse.json({ translatedText });
    } catch (error: any) {
        console.error("Translation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
