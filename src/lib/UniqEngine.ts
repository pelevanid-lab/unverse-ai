import { CharacterProfile } from "./types";

/**
 * UniqEngine.ts
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
 * Common pose inference mapping.
 * Translates simple user actions into technical modifiers for the AI.
 */
const POSE_INFERENCE: Record<string, string> = {
    "lying": "lying down, relaxed posture, horizontal orientation",
    "sitting": "sitting down, seated position, centered",
    "walking": "walking motion, movement, dynamic action",
    "running": "running, fast motion, dynamic pose",
    "jumping": "jumping, mid-air, dynamic action",
    "dancing": "dancing, rhythmic motion, artistic pose",
    "sleeping": "sleeping, eyes closed, peaceful expression, lying down",
    "standing": "standing still, upright posture, full body view",
    "workout": "athletic pose, fitness motion, dynamic lighting",
    "yoga": "yoga pose, zen posture, stretching",
    "leaning": "leaning against a wall, casual pose, relaxed",
    "kneeling": "kneeling position, looking at camera",
    "arching": "arching back, dramatic pose, high fashion",
    "squatting": "squatting, street style pose, urban vibe",
};

/**
 * Builds a prompt where the user's input is the absolute foundation.
 * @param lockedOutfit Experimental: Manual clothing override passed from UI.
 */
export type StudioMode = 'standard' | 'digitalTwin' | 'aiEdit';

export function buildPrompt(
    userInput: string, 
    style: PromptStyle = 'none', 
    mode: CompositionMode = 'solo',
    character?: CharacterProfile | null,
    lockedOutfit?: string,
    studioMode: StudioMode = 'standard'
): string {
    
    // 1. Identity Traits
    let identity = "";
    if (character) {
        identity = `Adult ${character.gender}, ${character.hairColor} hair, ${character.eyeColor} eyes, ${character.faceStyle} face`;
    } else {
        identity = "an adult woman"; // Default if no character
    }

    // 2. Outfit Lock (User Choice)
    const attire = lockedOutfit ? `wearing ${lockedOutfit}` : "";

    // 3. Pose Inference
    let poseMismatch = "";
    const lowerInput = userInput.toLowerCase();
    for (const [key, modifier] of Object.entries(POSE_INFERENCE)) {
        if (lowerInput.includes(key)) {
            poseMismatch = modifier;
            break;
        }
    }

    // 4. Composition (Solo/Duo)
    const count = mode === 'solo' ? "one person only, solo" : "two people, together";

    // 5. Style Modifiers
    const styleLight = STYLE_MODIFIERS[style];

    // 6. Studio Mode System Constraints
    let systemConstraint = "";
    if (studioMode === 'digitalTwin') {
        if (character) {
            systemConstraint = "Meticulously follow the provided character traits to ensure the person's identity is consistent with the established character profile. Focus on the requested scene and pose while maintaining facial likeness.";
        } else {
            systemConstraint = "Meticulously preserve the facial features, hair, and unique identity of the person in the reference photo. The result must be a perfect likeness of the original individual.";
        }
    } else if (studioMode === 'aiEdit') {
        systemConstraint = "Keep the person from the reference image exactly as they are. Focus ONLY on modifying the background or objects as requested: " + userInput + ". Absolute identity preservation.";
    }

    // 🚀 FINAL PROMPT CONSTRUCTION
    // Layout: [USER INPUT] + [IDENTITY] + [OUTFIT] + [POSE] + [COUNT] + [STYLE] + [QUALITY]
    const finalPrompt = `${userInput}, ${identity}, ${attire}, ${poseMismatch}, ${count}, ${styleLight}, ${systemConstraint}, ${QUALITY_BASE}`
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .join(", ");

    console.log("--- AI STUDIO 2.0 (UNIQ ENGINE) ---");
    console.log("INPUT:", userInput);
    if (lockedOutfit) console.log("OUTFIT LOCK:", lockedOutfit);
    console.log("FINAL:", finalPrompt);
    console.log("---------------------------------------");
    
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

export function getDailyStrategySuggestions(personaName: string, niche: string): { title: string, content: string }[] {
    return [
        { title: "Peak Time", content: `Since you're in the ${niche} niche, engagement peaks at 7 PM for ${personaName}.` },
        { title: "Visual Trend", content: "Cyber-organic lighting is trending. Try adding 'neon vines' to your next prompt." },
        { title: "Fan Reward", content: "Drop a 5-unit limited edition for your loyal subscribers this weekend." }
    ];
}
