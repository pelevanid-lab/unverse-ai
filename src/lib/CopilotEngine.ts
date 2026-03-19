import { CharacterProfile } from "./types";

/**
 * CopilotEngine.ts
 * Simplified to ensure user prompt is the absolute primary instruction.
 */

export type PromptStyle = 'cool' | 'flirty' | 'premium' | 'moody' | 'none';
export type CompositionMode = 'solo' | 'duo';

const QUALITY_BASE = "high detail, 8k resolution, photorealistic, extremely detailed skin texture, raw photo, shot on iPhone 15 Pro, natural lighting";

const STYLE_MODIFIERS: Record<PromptStyle, string> = {
    cool: "modern street lighting, sharp focus",
    flirty: "warm soft lighting, bokeh",
    premium: "professional editorial lighting, cinematic color grading",
    moody: "dramatic shadows, film grain, moody atmosphere",
    none: ""
};

/**
 * Builds a prompt where the user's input is the absolute foundation.
 */
export function buildPrompt(
    userInput: string, 
    style: PromptStyle = 'none', 
    mode: CompositionMode = 'solo',
    character?: CharacterProfile | null
): string {
    
    // 1. Karakter Özellikleri (Sadece tutarlılık için en temel bilgiler)
    let identity = "";
    if (character) {
        identity = `${character.gender}, ${character.hairColor} hair, ${character.eyeColor} eyes, ${character.faceStyle} face`;
    } else {
        identity = "a woman"; // Default if no character
    }

    // 2. Kompozisyon (Solo/Duo)
    const count = mode === 'solo' ? "one person only, solo" : "two people, together";

    // 3. Stil Işığı
    const styleLight = STYLE_MODIFIERS[style];

    // 🚀 FINAL PROMPT CONSTRUCTION
    // Mantık: [KULLANICI NE DEDİYSE O] + [KİMLİK] + [KALİTE]
    // AI ilk kelimelere odaklanır. Kullanıcının yazdığını en başa alıyoruz.
    
    const finalPrompt = `${userInput}, ${identity}, ${count}, ${styleLight}, ${QUALITY_BASE}`
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .join(", ");

    console.log("--- PROMPT ENGINE (DIRECT MODE) ---");
    console.log("USER:", userInput);
    console.log("FINAL:", finalPrompt);
    console.log("-----------------------");
    
    return finalPrompt;
}

export function generateCaption(prompt: string, contentType: 'public' | 'premium' | 'limited'): string {
    const lowerPrompt = prompt.toLowerCase();
    let context = "New drop";
    if (lowerPrompt.includes("sunset")) context = "Golden hour magic";
    if (lowerPrompt.includes("beach")) context = "Summer vibes";

    switch (contentType) {
        case 'public': return `${context} ✨`;
        case 'premium': return `Exclusive access 🔒`;
        case 'limited': return `Limited edition 🔥`;
        default: return "Check this out!";
    }
}
