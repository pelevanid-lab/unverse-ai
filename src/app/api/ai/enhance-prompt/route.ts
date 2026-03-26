export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, character, style, composition, outfit, systemInstructions, locale } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    // 🌐 AUTO-TRANSLATE IF NON-ENGLISH
    const shouldTranslate = (text: string) => {
        const nonAscii = /[^\x00-\x7F]/;
        return nonAscii.test(text);
    };

    let processedPrompt = prompt;
    if (shouldTranslate(prompt)) {
        try {
            const response = await fetch(`${new URL(req.url).origin}/api/ai/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: prompt, targetLang: 'en' })
            });
            if (response.ok) {
                const trData = await response.json();
                processedPrompt = trData.translation;
                console.log("AUTO-TRANSLATED ENHANCE INPUT:", processedPrompt);
            }
        } catch (e) {
            console.warn("Translation failed for enhance-prompt, using original.");
        }
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
    Your job is to expand this English scenario into a 50-word cinematic prompt and extract specific scene metadata.
    
    OUTPUT FORMAT: JSON ONLY
    {
      "enhancedPrompt": "The full cinematic prompt here...",
      "outfitSummary": "Brief description of the clothing (e.g. 'white silk bikini' or 'blue denim jacket')",
      "environmentSummary": "Brief description of the location (e.g. 'tropical beach at sunset' or 'modern library interior')",
      "lightingSummary": "Brief description of lighting (e.g. 'warm golden hour' or 'soft diffused indoor')",
      "propSummary": "Key objects in the scene (e.g. 'cocktail glass' or 'old books')"
    }
    
    STRICT RULES:
    1. SCENARIO PERSISTENCE: You must honor and include the user's specific location and outfit choices. Do not ignore them for generic "urban" or "studio" settings.
    2. SCENE DNA: VERBATIM extract the core outfit (e.g. 'red bikini') and environment (e.g. 'luxury beach club') into the summary fields.
    3. NO HALLUCINATIONS: Do not add extra people or change the core subject identity.
    4. CINEMATIC DETAIL: Use 40-50 words for the enhancedPrompt, focusing on textures, fabrics, and atmospheric lighting.
    
    User Scenario (in English): "${processedPrompt}"
    
    Subject Attributes:
    - Identity: ${characterContext}
    - Outfit: ${outfitContext}
    - Style: ${styleContext}
    
    Return ONLY valid JSON.`;

    const finalSystemPrompt = systemInstructions || defaultSystemPrompt;

    console.log("AI PROMPT ENHANCE INPUT:", finalSystemPrompt);

    const modelsToTry = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash'
    ];

    const geminiRequestBody = {
      contents: [{
        parts: [{ text: finalSystemPrompt }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1500, // Increased for for better detail
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }
      ]
    };

    let geminiResponse;
    let successfulModel = '';

    for (const modelId of modelsToTry) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        console.log(`Trying Gemini model: ${modelId}`);

        geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiRequestBody)
        });

        if (geminiResponse.ok) {
            successfulModel = modelId;
            break;
        }

        if (geminiResponse.status === 404) {
            console.warn(`Model ${modelId} not found (404), trying next...`);
            continue;
        }

        // If it's not a 404 but another error (401, 429, etc.), stop and report it
        const errText = await geminiResponse.text();
        console.error(`Gemini Error (${modelId}):`, errText);
        throw new Error(`Gemini Error (${geminiResponse.status}): ${geminiResponse.statusText}`);
    }

    if (!geminiResponse || !geminiResponse.ok) {
        throw new Error(`Gemini Enhancement Failed: All models returned 404 or failed.`);
    }

    console.log(`SUCCESS: Used Gemini model: ${successfulModel}`);
        const geminiData = await geminiResponse.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("Empty response from Gemini.");

        console.log("AI PROMPT ENHANCE RAW OUTPUT:", text);

        let data: any;
        try {
            // 1. Try direct parse
            data = JSON.parse(text.replace(/```json|```/g, "").trim());
        } catch (e) {
            console.warn("Gemini failed to return valid JSON. Attempting recovery...");
            
            // 2. Recovery: Extract JSON within braces
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    let jsonCandidate = jsonMatch[0];
                    
                    // 3. Recovery: Fix common truncation (missing closing braces)
                    const openBraces = (jsonCandidate.match(/\{/g) || []).length;
                    const closeBraces = (jsonCandidate.match(/\}/g) || []).length;
                    if (openBraces > closeBraces) {
                        jsonCandidate += "}".repeat(openBraces - closeBraces);
                    }
                    
                    data = JSON.parse(jsonCandidate);
                } else {
                    throw new Error("No JSON structure found in response.");
                }
            } catch (recoveryErr) {
                console.error("JSON Recovery Failed:", text);
                // Fallback for UI continuity
                data = {
                    enhancedPrompt: text.substring(0, 500),
                    outfitSummary: "Natural",
                    environmentSummary: "Cozy",
                    lightingSummary: "Warm",
                    propSummary: "None"
                };
            }
        }

        // 🌐 BIDIRECTIONAL TRANSLATION (Story Localization)
        const targetLocale = locale || 'en';
        const isTurkish = targetLocale === 'tr' || targetLocale === 'tr-TR';
        const isRussian = targetLocale === 'ru' || targetLocale === 'ru-RU';
        const targetLangCode = isTurkish ? 'tr' : (isRussian ? 'ru' : 'en');

        if (targetLangCode !== 'en' && data.enhancedPrompt) {
            try {
                const trResponse = await fetch(`${new URL(req.url).origin}/api/ai/translate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: data.enhancedPrompt, targetLang: targetLangCode })
                });
                if (trResponse.ok) {
                    const trData = await trResponse.json();
                    data.translatedStory = trData.translation || data.enhancedPrompt;
                    console.log(`[ENHANCE] Translated Story to ${targetLangCode}`);
                }
            } catch (e) {
                console.warn("Story translation failed:", e);
            }
        }

        return NextResponse.json(data);

  } catch (error: any) {
    console.error('AI PROMPT ENHANCE ERROR:', error);
    return NextResponse.json({ error: error.message || 'AI prompt enhance failed.' }, { status: 500 });
  }
}
