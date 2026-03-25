import { db } from './firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    doc, 
    getDoc,
    updateDoc,
    Timestamp,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import { UserProfile, AIGenerationLog, CharacterProfile, AIPreference, OnboardingState, CreatorMedia, SceneLock } from './types';
import { processAiCreatorActivation, processAiCreatorGeneration } from './ledger';
import { SceneRuleEngine } from './scene-engine';

export class Uniq {
    private userId: string;
    private user: UserProfile | null = null;

    constructor(userId: string) {
        this.userId = userId;
    }

    /**
     * Initializes the Uniq engine by fetching user profile and current learning state.
     */
    async init() {
        const userRef = doc(db, 'users', this.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            this.user = userSnap.data() as UserProfile;
        }
    }

    /**
     * Fetches top successful generation logs to provide a refined "Dynamic Memory" context.
     * Criteria: Satisfaction Score >= 4, savedToContainer, or published.
     * Selection: Randomly pick 3 from the top 5 most successful/recent logs.
     */
    async getMemoryContext(): Promise<string> {
        if (!this.userId) return "";

        try {
            const logsRef = collection(db, 'ai_generation_logs');
            // We fetch a larger pool to rank them locally for better control
            const q = query(
                logsRef,
                where('userId', '==', this.userId),
                where('satisfactionScore', '>=', 4),
                orderBy('timestamp', 'desc'),
                limit(15)
            );

            const querySnapshot = await getDocs(q);
            const allLogs = querySnapshot.docs.map(doc => doc.data() as AIGenerationLog);

            if (allLogs.length === 0) return "";

            // Rank logs: Score (primary), Published (secondary), Saved (tertiary)
            const rankedLogs = [...allLogs].sort((a, b) => {
                if ((b.satisfactionScore || 0) !== (a.satisfactionScore || 0)) {
                    return (b.satisfactionScore || 0) - (a.satisfactionScore || 0);
                }
                if (b.published !== a.published) return b.published ? 1 : -1;
                if (b.savedToContainer !== a.savedToContainer) return b.savedToContainer ? 1 : -1;
                return 0;
            });

            // Take top 5 and pick 3 randomly to avoid repetition
            const top5 = rankedLogs.slice(0, 5);
            const selected = [...top5].sort(() => 0.5 - Math.random()).slice(0, 3);

            let context = "\n--- REFINED MEMORY CONTEXT (STRETCHING USER STYLE) ---\n";
            selected.forEach((log, index) => {
                context += `Example ${index + 1}:\nInput: "${log.prompt}"\nResult: "${log.enhancedPrompt}"\n\n`;
            });
            context += "Maintain the core identity and quality displayed in these examples.\n";
            
            return context;
        } catch (error) {
            console.error("Error fetching memory context:", error);
            return "";
        }
    }

