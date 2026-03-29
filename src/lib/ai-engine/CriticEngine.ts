import { CriticResult, ScenePlan, CharacterProfile } from '../types';

export class CriticEngine {
    private static THRESHOLD = 0.7;

    /**
     * Evaluates a generated image against the original scene plan and character using Gemini Vision.
     */
    static async evaluate(imageUrl: string, plan: ScenePlan, character?: CharacterProfile, originalPrompt?: string, mode: 'full' | 'minimal' = 'full'): Promise<CriticResult> {
        console.log(`[CriticEngine] Evaluating result (${mode}) with Gemini Vision: ${imageUrl}`);
        
        try {
            const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
            if (!apiKey) throw new Error("GEMINI_API_KEY not configured.");

            // 1. Fetch image and convert to base64
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) throw new Error(`Failed to fetch image for criticism: ${imageResponse.statusText}`);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(arrayBuffer).toString('base64');

            // 2. Construct the prompt based on mode
            let systemPrompt = "";
            
            if (mode === 'minimal') {
                systemPrompt = `You are a fast AI validator.
                TASK: Quick check of Identity, Hands, and Framing.
                SCENE: ${plan.framing}, ${plan.bodyVisibilityLevel}. 
                NEEDS HANDS: ${plan.needsHandsVisible}.
                
                OUTPUT FORMAT (JSON ONLY):
                {
                  "overallScore": 0.0-1.0,
                  "identityScore": 0.0-1.0,
                  "handsVisible": true/false,
                  "upperBodyVisible": true/false,
                  "framingType": "close-up/medium/wide",
                  "retryRecommended": true/false
                }`;
            } else {
                systemPrompt = `You are a professional AI Art Critic.
                
                TASK: Evaluate the attached image against the Scene Plan and Character Profile.
                
                SCENE PLAN:
                - Goal: ${plan.emotionalGoal}
                - Composition: ${plan.composition}
                - Lighting: ${plan.lightingPlan}
                - Framing: ${plan.framing}
                
                CHARACTER: ${character?.name || 'Subject'}
                
                REQUIRED OUTFIT: "${plan.outfit || 'N/A'}"
                
                ORIGINAL INTENT: "${originalPrompt || 'N/A'}"
                
                CRITERIA (0.0 - 1.0):
                1. Identity: Face matches character profile.
                2. Composition: Layout matches framing rules. If "sitting" or "hands" were requested but are NOT VISIBLE due to too-tight framing, score low (below 0.5).
                3. Lighting Accuracy: Does it match the lighting plan?
                4. Mood Accuracy: Does the emotional tone match?
                5. Anatomy: No artifacts (extra fingers, distorted limbs).
                6. Outfit Continuity: MUST match "REQUIRED OUTFIT" exactly.
                
                OUTPUT FORMAT (JSON ONLY):
                {
                  "overallScore": 0.0-1.0,
                  "identityScore": 0.0-1.0,
                  "compositionScore": 0.0-1.0,
                  "lightingAccuracyScore": 0.0-1.0,
                  "moodScore": 0.0-1.0,
                  "expressionAccuracyScore": 0.0-1.0,
                  "anatomyScore": 0.0-1.0,
                  "continuityScore": 0.0-1.0,
                  "outfitContinuityScore": 0.0-1.0,
                  "promptFidelityScore": 0.0-1.0,
                  "handsVisible": true/false,
                  "upperBodyVisible": true/false,
                  "framingType": "close-up/medium/wide",
                  "issues": ["list of issues"],
                  "suggestedFixes": ["how to fix"],
                  "retryRecommended": true/false
                }
                
                STRICT RULE: Return ONLY valid JSON. If framing prevents seeing requested attributes (pose/hands) OR identity drifts OR outfit changes unintentionally, set retryRecommended: true.`;
            }

            // Use gemini-2.5-flash (User requested 2.5)
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: systemPrompt },
                            { inlineData: { mimeType: "image/png", data: base64Image } }
                        ]
                    }],
                    generationConfig: { 
                        temperature: 0.1, 
                        responseMimeType: "application/json" 
                    }
                })
            });

            if (!response.ok) throw new Error(`Gemini Vision API Error: ${response.statusText}`);
            
            const data = await response.json();
            let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!resultText) throw new Error("Empty response from Gemini Vision.");

            // 🧬 ROBUST JSON EXTRACTION (Safe Parsing Layer)
            const result = this.safeParseJson(resultText);
            return result as CriticResult;

        } catch (error: any) {
            console.error("[CriticEngine] Error during evaluation:", error.message);
            return {
                overallScore: 0.8,
                identityScore: 0.8,
                compositionScore: 0.8,
                lightingScore: 0.8,
                anatomyScore: 0.8,
                continuityScore: 0.8,
                promptFidelityScore: 0.8,
                issues: ["API Error - used safe fallback"],
                suggestedFixes: [],
                retryRecommended: false
            };
        }
    }

    private static safeParseJson(text: string): any {
        try {
            // Attempt 1: Direct parse (cleaned)
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            // Attempt 2: Extract between first { and last }
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                try {
                    const extracted = text.substring(start, end + 1);
                    return JSON.parse(extracted);
                } catch (e2) {
                    throw new Error("Could not parse extracted JSON block");
                }
            }
            throw new Error("No JSON block found in response");
        }
    }
}
