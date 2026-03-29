import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SceneState, AIGenerationLog, CharacterProfile } from '../types';

let adminDb: any;

export class GenerationContextLoader {
    private static getDb() {
        if (typeof window === 'undefined') {
            if (!adminDb) adminDb = require('../firebase-admin').adminDb;
            return adminDb;
        }
        return db;
    }

    /**
     * Rehydrates a SceneState from a previous generation log or an existing state.
     */
    static async loadContext(id: string, type: 'log' | 'state'): Promise<Partial<SceneState> | null> {
        const database = this.getDb();

        if (type === 'state') {
            if (typeof window === 'undefined') {
                const snap = await database.collection('scene_states').doc(id).get();
                return snap.exists ? (snap.data() as SceneState) : null;
            }
            const docRef = doc(database as any, 'scene_states', id);
            const snap = await getDoc(docRef);
            return snap.exists() ? (snap.data() as SceneState) : null;
        } else {
            if (typeof window === 'undefined') {
                const snap = await database.collection('ai_generation_logs').doc(id).get();
                if (!snap.exists) return null;
                const log = snap.data() as AIGenerationLog;
                return this.mapLogToContext(id, log);
            }
            const docRef = doc(database as any, 'ai_generation_logs', id);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return null;

            const log = snap.data() as AIGenerationLog;
            return this.mapLogToContext(id, log);
        }
    }

    private static mapLogToContext(id: string, log: AIGenerationLog): Partial<SceneState> {
        return {
            originalPrompt: log.prompt,
            enhancedPrompt: log.enhancedPrompt,
            referenceImageUrl: log.mediaUrl,
            parentGenerationId: id,
            scene_plan: log.sceneLock ? this.mapSceneLockToPlan(log.sceneLock) : undefined,
            lastSuccessfulConfig: {
                seed: log.seed,
                sceneType: log.sceneType
            }
        };
    }

    /**
     * Fallback: Analyzes an image to extract context if no records exist.
     * (Interface only for now, would call Gemini Vision API in production)
     */
    static async analyzeImageToContext(imageUrl: string): Promise<Partial<SceneState>> {
        console.log(`[ContextLoader] Analyzing image: ${imageUrl}`);
        // This would be an API call to Gemini Vision
        return {
            sourceType: 'image',
            referenceImageUrl: imageUrl,
            // placeholders
        };
    }

    /**
     * Helper to map old SceneLock (Digital Twin 2.0) to new ScenePlan (Uniq 4.0)
     */
    private static mapSceneLockToPlan(lock: any): any {
        return {
            sceneType: lock.sceneType || 'other',
            composition: lock.baseComposition || 'medium',
            lightingPlan: lock.lightingSummary || 'standard',
            environment: lock.environmentSummary || 'unknown',
            outfit: lock.outfitSummary || 'unknown',
            // Default mappings for missing fields
            emotionalGoal: 'consistent atmosphere',
            cameraAngle: 'front',
            framing: 'standard',
            focalPoint: 'subject',
            visualHierarchy: 'subject priority',
            continuityRules: 'maintain background and clothing',
            riskFactors: 'none',
            allowedVariationAxes: lock.allowedVariationTypes || []
        };
    }
}
