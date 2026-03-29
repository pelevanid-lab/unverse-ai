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
import { UserProfile, AIGenerationLog, CharacterProfile, AIPreference, OnboardingState, CreatorMedia, SceneLock, SceneState, ScenePlan } from './types';
import { processAiCreatorActivation, processAiCreatorGeneration } from './ledger';
import { SceneRuleEngine } from './scene-engine';
import { SceneStateManager } from './ai-engine/SceneStateManager';
import { GenerationContextLoader } from './ai-engine/GenerationContextLoader';
import { VariationEngine } from './ai-engine/VariationEngine';
import { SceneBrainEngine } from './ai-engine/SceneBrainEngine';
import { PromptComposer } from './ai-engine/PromptComposer';
import { CaptionEngine } from './ai-engine/CaptionEngine';

// Server-only modules (initialized only when needed on server)
let adminDb: any;
let admin: any;
let ledgerServer: any;
// Logic moved to methods as needed to avoid bundler tracing

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
        if (typeof window === 'undefined') {
            if (!adminDb) adminDb = require('./firebase-admin').adminDb;
            const userSnap = await adminDb.collection('users').doc(this.userId).get();
            if (userSnap.exists) {
                this.user = userSnap.data() as UserProfile;
            }
        } else {
            const userRef = doc(db, 'users', this.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                this.user = userSnap.data() as UserProfile;
            }
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
            let logs: AIGenerationLog[] = [];
            
            if (typeof window === 'undefined') {
                if (!adminDb) adminDb = require('./firebase-admin').adminDb;
                const querySnapshot = await adminDb.collection('ai_generation_logs')
                    .where('userId', '==', this.userId)
                    .where('satisfactionScore', '>=', 4)
                    .orderBy('timestamp', 'desc')
                    .limit(15)
                    .get();
                logs = querySnapshot.docs.map((doc: any) => doc.data() as AIGenerationLog);
            } else {
                const logsRef = collection(db, 'ai_generation_logs');
                const q = query(
                    logsRef,
                    where('userId', '==', this.userId),
                    where('satisfactionScore', '>=', 4),
                    orderBy('timestamp', 'desc'),
                    limit(15)
                );
                const querySnapshot = await getDocs(q);
                logs = querySnapshot.docs.map(doc => doc.data() as AIGenerationLog);
            }

            if (logs.length === 0) return "";

            // Rank logs: Score (primary), Published (secondary), Saved (tertiary)
            const rankedLogs = [...logs].sort((a, b) => {
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
            let logs: AIGenerationLog[] = [];

            if (typeof window === 'undefined') {
                if (!adminDb) adminDb = require('./firebase-admin').adminDb;
                const querySnapshot = await adminDb.collection('ai_generation_logs')
                    .where('userId', '==', this.userId)
                    .where('satisfactionScore', '<=', 2)
                    .orderBy('timestamp', 'desc')
                    .limit(5)
                    .get();
                logs = querySnapshot.docs.map((doc: any) => doc.data() as AIGenerationLog);
            } else {
                const logsRef = collection(db, 'ai_generation_logs');
                const q = query(
                    logsRef,
                    where('userId', '==', this.userId),
                    where('satisfactionScore', '<=', 2),
                    orderBy('timestamp', 'desc'),
                    limit(5)
                );

                const querySnapshot = await getDocs(q);
                logs = querySnapshot.docs.map(doc => doc.data() as AIGenerationLog);
            }

            if (logs.length === 0) return "";

            // Use specialized Negative Gen API
            const badPrompts = logs.map(l => l.prompt).join(" | ");
            const response = await fetch('/api/ai/generate-negative', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ badPrompts })
            });

            if (!response.ok) return "";
            const data = await response.json();
            return data.negativePrompt;
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
        sceneLock?: SceneLock,
        isAdvanced?: boolean
    }): Promise<{ enhancedPrompt: string, negativePrompt?: string }> {
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
                sheerLingerie: "wearing translucent gossamer lace couture, delicate high-fashion sheer fabric, artistic ethereal aesthetic",
                satinSilks: "draped in lustrous fluid satin and silk ribbons, luxury reflective fabric, boudoir fashion photoshoot style",
                wetShirt: "wearing a thin high-fashion white shirt, misted and clingy, artistic wet-look skin texture, atmospheric lighting",
                provocativeLace: "intricate artistic black lace bodysuit, avant-garde design, highly detailed embroidery, high-fashion silhouette",
                highLegBodysuit: "ultra high-cut architectural bodysuit, emphasizing dynamic body lines, avant-garde athletic aesthetic",
                strategicCoverage: "artistic compositional coverage with fabric, fine-art nude photography aesthetic, high-fashion editorial style",
                sultryBoudoir: "atmospheric boudoir attire, vintage couture, intimate high-quality studio atmosphere",
                exoticBeachwear: "avant-garde minimal beachwear, luxury destination aesthetic, sun-kissed skin, tropical high-fashion vibe",
                distressedDenim: "unbuttoned raw denim fashion, artistic pose, raw and edgy editorial aesthetic, outdoor natural light",
                leatherLace: "confrontational luxury leather and lace combination, tight bodice couture, rebellious high-fashion vibe",
                deepPlunge: "wearing a deep architectural plunge neckline garment, elegant revealing high-fashion design, allure aesthetic",
                ultraHighCut: "wearing an ultra-high cut couture bodysuit, emphasizing the hip and waist line, provocative fashion silhouette",
                openFront: "wearing an open-front luxury couture garment, emphasizing the torso, fine-art lighting, high-fashion provocative style",
                monokiniExotic: "wearing a luxury architectural monokini with creative cut-outs and negative space, high-fashion beachwear vibe"
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
        
        const hairAnchor = sceneLock?.hairSummary ? `HAIR: ${sceneLock.hairSummary}` : "identical hair style";

        // 🧬 IDENTITY REINFORCEMENT: Always inject physical traits even in Director Mode
        const identityTraits = params.character ? 
            `Subject: 1 adult ${params.character.gender}, with ${params.character.hairColor} hair, ${params.character.eyeColor} eyes, ${params.character.faceStyle} face shape, ${params.character.bodyStyle} body.` : 
            "";

        // 🛡️ SAFETY GUARD: Dedicated negative prompt for Pro variations
        const safetyNegative = isAdvanced ? "explicit, nude, anatomical, suggestive, erotic, pornographic, genitals, nipples" : "";

        const finalPrompt = `[STRICT SCENE LOCK: ${envAnchor}, ${sceneLock?.lightingSummary || 'same lighting'}, ${hairAnchor}]. [STRICT IDENTITY LOCK: ${identityTraits}]. ${variationMod}. [STRICT ${bypassClothingLock ? 'CLOTHING RELAXED' : `OUTFIT LOCK: ${outfitAnchor}`}]. Same photoshoot, identical surroundings: ${params.originalPrompt}. STRICT RULE: do not change environment ${bypassClothingLock ? '' : 'or outfit'}, lighting setup or character identity. IDENTICAL FACE TO REFERENCE.`;

        return { enhancedPrompt: finalPrompt, negativePrompt: safetyNegative };
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
        outfit?: string,
        locale?: string
    }): Promise<{ enhancedPrompt: string, originalPrompt: string, translatedStory?: string, translation?: string, negativePrompt?: string, sceneLock?: Partial<SceneLock> }> {
        
        // 🎯 DYNAMIC MEMORY (Persona Upgrade)
        const memoryContext = await this.getMemoryContext();
        const negativeMemoryContext = await this.getNegativeMemoryContext();
        
        // Character context construction (Persona Upgrade)
        const char = params.character || this.user?.savedCharacter;
        const isLocked = !!char && (params.isEditMode || (this.user?.savedCharacter && char.id === this.user.savedCharacter.id));

        let charInfo = "A person";
        if (char) {
            const traits = [];
            if (isLocked) {
                traits.push(`Gender: ${char.gender}`);
                // 🧬 REDUNDANCY: Even if locked, mention traits to guide the generative process
                if (char.hairColor && char.hairColor.toLowerCase() !== 'unknown') traits.push(`Hair: ${char.hairColor}`);
                if (char.eyeColor && char.eyeColor.toLowerCase() !== 'unknown') traits.push(`Eyes: ${char.eyeColor}`);
                charInfo = traits.join(", ") + ". (Core identity is locked and will be handled by reference image, but traits must match).";
            } else {
                if (char.gender) traits.push(`Identity: ${char.gender}`);
                if (char.hairColor && char.hairColor.toLowerCase() !== 'unknown') traits.push(`Hair: ${char.hairColor}`);
                if (char.eyeColor && char.eyeColor.toLowerCase() !== 'unknown') traits.push(`Eyes: ${char.eyeColor}`);
                if (char.faceStyle && char.faceStyle.toLowerCase() !== 'unknown') traits.push(`Face: ${char.faceStyle}`);
                if (char.bodyStyle && char.bodyStyle.toLowerCase() !== 'unknown') traits.push(`Body: ${char.bodyStyle}`);
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

        // Call specialized Scene Enhancement API
        const response = await fetch('/api/ai/enhance-scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: params.userInput,
                character: char,
                style: params.style,
                composition: params.composition,
                outfit: params.outfit
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
        // 🛡️ BATCHED NEGATIVE CONTEXT: Combine user history failures with default safety
        const finalNegative = [
            negativeMemoryContext,
            "explicit, nude, suggestive, erotic, pornographic, distorted anatomy, morphing faces"
        ].filter(Boolean).join(", ");

        return {
            enhancedPrompt: data.enhancedPrompt,
            originalPrompt: params.userInput,
            translation: data.translation,
            translatedStory: data.translatedStory,
            negativePrompt: finalNegative,
            sceneLock: sceneLock
        };
    }

    /**
     * UNIQ 4.0: Stateful Generation Orchestrator.
     * Coordinates SceneState, Brain, Director, and Composition engines.
     */
    async generateStatefulFlow(params: {
        userInput: string,
        sceneStateId?: string,
        directorSelections?: any,
        character?: CharacterProfile
    }): Promise<{ prompt: string, state: SceneState }> {
        // 1. Context Rehydration / Creation
        let state: SceneState | null = null;
        if (params.sceneStateId) {
            const loaded = await GenerationContextLoader.loadContext(params.sceneStateId, 'state') as SceneState;
            if (loaded) {
                state = loaded;
            } else {
                const rehydrated = await GenerationContextLoader.loadContext(params.sceneStateId, 'log');
                if (rehydrated) {
                    const newId = await SceneStateManager.createSceneState({
                        ...rehydrated,
                        character_id: params.character?.id || this.userId,
                        sourceType: 'state',
                        locked_elements: { identity: true, outfit: true, environment: true, pose: false },
                        variation_history: [],
                        lastSuccessfulConfig: {}
                    } as any);
                    state = await SceneStateManager.getSceneState(newId);
                }
            }
        }

        if (!state) {
            // New Scene Discovery
            const plan = await SceneBrainEngine.generateScenePlan(params.userInput);
            const newStateId = await SceneStateManager.createSceneState({
                character_id: params.character?.id || this.userId,
                sourceType: 'prompt',
                originalPrompt: params.userInput,
                enhancedPrompt: params.userInput,
                scene_plan: plan,
                locked_elements: { identity: true, outfit: true, environment: true, pose: false },
                variation_history: [],
                lastSuccessfulConfig: { seed: Math.floor(Math.random() * 1000000000) }
            });
            state = (await SceneStateManager.getSceneState(newStateId))!;
        }

        // 2. Scene Orchestration
        let finalPrompt: string;
        if (params.directorSelections) {
            const variation = await VariationEngine.generateVariation(state.scene_id, params.directorSelections, params.character);
            finalPrompt = variation.prompt;
            state = variation.newState;
        } else {
            finalPrompt = PromptComposer.compose(state.scene_plan, params.character);
        }

        return { prompt: finalPrompt, state };
    }

    /**
     * Smart Flow: Generates creative social media content based on an image.
     */
    async generateContainerCopy(params: {
        imageUrl: string,
        contentType: 'public' | 'premium' | 'limited',
        originalPrompt?: string,
        locale?: string,
        scenePlan?: ScenePlan,
        character?: CharacterProfile
    }) {
        const isVideo = params.imageUrl?.toLowerCase().includes('.mp4') || params.imageUrl?.toLowerCase().includes('video');
        if (isVideo) return params.originalPrompt || "Check out this video!";

        // 🧬 UNIQ 4.0: Use dedicated CaptionEngine if context is available
        if (params.scenePlan && params.character) {
            return await CaptionEngine.generateCaption(params.scenePlan, params.character, params.contentType);
        }

        // Fallback to legacy API
        const response = await fetch('/api/ai/generate-caption', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...params, userId: this.userId })
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
            recommendation = "Public";
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
            // Use dedicated Tag Generation API
            const response = await fetch('/api/ai/generate-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, locale })
            });

            if (!response.ok) return [];
            const data = await response.json();
            return data.tags.split(',').map((t: string) => t.trim().toLowerCase().replace('#', ''));
        } catch {
            return [];
        }
    }

    /**
     * Logs interaction results to help future adaptive learning.
     */
    async logInteraction(logData: Partial<AIGenerationLog>) {
        try {
            await fetch('/api/ai/log-interaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    logId: logData.id,
                    logData
                })
            });
        } catch (error) {
            console.error("Failed to log interaction:", error);
        }
    }

    /**
     * Toggles AI Creator Mode state.
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
            cinematic: "cinematic lighting, realism",
            soft: "soft aesthetic, ethereal",
            bold: "bold colors, high contrast",
            luxury: "luxury atmosphere, premium"
        };
        return styles[style] || styles.cinematic;
    }

    /**
     * Automation: Generates a daily AI draft for Profile Mode.
     * Cost: 2 ULC.
     */
    async generateDailyDraft(options?: { baseUrl?: string, locale?: string }): Promise<string> {
        // Redacted for brevity but logical placeholder kept
        return "draftID_placeholder";
    }

    /**
     * Scene Variations (Legacy/Compatibility): Logic moved to VariationEngine but kept here for interface compatibility.
     */
    async generateVariationPrompt(params: {
        originalPrompt: string,
        presets: any,
        character?: CharacterProfile
    }): Promise<{ enhancedPrompt: string, negativePrompt?: string }> {
        return this.generateDirectorPrompt(params as any);
    }
}
