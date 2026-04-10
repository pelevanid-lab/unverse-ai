import { db } from './firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

// ============================================================
// ⚖️ DIFFICULTY ENGINE
// Bitcoin Hashrate-Inspired Difficulty Scaling
// ============================================================

export interface DifficultyState {
    baseDifficulty: number;          // 1.0 always
    currentDifficulty: number;       // dynamically computed
    activeHunters: number;           // hunters in last 24h window
    totalChestsOpened: number;
    lastAdjustmentAt: number;
    adjustmentPeriod: number;        // every N chests opened
}

/**
 * Core difficulty formula (matches design doc):
 * difficulty = base × (1 + log₂(activeHunters / 10))
 *
 * Examples:
 *   10 hunters  → 1.0x
 *   100 hunters → 4.3x
 *   1000 hunters → 7.6x
 *   10000 hunters → 11.0x
 */
export function computeDifficulty(activeHunters: number, baseDifficulty = 1.0): number {
    if (activeHunters <= 0) return baseDifficulty;
    const raw = baseDifficulty * (1 + Math.log2(Math.max(1, activeHunters) / 10));
    return Math.max(1.0, parseFloat(raw.toFixed(3)));
}

/**
 * Translate raw difficulty into UI-facing descriptors and effects.
 */
export interface DifficultyProfile {
    level: 'novice' | 'apprentice' | 'scholar' | 'sage' | 'legend';
    label: string;
    multiplier: number;
    clueObfuscation: number;    // 0-1: how much clues are obscured
    trapChestPct: number;       // 0-1: chance of trap/fake chests
    timePressure: boolean;      // activates time-limited clues
    color: string;
}

export function getDifficultyProfile(difficulty: number): DifficultyProfile {
    if (difficulty < 2.0) {
        return { level: 'novice', label: 'Çırak', multiplier: difficulty, clueObfuscation: 0, trapChestPct: 0, timePressure: false, color: '#22c55e' };
    } else if (difficulty < 4.0) {
        return { level: 'apprentice', label: 'Bilge Adayı', multiplier: difficulty, clueObfuscation: 0.15, trapChestPct: 0.05, timePressure: false, color: '#3b82f6' };
    } else if (difficulty < 6.0) {
        return { level: 'scholar', label: 'Akademisyen', multiplier: difficulty, clueObfuscation: 0.35, trapChestPct: 0.15, timePressure: false, color: '#a855f7' };
    } else if (difficulty < 9.0) {
        return { level: 'sage', label: 'Bilge', multiplier: difficulty, clueObfuscation: 0.60, trapChestPct: 0.25, timePressure: true, color: '#f97316' };
    } else {
        return { level: 'legend', label: 'Efsane Avcı', multiplier: difficulty, clueObfuscation: 0.85, trapChestPct: 0.40, timePressure: true, color: '#ef4444' };
    }
}

// ============================================================
// FIRESTORE STATE MANAGEMENT
// ============================================================

export async function getDifficultyState(): Promise<DifficultyState> {
    const ref = doc(db, 'config', 'game_difficulty');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        return {
            baseDifficulty: 1.0,
            currentDifficulty: 1.0,
            activeHunters: 0,
            totalChestsOpened: 0,
            lastAdjustmentAt: Date.now(),
            adjustmentPeriod: 100,
        };
    }
    return snap.data() as DifficultyState;
}

/**
 * Called by server-side route when a chest is opened.
 * Recalculates difficulty every `adjustmentPeriod` chest openings.
 */
export async function onChestOpened(activeHunters: number): Promise<void> {
    const ref = doc(db, 'config', 'game_difficulty');
    const snap = await getDoc(ref);
    const state = snap.exists() ? (snap.data() as DifficultyState) : {
        baseDifficulty: 1.0,
        currentDifficulty: 1.0,
        activeHunters,
        totalChestsOpened: 0,
        lastAdjustmentAt: Date.now(),
        adjustmentPeriod: 100,
    };

    const newTotal = (state.totalChestsOpened || 0) + 1;
    // Recalculate every `adjustmentPeriod` chests
    if (newTotal % state.adjustmentPeriod === 0) {
        const newDifficulty = computeDifficulty(activeHunters, state.baseDifficulty);
        await updateDoc(ref, {
            totalChestsOpened: newTotal,
            activeHunters,
            currentDifficulty: newDifficulty,
            lastAdjustmentAt: Date.now(),
        });
    } else {
        await updateDoc(ref, {
            totalChestsOpened: increment(1),
        });
    }
}

// ============================================================
// HALVING TABLE — Chest Reward Schedule
// ============================================================

export function getChestReward(chestSequenceNumber: number): number {
    if (chestSequenceNumber === 1) return 50000;      // Bitcoin WP
    if (chestSequenceNumber <= 10) return 10000;
    if (chestSequenceNumber <= 50) return 5000;
    if (chestSequenceNumber <= 200) return 2000;
    if (chestSequenceNumber <= 500) return 1000;
    if (chestSequenceNumber <= 1000) return 500;
    if (chestSequenceNumber <= 5000) return 100;
    return 25;
}

/**
 * Explorer bonus (for non-first openers) — stays constant regardless of halving
 * This incentivizes exploration without inflating supply.
 */
export function getExplorerBonus(rarity: string): number {
    switch (rarity) {
        case 'genesis':  return 500;
        case 'legendary': return 200;
        case 'rare':      return 100;
        case 'uncommon':  return 50;
        default:          return 25;
    }
}
