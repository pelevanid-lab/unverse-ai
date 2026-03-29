import { ScenePlan } from '../types';

export class SceneBrainEngine {
    private static cache = new Map<string, ScenePlan>();

    /**
     * Converts an enhanced prompt into a structured ScenePlan using Gemini.
     */
    static async generateScenePlan(enhancedPrompt: string, retryCount = 0): Promise<ScenePlan> {
        // 🛡️ Pre-Sanitize Input (Clean any leaked JSON from enhancer)
        const sanitizedInput = enhancedPrompt.replace(/\{|\}|\[|\]|```json|```/g, "").trim();
        
        // 🧬 HASH CACHE (Cost & Latency Reduction)
        const hash = Buffer.from(sanitizedInput).toString('base64').substring(0, 32);
        if (this.cache.has(hash)) {
            console.log(`[SceneBrain] Cache Hit for prompt hash: ${hash}`);
            return this.cache.get(hash)!;
        }

        console.log(`[SceneBrain] Analyzing prompt (Attempt ${retryCount + 1}): ${sanitizedInput.substring(0, 50)}...`);
        
        try {
            const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
            if (!apiKey) throw new Error("GEMINI_API_KEY not configured.");

            const systemPrompt = `You are a professional Creative Director and Scene Architect.
            TASK: Decompose the cinematic prompt into a structured ScenePlan JSON.
            
            PROMPT: "${sanitizedInput}"
            
            OUTPUT FORMAT (JSON ONLY):
            {
              "emotionalGoal": "mood/vibe",
              "sceneType": "beach/indoor/studio/etc",
              "composition": "rule of thirds/centered/etc",
              "cameraAngle": "eye level/low angle/etc",
              "framing": "close-up/medium shot/wide shot/etc",
              "focalPoint": "eyes/outfit/etc",
              "lightingPlan": "soft morning/neon/etc",
              "visualHierarchy": "what stands out first",
              "continuityRules": "what must remain same",
              "riskFactors": "e.g. hand artifacts",
              "allowedVariationAxes": ["lighting", "angle"],
              "outfit": "clothing description",
              "environment": "location description",
              "requiredVisibility": ["face", "hands", "pose"],
              "bodyVisibilityLevel": "headshot/upper_torso/full_body",
              "hardConstraints": ["hands must be visible"],
              "needsHandsVisible": true,
              "needsPoseVisible": false
            }
            
            STRICT RULE: Return ONLY valid JSON.`;

            // Use gemini-2.5-flash
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }],
                    generationConfig: { 
                        temperature: 0.1, 
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
            
            const data = await response.json();
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!resultText) throw new Error("Empty response from Gemini.");

            // 🧬 ROBUST JSON EXTRACTION
            const result = this.safeParseJson(resultText);
            
            // 🛡️ Field Sanitization
            const clean = (val: any) => typeof val === 'string' ? val.replace(/\{|\}|\[|\]|```/g, "").trim() : val;
            const finalized: any = { ...result };
            Object.keys(finalized).forEach(k => { if (typeof finalized[k] === 'string') finalized[k] = clean(finalized[k]); });

            this.cache.set(hash, finalized as ScenePlan); 
            return finalized as ScenePlan;

        } catch (error: any) {
            console.error("[SceneBrainEngine] Failed to resolve ScenePlan, using fallback:", error.message);
            return {
                emotionalGoal: 'cinematic',
                sceneType: 'studio',
                composition: 'centered',
                cameraAngle: 'eye level',
                framing: 'medium shot',
                focalPoint: 'subject',
                lightingPlan: 'balanced',
                visualHierarchy: 'subject dominance',
                continuityRules: 'maintain clothing',
                riskFactors: 'none',
                allowedVariationAxes: ['angle'],
                requiredVisibility: ['face'],
                bodyVisibilityLevel: 'upper_torso',
                needsHandsVisible: true,
                needsPoseVisible: false
            };
        }
    }

    private static safeParseJson(text: string): any {
        const cleanText = text.replace(/```json|```/g, "").trim();
        try {
            return JSON.parse(cleanText);
        } catch (e) {
            const start = cleanText.indexOf('{');
            const end = cleanText.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                let candidate = cleanText.substring(start, end + 1);
                // Fix common truncation
                const openCount = (candidate.match(/\{/g) || []).length;
                const closeCount = (candidate.match(/\}/g) || []).length;
                if (openCount > closeCount) candidate += "}".repeat(openCount - closeCount);
                
                try {
                    return JSON.parse(candidate);
                } catch (e2) {
                    throw new Error("Fatal: JSON structure irrecoverable.");
                }
            }
            throw new Error("No JSON structure found.");
        }
    }
}
