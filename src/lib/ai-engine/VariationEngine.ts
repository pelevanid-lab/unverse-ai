import { SceneState, ScenePlan, CharacterProfile } from '../types';
import { DirectorInterpreter } from './DirectorInterpreter';
import { ConstraintEngine } from './ConstraintEngine';
import { PromptComposer } from './PromptComposer';
import { SceneStateManager } from './SceneStateManager';
import { SceneBrainEngine } from './SceneBrainEngine';

export class VariationEngine {
    /**
     * Orchestrates a state-based scene variation.
     */
    static async generateVariation(sceneId: string, directorSelections: any, character?: CharacterProfile): Promise<{ prompt: string; newState: SceneState }> {
        // 1. Load Current State
        const state = await SceneStateManager.getSceneState(sceneId);
        if (!state) throw new Error(`SceneState ${sceneId} not found.`);

        // 2. Interpret & Validate
        const planUpdates = DirectorInterpreter.interpret(state, directorSelections);
        
        // 3. Update Scene Plan
        const updatedPlan: ScenePlan = {
            ...state.scene_plan,
            ...planUpdates
        };

        // 4. Validate Final Plan (Optional redundancy)
        const validation = ConstraintEngine.validateTransition(state, updatedPlan);
        if (!validation.allowed) {
            throw new Error(`Constraint Validation Failed: ${validation.reason}`);
        }

        // 5. Compose New Prompt FROM PLAN
        const finalPrompt = PromptComposer.compose(updatedPlan, character);

        // 6. Persist Updated State
        const newState: SceneState = {
            ...state,
            scene_plan: updatedPlan,
            updatedAt: Date.now()
        };
        await SceneStateManager.updateSceneState(sceneId, newState);

        return { prompt: finalPrompt, newState };
    }
}
