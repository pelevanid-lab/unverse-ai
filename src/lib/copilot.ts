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
import { UserProfile, AIGenerationLog, CharacterProfile, AIPreference, OnboardingState, CreatorMedia } from './types';
import { processAiCreatorActivation, processAiCreatorGeneration } from './ledger';

export class Copilot {
    private userId: string;
    private user: UserProfile | null = null;

    constructor(userId: string) {
        this.userId = userId;
    }

    /**
     * Initializes the Copilot by fetching user profile and current learning state.
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
    }): Promise<{ enhancedPrompt: string, originalPrompt: string, negativePrompt?: string }> {
        
        // DISABLE memory to clear hallucinations for for current triage
        const memoryContext = ""; 
        const negativeMemoryContext = "";
        
        // Character context construction (Persona Upgrade)
        const char = params.character || this.user?.savedCharacter;
        let charInfo = "A person";
        if (char) {
            charInfo = `Identity: ${char.gender}, Hair: ${char.hairColor}, Eyes: ${char.eyeColor}, Face: ${char.faceStyle}. Always maintain this EXACT identity.`;
            if (char.persona_prompt) charInfo += ` Persona Context: ${char.persona_prompt}`;
        }

        const systemInstructions = `You are a professional Prompt Engineer. Expand the user input into a photorealistic, high-quality 50-word AI image prompt.
STRICT CONSTRAINTS:
- DO NOT change the core user intent.
- DO NOT introduce new subjects, characters, or objects not mentioned by the user.
- DO NOT alter the meaning of the request.
- ONLY improve clarity, detail, composition, and visual quality.
- CHARACTER CONSISTENCY: Enforce a single subject ONLY. Same identity as defined below. No multiple people in output.
- IDENTITY DRIFT: Ensure the face and features are identical to previous generations.

User Input: "${params.userInput}"
Character: ${charInfo}
Style/Atmosphere: ${params.style || 'natural'}
Shot Type: ${params.composition || 'solo'}
${params.isEditMode ? 'IMPORTANT: This is an EDIT request. Preserve the subject identity perfectly. Focus ONLY on changing the background or specific elements requested.' : ''}

${memoryContext}

Output ONLY the final prompt text. If the AI output tries to add people or change subjects, OVERRIDE and fix it to maintain consistency.`;

        // Call the central Gemini API (re-using the existing route logic via fetch)
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
                negativeContext: negativeMemoryContext // Added negativeContext here
            })
        });

        if (!response.ok) {
            throw new Error("Copilot couldn't enhance the prompt.");
        }

        const data = await response.json();
        return {
            enhancedPrompt: data.enhancedPrompt,
            originalPrompt: params.userInput,
            negativePrompt: negativeMemoryContext
        };
    }

    /**
     * Smart Flow: Generates creative social media content based on an image.
     */
    async generateContainerCopy(params: {
        imageUrl: string,
        contentType: 'public' | 'premium' | 'limited',
        originalPrompt?: string
    }) {
        const memoryContext = await this.getMemoryContext();
        const systemInstructions = `Generate a catchy, professional social media caption for this AI-generated image.
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
                return { action: 'first_generate', message: "Step 1: Create your first AI visual using Copilot's smart flow.", cta: "Hayal Et" };
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
    async generateTags(prompt: string, contentType?: string): Promise<string[]> {
        try {
            const hasPersona = !!this.user?.savedCharacter;
            const response = await fetch('/api/ai/enhance-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    systemInstructions: `Generate 7 relevant, one-word hashtags (without #) for this image. 
                    Include tags for: niche, visual style, content type (${contentType || 'public'}), and persona (${hasPersona ? 'consistent' : 'new'}). 
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
    async generateDailyDraft(): Promise<string> {
        const now = Date.now();
        if (!this.user?.aiCreatorModeExpiresAt || this.user.aiCreatorModeExpiresAt < now) {
            throw new Error("AI Copilot subscription is inactive or expired.");
        }
        
        // Check 24h limit
        const lastRun = this.user?.aiCreatorModeLastRunAt || 0;
        if (now - lastRun < 24 * 60 * 60 * 1000) {
            throw new Error("Already generated a draft today.");
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
        const response = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: enhancement.originalPrompt,
                enhancedPrompt: enhancement.enhancedPrompt,
                negativePrompt: enhancement.negativePrompt,
                userId: this.userId,
                cost: 0 // Payment already handled above
            })
        });

        if (!response.ok) throw new Error("Daily generation failed at API level.");
        const data = await response.json();

        // 5. Save to Creator Media as DRAFT
        const mediaDoc = await addDoc(collection(db, 'creator_media'), {
            creatorId: this.userId,
            mediaUrl: data.mediaUrl,
            mediaType: 'image',
            status: 'draft',
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
}
