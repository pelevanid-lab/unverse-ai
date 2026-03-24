import { SceneLock } from './types';

export type SceneType = SceneLock['sceneType'];

export class SceneRuleEngine {
    static detectSceneType(prompt: string): SceneType {
        const lower = prompt.toLowerCase();
        if (lower.includes('beach') || lower.includes('ocean') || lower.includes('sand') || lower.includes('sea side')) return 'beach';
        if (lower.includes('jet') || lower.includes('airplane') || lower.includes('cabin') || lower.includes('private jet')) return 'jet';
        if (lower.includes('bedroom') || lower.includes('bed') || lower.includes('pillow')) return 'bedroom';
        if (lower.includes('city') || lower.includes('street') || lower.includes('urban') || lower.includes('night city')) return 'city_night';
        if (lower.includes('yacht') || lower.includes('boat') || lower.includes('deck')) return 'yacht';
        if (lower.includes('studio') || lower.includes('backdrop') || lower.includes('flash')) return 'studio';
        if (lower.includes('forest') || lower.includes('mountain') || lower.includes('nature') || lower.includes('park')) return 'nature';
        if (lower.includes('indoor') || lower.includes('room') || lower.includes('office') || lower.includes('house')) return 'indoor';
        return 'other';
    }

    static generateSceneLock(prompt: string, sceneType: SceneType, extractedDNA?: Partial<SceneLock>): SceneLock {
        const rules: Record<SceneType, Partial<SceneLock>> = {
            beach: {
                allowedVariationTypes: ['composition', 'angle', 'mood'],
                riskyVariationTypes: ['action'],
                intensity: 'low'
            },
            jet: {
                allowedVariationTypes: ['composition', 'angle', 'mood', 'action'],
                riskyVariationTypes: [],
                intensity: 'medium'
            },
            bedroom: {
                allowedVariationTypes: ['composition', 'mood'],
                riskyVariationTypes: ['angle', 'action'],
                intensity: 'low'
            },
            city_night: {
                allowedVariationTypes: ['composition', 'angle', 'mood', 'action'],
                riskyVariationTypes: [],
                intensity: 'medium'
            },
            yacht: {
                allowedVariationTypes: ['composition', 'angle', 'mood'],
                riskyVariationTypes: ['action'],
                intensity: 'low'
            },
            studio: {
                allowedVariationTypes: ['composition', 'angle', 'mood', 'action', 'lighting'],
                riskyVariationTypes: [],
                intensity: 'high'
            },
            nature: {
                allowedVariationTypes: ['composition', 'angle', 'mood'],
                riskyVariationTypes: ['action'],
                intensity: 'medium'
            },
            indoor: {
                allowedVariationTypes: ['composition', 'angle', 'mood', 'action'],
                riskyVariationTypes: [],
                intensity: 'medium'
            },
            other: {
                allowedVariationTypes: ['composition', 'angle', 'mood'],
                riskyVariationTypes: ['action', 'lighting'],
                intensity: 'medium'
            }
        };

        const baseRules = rules[sceneType] || rules.other;

        return {
            sceneType,
            environmentSummary: extractedDNA?.environmentSummary || "extracted from base prompt",
            outfitSummary: extractedDNA?.outfitSummary || "extracted from base prompt",
            lightingSummary: extractedDNA?.lightingSummary || "extracted from base prompt",
            propSummary: extractedDNA?.propSummary || "extracted from base prompt",
            baseComposition: "medium",
            allowedVariationTypes: baseRules.allowedVariationTypes!,
            riskyVariationTypes: baseRules.riskyVariationTypes!,
            intensity: baseRules.intensity as any
        };
    }

    static getSafeModifiers(sceneLock: SceneLock, requestedPresets: any): any {
        const safePresets = { ...requestedPresets };
        
        // Intensity check: if intensity is low, we might want to "mute" high-impact movements
        if (sceneLock.intensity === 'low') {
            if (safePresets.composition === 'wide') safePresets.composition = 'medium';
            if (safePresets.action === 'walking') safePresets.action = 'still';
        }

        // Scene-specific restrictions
        if (sceneLock.sceneType === 'beach') {
            // Beach is very sensitive to angle shifts (BG changes too much)
            if (safePresets.angle === 'back' || safePresets.angle === 'low_angle') {
                safePresets.angle = 'front';
            }
        }

        return safePresets;
    }
}