    /**
     * Fetches unsuccessful generation logs (Score <= 2) to build a Negative Prompt context.
     * Uses Gemini to analyze patterns Swapping lighting, composition, style, camera angle.
     */
    async getNegativeMemoryContext(): Promise<string> {
        if (!this.userId) return "";

        try {
            const logsRef = collection(db, 'ai_generation_logs');
            const q = query(
                logsRef,
                where('userId', '==', this.userId),
                where('satisfactionScore', '<=', 2),
                orderBy('timestamp', 'desc'),
                limit(5)
            );

            const querySnapshot = await getDocs(q);
            const badLogs = querySnapshot.docs.map(doc => doc.data() as AIGenerationLog);

            if (badLogs.length === 0) return "";

            // Use Gemini to analyze why these were bad
            const badPrompts = badLogs.map(l => l.prompt).join(" | ");
            const response = await fetch('/api/ai/enhance-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: badPrompts,
                    systemInstructions: `Analyze these DISLIKED image prompts: "${badPrompts}". 
                    Identify common disliked patterns in lighting, composition, style, and camera angles.
                    Return a specific "negative prompt" string to avoid these issues.
                    Output ONLY the comma-separated negative prompt text (e.g., "avoid flat lighting, avoid blurry faces").`
                })
            });

            if (!response.ok) return "";
            const data = await response.json();
            return data.enhancedPrompt;
        } catch (error) {
            console.error("Error fetching negative context:", error);
            return "";
        }
    }

    /**
     * Translates any language into natural descriptive English for for AI processing.
     */
    async translatePrompt(prompt: string): Promise<string> {
        if (!prompt) return "";
        try {
            const response = await fetch('/api/ai/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: prompt, targetLang: 'en' })
            });

            if (!response.ok) throw new Error("Translation service failed.");
            const data = await response.json();
            return data.translation || prompt;
        } catch (err) {
            console.warn("Translation Error, using original:", err);
            return prompt;
        }
    }

    /**
     * DIRECTOR MODE: Generates a strictly controlled variation prompt based on 5 categories.
     * Ensures 'Same Photoshoot' consistency by preserving base scene verbatim.
     */
    async generateDirectorPrompt(params: {
        originalPrompt: string,
        presets: {
            composition?: string,
            angle?: string,
            mood?: string,
            action?: string,
            lighting?: string
        },
        character?: CharacterProfile,
        sceneLock?: SceneLock
    }): Promise<{ enhancedPrompt: string }> {
        const MAPPINGS: Record<string, Record<string, string>> = {
            composition: {
                wide: "wide cinematic composition, subject smaller in frame",
                medium: "medium shot, balanced framing",
                full_body: "full body shot, entire silhouette visible",
                close_up: "close-up, face dominant",
                extreme_close: "extreme close-up, detailed facial focus"
            },
            angle: {
                front: "direct front view",
                profile: "side profile view",
                over_shoulder: "looking over shoulder",
                back: "back facing camera",
                low_angle: "low angle perspective, powerful presence",
                high_angle: "high angle perspective, softer feeling"
            },
            mood: {
                confident: "confident expression, strong posture",
                mysterious: "subtle emotion, intense gaze",
                seductive: "soft eyes, inviting expression",
                relaxed: "natural posture, calm expression",
                playful: "light smile, energetic mood",
                cold: "distant expression, minimal emotion",
                // 🌟 ADVANCED POSES (CLEVER BYPASS)
                backReveal: "standing with back to camera, looking over the shoulder with a seductive gaze, topless from behind, emphasizing back curve",
                strategicCover: "topless pose with arms strategically crossed over chest, modesty preserved through artistic positioning, elegant nude photography style",
                silkProne: "lying prone on silk sheets, looking at camera with a sultry expression, back arched slightly, intimate atmosphere",
                sultryArch: "kneeling with an arched back, emphasizing body curves, seductive silhouette, provocative and confident posture",
                kneelingSeduction: "kneeling on a soft surface, hands running through hair, inviting expression, intimate and sultry vibe",
                sideRecumbent: "lying on side, one leg drawn up, emphasizing hip and waist curves, relaxed yet seductive recumbent pose",
                leaningSilhouette: "leaning against a wall, one hand behind head, shadowed lighting emphasizing silhouette, mysterious and seductive vibe",
                recliningPose: "reclining back in a chair, legs slightly apart, confident and sultry posture, relaxed exotic vibe"
            },
            action: {
                still: "standing still, stable pose",
                walking: "natural walking motion",
                sitting: "relaxed seated pose",
                turning: "body slightly turning",
                looking_away: "gaze away from camera",
                interaction: "interacting with object (glass, hair, or clothing)",
                // 🌟 UNIQ PRO ADVANCED MAPPINGS (CLEVER EROTICA)
                sheerLingerie: "wearing highly translucent and sheer lace lingerie, delicate see-through fabric, artistic revealing aesthetic",
                satinSilks: "draped in lustrous satin and silk ribbons, smooth reflective fabric, minimal coverage, opulent boudoir style",
                wetShirt: "wearing a thin white shirt, completely soaked and translucent, clinging to body, wet skin glistening underneath",
                provocativeLace: "intricate provocative black lace bodysuit, open-back design, highly detailed embroidery, seductive silhouette",
                highLegBodysuit: "ultra high-cut high-leg bodysuit, exposing hips and waist, tight fit, athletic yet seductive",
                strategicCoverage: "artistic strategic coverage with hands or fabric, semi-nude aesthetic, high-fashion nude photography style, elegant revealingness",
                sultryBoudoir: "sultry boudoir attire, stockings and suspenders, vintage lingerie, intimate bedroom atmosphere",
                exoticBeachwear: "extremely minimal exotic beachwear, thin strings, sun-kissed skin, tropical vibe, highly revealing",
                distressedDenim: "unbuttoned distressed denim jeans, topless with arms covering chest, raw and edgy aesthetic, outdoor natural light",
                leatherLace: "confrontational leather and lace combination, tight bodice, rebellious and seductive vibe, dark studio lighting",
                deepPlunge: "wearing a deep plunge neckline garment, extreme front cleavage, elegant yet highly revealing design, alluring aesthetic",
                ultraHighCut: "wearing an ultra-high cut bodysuit, exposing the entire hip and waist line, high-leg silhouette, provocative fit",
                openFront: "wearing an open-front luxury garment, exposing the torso, modesty preserved with artistic lighting, high-fashion provocative style",
                monokiniExotic: "wearing an exotic monokini with extreme cut-outs, revealing waist and sides, minimal coverage, seductive beachwear vibe"
            },
            lighting: {
                golden_hour: "warm golden hour lighting",
                soft_studio: "soft diffused studio lighting",
                dramatic: "strong shadows, high contrast",
                neon: "neon reflections, night lighting",
                daylight: "natural daylight realism"
            }
        };

        // 🛡️ SCENE RULE ENGINE: Cleanse presets based on scene type
        const safePresets = params.sceneLock 
            ? SceneRuleEngine.getSafeModifiers(params.sceneLock, params.presets)
            : params.presets;

        const appliedParts: string[] = [];
        Object.entries(safePresets).forEach(([category, key]) => {
            if (key && MAPPINGS[category]?.[key as string]) {
                appliedParts.push(MAPPINGS[category][key as string]);
            }
        });

        const variationMod = appliedParts.join(". ") || "cinematic variation";
        
        // 🧬 LAYERED PROMPT CONSTRUCTION (Director Mode 2.0)
        // Layer A: Variation Modifiers (The Change)
        // Layer B: Locked Scene Anchors (The Foundation)
        // Layer C: Strict Photoshoot Reinforcement (The Fix)
        
        const sceneLock = params.sceneLock;
        const isAdvanced = !!(params.presets as any).isAdvanced;
        
        // 🧬 CLOTHING LOCK BYPASS: If advanced mode is requesting any specialized erotic attire
        const advancedActions = [
            'sheerLingerie', 'satinSilks', 'wetShirt', 'provocativeLace', 'highLegBodysuit',
            'strategicCoverage', 'sultryBoudoir', 'exoticBeachwear', 'distressedDenim', 'leatherLace',
            'deepPlunge', 'ultraHighCut', 'openFront', 'monokiniExotic'
        ];
        const bypassClothingLock = isAdvanced && advancedActions.includes(params.presets.action || "");
        
        const outfitAnchor = bypassClothingLock 
            ? "OUTFIT: modified based on directive" 
            : (sceneLock?.outfitSummary ? `OUTFIT: ${sceneLock.outfitSummary}` : "identical clothing");
            
        const envAnchor = sceneLock?.environmentSummary ? `LOCATION: ${sceneLock.environmentSummary}` : "identical surroundings";
        
        const finalPrompt = `${variationMod}. Same photoshoot, ${outfitAnchor}, ${envAnchor}, same lighting, same location: ${params.originalPrompt}. STRICT RULE: do not change environment ${bypassClothingLock ? '' : 'or outfit'}, lighting setup or character identity.`;

        return { enhancedPrompt: finalPrompt };
    }

    /**
     * Smart Flow: Enhances an image prompt with character traits, styles, and memory.
     */
    async generateImagePrompt(params: {
        userInput: string,
        style?: string,
        composition?: string,
        character?: CharacterProfile,
        isEditMode?: boolean,
        referenceImageUrl?: string,
        outfit?: string
    }): Promise<{ enhancedPrompt: string, originalPrompt: string, translation?: string, negativePrompt?: string, sceneLock?: Partial<SceneLock> }> {
        
        // DISABLE memory to clear hallucinations for for current triage
        const memoryContext = ""; 
        const negativeMemoryContext = "";
        
        // Character context construction (Persona Upgrade)
        const char = params.character || this.user?.savedCharacter;
        const isLocked = !!char && (params.isEditMode || (this.user?.savedCharacter && char.id === this.user.savedCharacter.id));

        let charInfo = "A person";
        if (char) {
            const traits = [];
            if (isLocked) {
                traits.push(`Gender: ${char.gender}`);
                charInfo = traits.join(", ") + ". (Core identity is locked and will be handled by reference image).";
            } else {
                if (char.gender) traits.push(`Identity: ${char.gender}`);
                if (char.hairColor && char.hairColor.toLowerCase() !== 'unknown') traits.push(`Hair: ${char.hairColor}`);
                if (char.eyeColor && char.eyeColor.toLowerCase() !== 'unknown') traits.push(`Eyes: ${char.eyeColor}`);
                if (char.faceStyle && char.faceStyle.toLowerCase() !== 'unknown') traits.push(`Face: ${char.faceStyle}`);
                charInfo = traits.join(", ") + ". Always maintain this EXACT identity.";
            }
            if (char.persona_prompt) charInfo += ` Persona Context: ${char.persona_prompt}`;
        }

        const systemInstructions = `You are a professional Prompt Engineer. Expand the user input into a photorealistic, high-quality, and deeply cinematic 60-word AI image prompt.
STRICT CONSTRAINTS:
1. SCENE PRIMACY: Focus 80% of your expansion on location, lighting, atmosphere, composition, and storytelling details.
2. STORYTELLING: Describe the mood, the "moment", and natural interactions.
3. OUTPUT FORMAT: Return ONLY a JSON object with: enhancedPrompt, outfitSummary, environmentSummary, lightingSummary, propSummary.
4. CHARACTER CONSISTENCY: Enforce a Subject. Use basic identifiers like gender.

User Input: "${params.userInput}"
Character: ${charInfo}
Style/Atmosphere: ${params.style || 'natural'}
Shot Type: ${params.composition || 'solo'}
${params.isEditMode ? 'IMPORTANT: This is an EDIT request. Preserve the subject identity perfectly.' : ''}
`;

        // Call the central Gemini API
        const response = await fetch('/api/ai/enhance-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: params.userInput,
                systemInstructions,
                character: char,
                style: params.style,
                composition: params.composition,
                outfit: params.outfit,
                negativeContext: negativeMemoryContext
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Uniq couldn't enhance the prompt.");
        }

        const data = await response.json();
        
        // 🧬 SceneDNA extraction
        const sceneLock: Partial<SceneLock> = {
            outfitSummary: data.outfitSummary,
            environmentSummary: data.environmentSummary,
            lightingSummary: data.lightingSummary,
            propSummary: data.propSummary
        };

        return {
            enhancedPrompt: data.enhancedPrompt,
            originalPrompt: params.userInput,
            translation: data.translation,
            negativePrompt: negativeMemoryContext,
            sceneLock
        };
    }

    /**
     * Smart Flow: Generates creative social media content based on an image.
     */
    async generateContainerCopy(params: {
        imageUrl: string,
        contentType: 'public' | 'premium' | 'limited',
        originalPrompt?: string,
        locale?: string
    }) {
        // Guard: Do not generate captions for videos
        const isVideo = params.imageUrl?.toLowerCase().includes('.mp4') || params.imageUrl?.toLowerCase().includes('video');
        if (isVideo) {
            return params.originalPrompt || "Check out this video!";
        }

        const memoryContext = await this.getMemoryContext();
        const langInstruction = params.locale === 'tr' 
            ? "DAİMİ DİLİN TÜRKÇE OLMALI (Your response must always be in Turkish)." 
            : "YOUR RESPONSE MUST ALWAYS BE IN ENGLISH.";

        const systemInstructions = `Generate a catchy, professional social media caption for this AI-generated image.
${langInstruction}
Original Idea: "${params.originalPrompt || 'Beautiful scene'}"
Content Type: ${params.contentType} (Note: Create exclusivity for premium/limited)

${memoryContext}

Output ONLY the caption text.`;

        const response = await fetch('/api/ai/generate-caption', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                systemInstructions
            })
        });

        if (!response.ok) throw new Error("Caption generation failed.");
        const data = await response.json();
        return data.caption;
    }

    /**
     * Onboarding: Suggests the next best action for the user to achieve their goal.
     * 1. generate -> 2. monetization -> 3. container -> 4. publish
     */
    getNextActionRecommendation(): { action: string, message: string, cta: string } {
        const step = this.user?.onboardingState?.step || 'welcome';
        
        switch (step) {
            case 'welcome':
                return { action: 'goal_selection', message: "Welcome! Ready to turn your imagination into revenue?", cta: "Seçim Yap" };
            case 'goal_selection':
                return { action: 'first_generate', message: "Step 1: Create your first AI visual using Uniq's smart flow.", cta: "Hayal Et" };
            case 'first_generate':
                return { action: 'first_monetization', message: "Step 2: Our AI evaluated your content. Let's set a smart price.", cta: "Fiyatlandır" };
            case 'first_monetization':
                return { action: 'first_container', message: "Step 3: Great choice. Save this to your Workshop to prepare for publishing.", cta: "Havuza At" };
            case 'first_container':
                return { action: 'first_publish', message: "Final Step: Publish your masterpiece and start earning!", cta: "Yayınla" };
            default:
                return { action: 'explore', message: "Ready for your next masterpiece?", cta: "Üretmeye Devam" };
        }
    }

    /**
     * Monetization Intelligence Engine: Evaluates content value (0-100).
     */
    evaluateContentScore(params: {
        prompt: string,
        isEdit?: boolean,
        hasPersona?: boolean
    }): number {
        let score = 30; // Base score
        
        // Complexity factor
        const words = params.prompt.split(/\s+/).length;
        if (words > 20) score += 20;
        else if (words > 10) score += 10;
        
        // Quality/Persona factor
        if (params.hasPersona) score += 25;
        
        // Effort factor
        if (params.isEdit) score += 15;
        
        // Uniqueness (random variant for now, will be real data in future)
        score += Math.floor(Math.random() * 10);
        
        return Math.min(score, 100);
    }

    /**
     * Monetization: Suggests pricing and quantity based on Intelligence Engine Score.
     */
    getMonetizationSuggestion(prompt: string, isEdit?: boolean): { 
        premiumPrice: number, 
        limitedPrice: number, 
        limitedSupply: number,
        score: number,
        recommendation: string
    } {
        const hasPersona = !!this.user?.savedCharacter;
        const score = this.evaluateContentScore({ prompt, isEdit, hasPersona });
        
        let recommendation = "Public";
        let premiumPrice = 10;
        let limitedPrice = 20;
        let limitedSupply = 5;

        if (score > 80) {
            recommendation = "Limited";
            premiumPrice = 25;
            limitedPrice = 50;
            limitedSupply = 3;
        } else if (score >= 50) {
            recommendation = "Premium";
            premiumPrice = 15;
            limitedPrice = 30;
            limitedSupply = 10;
        } else {
            recommendation = "Improvement Needed (or Public)";
            premiumPrice = 5;
            limitedPrice = 10;
        }

        // Apply multipliers based on persona strength
        const multiplier = hasPersona ? 1.5 : 1.0;
        
        return {
            premiumPrice: Math.round(premiumPrice * multiplier),
            limitedPrice: Math.round(limitedPrice * multiplier),
            limitedSupply,
            score,
            recommendation
        };
    }

    /**
     * Checks if the user has enough successful interactions to activate Adaptive Learning.
     * Threshold: 15 successful generations (Score 4-5).
     */
    async checkAdaptiveLearningThreshold(): Promise<boolean> {
        if (!this.userId) return false;
        try {
            const logsRef = collection(db, 'ai_generation_logs');
            
            // 1. Total logs >= 15
            const qTotal = query(logsRef, where('userId', '==', this.userId), limit(15));
            const snapTotal = await getDocs(qTotal);
            if (snapTotal.size < 15) return false;

            // 2. High-quality (>=4) >= 5
            const qHigh = query(logsRef, where('userId', '==', this.userId), where('satisfactionScore', '>=', 4), limit(5));
            const snapHigh = await getDocs(qHigh);
            if (snapHigh.size < 5) return false;

            // 3. Published >= 2
            const qPub = query(logsRef, where('userId', '==', this.userId), where('published', '==', true), limit(2));
            const snapPub = await getDocs(qPub);
            if (snapPub.size < 2) return false;

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Generates 5-7 tags based on the prompt, including niche, visual and persona tags.
     */
    async generateTags(prompt: string, locale?: string, contentType?: string): Promise<string[]> {
        try {
            const hasPersona = !!this.user?.savedCharacter;
            const langInstruction = locale === 'tr' ? "Output hashtags in Turkish." : "Output hashtags in English.";
            const response = await fetch('/api/ai/enhance-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    systemInstructions: `Generate 7 relevant, one-word hashtags (without #) for this image. 
                    Include tags for: niche, visual style, content type (${contentType || 'public'}), and persona (${hasPersona ? 'consistent' : 'new'}). 
                    ${langInstruction}
                    Output ONLY the words separated by commas.`
                })
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.enhancedPrompt.split(',').map((t: string) => t.trim().toLowerCase());
        } catch {
            return [];
        }
    }

    /**
     * Logs interaction results to help future adaptive learning.
     */
    async logInteraction(logData: Partial<AIGenerationLog>) {
        try {
            const logId = logData.id;
            if (logId) {
                // Update existing
                const logRef = doc(db, 'ai_generation_logs', logId);
                await updateDoc(logRef, {
                    ...logData,
                    timestamp: serverTimestamp()
                });
            } else {
                // Create new
                await addDoc(collection(db, 'ai_generation_logs'), {
                    ...logData,
                    userId: this.userId,
                    timestamp: serverTimestamp()
                });
            }

            // Check if we should upgrade learning mode
            if (this.user?.aiLearningState?.mode !== 'adaptive') {
                const isReady = await this.checkAdaptiveLearningThreshold();
                if (isReady) {
                    const userRef = doc(db, 'users', this.userId);
                    await updateDoc(userRef, {
                        'aiLearningState.mode': 'adaptive',
                        'aiLearningState.activatedAt': Date.now()
                    });
                }
            }
        } catch (error) {
            console.error("Failed to log interaction:", error);
        }
    }

    /**
     * Toggles AI Creator Mode state.
     * Activation costs 4 ULC (One-time or per-enable fee as per business rule).
     */
    async activateSubscription(): Promise<{ success: boolean, ledgerId?: string }> {
        if (!this.userId) return { success: false };
        try {
            const ledgerId = await processAiCreatorActivation(this.userId);
            return { success: true, ledgerId };
        } catch (error) {
            console.error("Subscription activation failed:", error);
            throw error;
        }
    }

    /**
     * Cold Start: Provides a default high-quality aesthetic for users without history.
     */
    getColdStartPrompt(): string {
        const style = this.user?.savedCharacter?.style_bias || 'cinematic';
        const styles: Record<string, string> = {
            cinematic: "cinematic lighting, dramatic shadows, realistic skin texture, 8k resolution, film grain",
            soft: "soft aesthetic, ethereal lighting, pastel tones, dreamlike atmosphere, high quality portrait",
            bold: "bold colors, high contrast, vibrant lighting, sharp focus, fashion photography style",
            luxury: "luxury atmosphere, opulent lighting, golden hour, elegant composition, premium quality"
        };
        return styles[style] || styles.cinematic;
    }

    /**
     * Automation: Generates a daily AI draft for Profile Mode.
     * Cost: 2 ULC.
     */
    async generateDailyDraft(options?: { baseUrl?: string }): Promise<string> {
        const now = Date.now();
        if (!this.user?.aiCreatorModeExpiresAt || this.user.aiCreatorModeExpiresAt < now) {
            throw new Error("Uniq Premium subscription is inactive or expired.");
        }
        
        // 🎯 RELAXED LOCK: 8:00 AM Reset Milestone
        const today8AM = new Date();
        today8AM.setHours(8, 0, 0, 0);

        const lastRun = this.user?.aiCreatorModeLastRunAt || 0;
        const lastRunDate = new Date(lastRun);

        // If today is past 8 AM, and last run was before today's 8 AM milestone
        const isAlreadyRunToday = now >= today8AM.getTime() && lastRunDate.getTime() >= today8AM.getTime();
        
        if (isAlreadyRunToday) {
            throw new Error("Already generated a draft today. Next window opens at 08:00 AM tomorrow.");
        }

        // 1. Charge fee (1 ULC per content/draft)
        await processAiCreatorGeneration(this.userId);

        // 2. Prepare Prompt (Using Zero-Day Config if available)
        const config = this.user.aiCreatorModeConfig;
        let basePrompt = "A professional high-quality portrait";
        
        if (config) {
            basePrompt = `Portrait of ${config.personaName}, niche: ${config.niche}, tone: ${config.tone}, vibe: ${config.vibe}. Style must be consistent with ${config.personaName}'s brand.`;
        }

        const memory = await this.getMemoryContext();
        if (!memory && !config) {
            basePrompt += ", " + this.getColdStartPrompt();
        }

        // 3. Enhance & Generate
        const enhancement = await this.generateImagePrompt({ 
            userInput: basePrompt,
            style: this.user?.savedCharacter?.style_bias || 'cinematic'
        });

        // 4. API Call to Replicate (Simulated here, should be called via internal API fetch)
        const imageApiUrl = options?.baseUrl ? `${options.baseUrl}/api/ai/generate-image` : '/api/ai/generate-image';
        // 🧬 IDENTITY ANCHORS: Digital Twin 3.0 (Muse Rules)
        const char = this.user?.savedCharacter;
        const identityAnchor = char ? 
            `, SUBJECT: 1 adult ${char.gender}, with ${char.hairColor} hair, ${char.eyeColor} eyes, ${char.faceStyle} face shape, ${char.bodyStyle} body, height: ${char.height}. Vibe: ${char.vibe}. IDENTICAL FACE TO REFERENCE.` : 
            "";

        const response = await fetch(imageApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: enhancement.originalPrompt + identityAnchor,
                enhancedPrompt: enhancement.enhancedPrompt + identityAnchor,
                translation: enhancement.enhancedPrompt,
                userId: this.userId,
                cost: 0, // Payment already handled above
                character: char,
                isDailyDraft: true // 🚩 Signal for max identity lock
            })
        });

        if (!response.ok) throw new Error("Daily generation failed at API level.");
        const data = await response.json();

        // 5. Save to Creator Media as SCHEDULED (for autonomous publishing)
        const mediaDoc = await addDoc(collection(db, 'creator_media'), {
            creatorId: this.userId,
            mediaUrl: data.mediaUrl,
            mediaType: 'image',
            status: 'scheduled', // Auto-schedule for immediate publishing
            scheduledFor: Date.now(),
            source: 'ai_auto',
            createdAt: serverTimestamp(),
            priceULC: 10, // Default price
            contentType: 'public',
            isAI: true,
            aiPrompt: enhancement.originalPrompt,
            aiEnhancedPrompt: enhancement.enhancedPrompt
        });

        return mediaDoc.id;
    }

    /**
     * Scene Variations: Transforms an existing scene into a new variation.
     * Preserves: Identity, Outfit, Location, Tone.
     * Changes: Composition, Camera, Framing, Mood emphasis.
     */
    async generateVariationPrompt(params: {
        originalPrompt: string,
        presets: {
            shot?: string,
            view?: string,
            mood?: string
        },
        character?: CharacterProfile
    }): Promise<{ enhancedPrompt: string }> {
        const char = params.character || this.user?.savedCharacter;
        let charInfo = "A person";
        if (char) {
            charInfo = `Identity: ${char.gender}, Hair: ${char.hairColor}, Eyes: ${char.eyeColor}, Face: ${char.faceStyle}. Identical face to reference.`;
        }

        const variationDirectives = [
            params.presets.shot,
            params.presets.view,
            params.presets.mood
        ].filter(Boolean).join(", ");

        const systemInstructions = `You are a professional Creative Director. Your task is to generate ONLY a minimalist framing and camera directive for an AI image variation.
RULES:
1. OUTPUT: Only a few framing/camera keywords (e.g. "close-up shot", "wide angle view from distance", "profile side view").
2. NO DESCRIPTION: Do NOT describe the person, the outfit, or the scene.
3. NO FULL SENTENCES: Output only keywords.

Variation Directives requested: ${variationDirectives}`;

        const response = await fetch('/api/ai/enhance-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: params.originalPrompt,
                systemInstructions,
                character: char
            })
        });

        if (!response.ok) throw new Error("Variation enhancement failed.");
        const data = await response.json();
        return { enhancedPrompt: data.enhancedPrompt };
    }
}
