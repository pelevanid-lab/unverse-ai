import { CriticResult, ScenePlan } from '../types';

export class RetryEngine {
    private static MAX_RETRIES = 2; // 🧬 Reduced for Phase 17 Stabilization (Fast Iteration)

    /**
     * Decides whether to retry and how to adjust the ScenePlan and parameters.
     */
    static shouldRetry(retryCount: number, criticResult: CriticResult, currentPlan: ScenePlan): { retry: boolean; adjustedPlan?: ScenePlan; adjustedParams?: any } {
        if (retryCount >= this.MAX_RETRIES || !criticResult.retryRecommended) {
            return { retry: false };
        }

        const adjustments: any = {};
        const adjustedPlan = { ...currentPlan };
        // 1. STYLE BIAS DETECTION (Anti-Beauty)
        const isBeautyBias = (criticResult.moodScore || 1.0) < 0.7 || (criticResult.lightingAccuracyScore || 1.0) < 0.7 || (criticResult.expressionAccuracyScore || 1.0) < 0.7;
        const issuesList = (criticResult.issues || []);
        const issuesText = issuesList.join(' ').toLowerCase();

        if (isBeautyBias) {
            console.warn(`[STYLE BIAS] Detected generic aesthetic bias. Escalating style enforcement.`);
            if ((criticResult.moodScore || 1.0) < 0.7 || issuesText.includes('smile') || issuesText.includes('smiling')) {
                adjustments.expression_fix = "STRICT NO SMILING, MANDATORY SERIOUS/NEUTRAL EXPRESSION, NO BEAUTY BIAS";
            }
            if ((criticResult.lightingAccuracyScore || 1.0) < 0.7 || issuesText.includes('soft') || issuesText.includes('light')) {
                adjustments.lighting_refinement = "STRICT HIGH CONTRAST, DEEP DIRECTIONAL SHADOWS, NO SOFT LIGHTING, CHIAROSCURO ENFORCED";
            }
        }

        // 2. PORTRAIT BIAS DETECTION (Hard Guard)
        const isPortraitBias = issuesText.includes('too tight') || issuesText.includes('too close') || issuesText.includes('face only') || issuesText.includes('cropping') || issuesText.includes('portrait framing');

        // 3. IDENTITY & COLOR FIXES
        if ((criticResult.identityScore || 0) < 0.7 || issuesText.includes('hair') || issuesText.includes('eyes')) {
            adjustments.id_weight_boost = 0.1 * (retryCount + 1);
            adjustments.guidance_scale_boost = 1.0;
            
            // 🎨 COLOR REINFORCEMENT (Phase 20)
            if (issuesText.includes('hair') || (criticResult.identityScore || 0) < 0.7) {
                adjustments.color_correction = "MANDATORY STRIKING VIVID SATURATED HAIR COLOR, NO COLOR DRIFT, PRESERVE VIBRANCY";
            }
        }

        // 4. DETERMINISTIC STRUCTURAL FIXES
        if (issuesText.includes('hands') || (currentPlan.needsHandsVisible && !criticResult.handsVisible)) {
            adjustedPlan.framing = 'medium shot';
            adjustedPlan.bodyVisibilityLevel = 'upper_torso';
            adjustedPlan.needsHandsVisible = true;
            adjustedPlan.hardConstraints = [...(adjustedPlan.hardConstraints || []), "HANDS MUST BE FULLY VISIBLE IN FRAME"];
        }

        if (issuesText.includes('pose') || issuesText.includes('sitting') || issuesText.includes('standing')) {
            adjustedPlan.framing = 'medium-full shot';
            adjustedPlan.bodyVisibilityLevel = 'full_body';
            adjustedPlan.needsPoseVisible = true;
            adjustedPlan.hardConstraints = [...(adjustedPlan.hardConstraints || []), "FULL BODY POSE MUST BE VISIBLE", "NO TIGHT CROPPING"];
        }

        // ⚠️ ATTEMPT-SPECIFIC ESCALATION (The Enforcer)
        if (retryCount === 0) { // Transitioning to 2nd attempt
            console.log("[RETRY] Level 1: Contextual Enforcement");
            if (isPortraitBias && currentPlan.needsHandsVisible) {
                adjustedPlan.framing = 'wide medium shot';
                adjustedPlan.hardConstraints = [...(adjustedPlan.hardConstraints || []), "STRICT WIDE FRAMING", "NO CLOSE-UP"];
            }
        }

        if (retryCount === 1) { // Transitioning to 3rd (Final) attempt
            console.log("[RETRY] Level 2: Aggressive Style & Framing Override");
            adjustedPlan.framing = 'full wide shot';
            adjustedPlan.cameraAngle = 'low angle'; 
            adjustments.lighting_refinement = "ULTRA HIGH CONTRAST, HARSH CINEMATIC SHADOWS, ANTI-BEAUTY LIGHTING";
            adjustments.aesthetic_suppression = "TRUE";
            adjustedPlan.hardConstraints = ["MANDATORY STYLE OVERRIDE", "FORCE CINEMATIC REALISM", "DISABLE BEAUTY OPTIMIZATION"];
        }

        return {
            retry: true,
            adjustedPlan,
            adjustedParams: adjustments
        };
    }
}
