import { ScenePlan, SceneState } from '../types';
import { ConstraintEngine } from './ConstraintEngine';

export class DirectorInterpreter {
    /**
     * Maps user/director UI selections into a ScenePlan update.
     */
    static interpret(state: SceneState, selections: any): Partial<ScenePlan> {
        const updates: Partial<ScenePlan> = {};

        if (selections.composition) updates.composition = selections.composition;
        if (selections.angle) updates.cameraAngle = selections.angle;
        if (selections.mood) updates.emotionalGoal = selections.mood;
        if (selections.lighting) updates.lightingPlan = selections.lighting;

        // Validation against locks and transition rules
        const validation = ConstraintEngine.validateTransition(state, updates);
        if (!validation.allowed) {
            console.warn(`[DirectorInterpreter] Transition REJECTED: ${validation.reason}`);
            throw new Error(`Illegal Transition: ${validation.reason}`);
        }

        return updates;
    }
}
