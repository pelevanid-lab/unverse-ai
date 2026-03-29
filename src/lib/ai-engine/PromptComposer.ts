import { ScenePlan, CharacterProfile } from '../types';

export class PromptComposer {
    /**
     * Composes a final AI prompt from a ScenePlan and character profile with optional retry adjustments.
     */
    static compose(plan: ScenePlan, character?: CharacterProfile, adjustments?: any, selectedRoute: string = 'A'): string {
        const header = this.sanitize(this.buildSubjectHeader(character));
        const atmosphere = this.sanitize(this.buildAtmosphereAnchor(plan, character));
        const identity = this.sanitize(this.buildIdentityAnchor(character));
        const scene = this.sanitize(this.buildSceneAnchor(plan, adjustments, selectedRoute));
        const hardConstraints = this.sanitize(this.buildHardConstraintsAnchor(plan));
        
        // 🧬 DETERMINISTIC ADJUSTMENTS (Retry loop fixes)
        const fixAnchor = adjustments ? this.sanitize(this.buildFixAnchor(adjustments)) : '';

        // 🔄 PROMPT PRIORITY INVERSION (Phase 23 - Identity Anchor + Composition First)
        let finalPrompt = "";
        if (selectedRoute === 'B' || selectedRoute === 'D') {
            // [SUBJECT] + [SCENE] + [HARD] + [STYLE] + [IDENTITY]
            finalPrompt = `${header}. [SCENE: ${scene}]. [HARD CONSTRAINTS: ${hardConstraints}]. [STYLE DOMINANCE: ${atmosphere}]. [IDENTITY: ${identity}]. ${fixAnchor} Final Instruction: wide framing, environmental detail, cinematic realism.`;
        } else {
            // [SUBJECT] + [STYLE] + [SCENE] + [IDENTITY] + [HARD]
            finalPrompt = `${header}. [STYLE DOMINANCE: ${atmosphere}]. [SCENE: ${scene}]. [IDENTITY: ${identity}]. [HARD CONSTRAINTS: ${hardConstraints}]. ${fixAnchor} Final Instruction: maintain consistency, cinematic realism, 8k resolution.`;
        }
        
        return finalPrompt.replace(/\s+/g, ' ').trim();
    }

    private static buildSubjectHeader(character?: CharacterProfile): string {
        if (!character) return "";
        const hair = character.hairColor?.toLowerCase() === 'red' ? 'VIBRANT UNMISTAKABLE STRIKING RED' : character.hairColor;
        const eyes = character.eyeColor?.toLowerCase() === 'green' ? 'VIVID INTENSE GREEN' : character.eyeColor;
        return `[SUBJECT: 1 adult ${character.gender} with ${hair} hair and ${eyes} eyes]`;
    }

    private static sanitize(text: string): string {
        if (!text) return "";
        // 🛡️ Remove JSON braces, brackets, and markdown fences
        return text.replace(/\{|\}|\[|\]|```json|```/g, "").trim();
    }

    /**
     * Composes a dynamic negative prompt based on ScenePlan requirements.
     */
    static composeNegative(plan: ScenePlan, baseNegative: string): string {
        const enforcers: string[] = [];
        const visibility = (plan.requiredVisibility || []).join(' ').toLowerCase();

        // 🧬 AESTHETIC SUPPRESSION (Director Mode 6.0)
        enforcers.push("no soft beauty lighting, no glowing skin effect, no commercial beauty style, no generic stock photo look, no airbrushed face, no perfect symmetry beauty");

        if (visibility.includes('hands')) {
            enforcers.push("no cropped hands, no portrait-only framing, no tight face close-up, no hidden hands");
        }
        
        if (visibility.includes('pose') || visibility.includes('body')) {
            enforcers.push("no head-only shot, no zoomed face framing, no face-only focus, no tight crop");
        }

        const mood = (plan.emotionalGoal || "").toLowerCase();
        if (mood.includes('dramatic') || mood.includes('serious') || mood.includes('melancholic') || mood.includes('introspective')) {
            enforcers.push("no happy smile, no cheerful expression, no basic beauty look, no slight smile");
        }

        if (enforcers.length === 0) return baseNegative;

        return `${enforcers.join(', ')}, ${baseNegative}`;
    }

