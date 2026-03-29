import { SceneState, ScenePlan } from '../types';

export class ConstraintEngine {
    /**
     * Validates a transition based on current locked elements and transition rules.
     */
    static validateTransition(state: SceneState, updates: Partial<ScenePlan>): { allowed: boolean; reason?: string } {
        const locks = state.locked_elements;

        // 1. Identity Lock (Absolute)
        if (locks.identity && updates.focalPoint && updates.focalPoint !== state.scene_plan?.focalPoint) {
            // Some focal point changes might be allowed, but face change is never allowed
        }

        // 2. Outfit Lock
        if (locks.outfit && updates.outfit && updates.outfit !== state.scene_plan?.outfit) {
            return { allowed: false, reason: 'Clothing is LOCKED for this photoshoot.' };
        }

        // 3. Environment Lock
        if (locks.environment && updates.sceneType && updates.sceneType !== state.scene_plan?.sceneType) {
            return { allowed: false, reason: 'Environment is LOCKED for this photoshoot.' };
        }

        // 4. Advanced Transition Rules (Scene Family)
        if (updates.composition || updates.cameraAngle) {
            const isIllegal = this.checkIllegalTransitions(state.scene_plan, updates);
            if (isIllegal.rejected) {
                return { allowed: false, reason: isIllegal.reason };
            }
        }

        return { allowed: true };
    }

    /**
     * Prevents logic breaks like standing -> sitting in a variation without explicit unlock.
     */
    private static checkIllegalTransitions(current: ScenePlan, updates: Partial<ScenePlan>): { rejected: boolean; reason?: string } {
        // Example: If current is 'standing' and update is 'sitting'
        if (current.composition?.includes('standing') && updates.composition?.includes('sitting')) {
             return { rejected: true, reason: 'Cannot transition from STANDING to SITTING in a variation (Pose is locked).' };
        }
        
        // Example: Angle shifts that are too extreme for the same photoshoot
        if (current.cameraAngle === 'front' && updates.cameraAngle === 'back') {
            return { rejected: true, reason: '180 degree camera flip is too extreme for a variation.' };
        }

        return { rejected: false };
    }
}