    private static buildHardConstraintsAnchor(plan: ScenePlan): string {
        if (!plan.hardConstraints || plan.hardConstraints.length === 0) return "standard composition";
        return plan.hardConstraints.map(c => c.toUpperCase() + " IS MANDATORY").join(". ");
    }

    private static buildFixAnchor(adjustments: any): string {
        const fixes: string[] = [];
        if (adjustments.lighting_refinement) fixes.push(`Correction: ${adjustments.lighting_refinement}`);
        if (adjustments.anatomy_fix) fixes.push(`Correction: reinforce natural human anatomy, perfect hands/limbs`);
        if (adjustments.shot_type_refinement) fixes.push(`Shot adjustment: ${adjustments.shot_type_refinement}`);
        if (adjustments.preferred_framing) fixes.push(`Shot correction: ${adjustments.preferred_framing}`);
        if (adjustments.color_correction) fixes.push(`Color correction: ${adjustments.color_correction}`);
        
        return fixes.length > 0 ? `[FIXES: ${fixes.join(', ')}].` : '';
    }

    private static buildIdentityAnchor(character?: CharacterProfile): string {
        if (!character) return "1 adult person";
        return `Subject: 1 adult ${character.gender}, with ${character.hairColor} hair, ${character.eyeColor} eyes, ${character.faceStyle} face shape, ${character.bodyStyle} body. IDENTICAL FACE TO REFERENCE.`;
    }

    private static buildSceneAnchor(plan: ScenePlan, adjustments?: any, selectedRoute: string = 'A'): string {
        const framing = adjustments?.preferred_framing || plan.framing;
        const visibility = (plan.requiredVisibility || []).length ? `Required visibility: ${plan.requiredVisibility?.join(', ')}` : '';
        const level = plan.bodyVisibilityLevel ? `Body visibility level: ${plan.bodyVisibilityLevel}` : '';
        
        // 🏗️ ENVIRONMENTAL REINFORCEMENT (Phase 23 - Identity Persistence)
        let reinforcement = "";
        if (selectedRoute === 'B' || selectedRoute === 'D') {
            reinforcement = " [STRUCTURAL ENFORCEMENT: upper body visible to waist, showing seated posture, visible furniture context, wide perspective, no headshot crop, VIVID DETAILED HAIR TEXTURE]";
        }

        return `${plan.composition}, ${plan.cameraAngle}, ${framing}.${reinforcement} ${visibility}. ${level}. Location: ${plan.sceneType}, focal point: ${plan.focalPoint}`;
    }

    private static buildAtmosphereAnchor(plan: ScenePlan, character?: CharacterProfile): string {
        const mood = (plan.emotionalGoal || "").toLowerCase();
        let moodEnforcement = "";
        
        if (mood.includes('dramatic') || mood.includes('introspective') || mood.includes('melancholic') || mood.includes('serious')) {
            moodEnforcement = " NO SMILING, SERIOUS EXPRESSION, NEUTRAL OR MELANCHOLIC FACE, NO BEAUTY SMILE.";
        }

        const lighting = (plan.lightingPlan || "").toLowerCase();
        let lightEnforcement = "";
        if (lighting.includes('chiaroscuro') || lighting.includes('cinematic') || lighting.includes('dramatic shadow') || lighting.includes('high contrast')) {
            lightEnforcement = " HIGH CONTRAST, STRONG DIRECTIONAL LIGHT, DEEP SHADOWS, LOW KEY LIGHTING, NOT SOFT LIGHTING, NOT EVENLY LIT.";
        }

        // 🧬 IDENTITY COLOR DOMINANCE (Phase 20)
        let colorEnforcement = "";
        if (character) {
            const hair = character.hairColor?.toLowerCase() === 'red' ? 'STRIKING VIVID RED' : character.hairColor;
            colorEnforcement = `PALETTE: ${hair} hair, ${character.eyeColor} eyes.`;
        }

        return `${colorEnforcement} Mood: ${plan.emotionalGoal}.${moodEnforcement} Lighting: ${plan.lightingPlan}.${lightEnforcement} Visual Hierarchy: ${plan.visualHierarchy}`;
    }
}
