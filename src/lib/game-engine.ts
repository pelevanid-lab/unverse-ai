import { db } from './firebase';
import {
    doc,
    getDoc,
    getDocs,
    addDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
} from 'firebase/firestore';
import { Universe, TreasureChest, GameSession, ChestAttempt } from './types';

// ============================================================
// 🌌 UNIVERSE ENGINE
// ============================================================

export async function getUniverses(): Promise<Universe[]> {
    const q = query(
        collection(db, 'universes'),
        where('status', 'in', ['active', 'completed']),
        orderBy('sortOrder', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Universe));
}

export async function getUniverse(universeId: string): Promise<Universe | null> {
    const ref = doc(db, 'universes', universeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Universe;
}

// ============================================================
// 📦 CHEST ENGINE
// ============================================================

export async function getChestsByUniverse(universeId: string): Promise<TreasureChest[]> {
    const q = query(
        collection(db, 'chests'),
        where('universeId', '==', universeId),
        orderBy('sortOrder', 'asc')
    );
    const snap = await getDocs(q);
    // Clues returned WITHOUT answerHash (client safety)
    return snap.docs.map(d => {
        const data = d.data();
        const { answerHash: _removed, ...safeData } = data;
        return { id: d.id, ...safeData } as TreasureChest;
    });
}

export async function getChest(chestId: string): Promise<TreasureChest | null> {
    const ref = doc(db, 'chests', chestId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    const { answerHash: _removed, ...safeData } = data;
    return { id: snap.id, ...safeData } as TreasureChest;
}

// ============================================================
// 🔍 CLUE ENGINE
// ============================================================

/**
 * Get or create a game session for the player on a chest.
 */
export async function getOrCreateSession(
    hunterAddress: string,
    chestId: string,
    universeId: string,
    allianceId?: string
): Promise<GameSession> {
    const q = query(
        collection(db, 'game_sessions'),
        where('hunterAddress', '==', hunterAddress),
        where('chestId', '==', chestId),
        where('status', '==', 'active'),
        limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() } as GameSession;
    }

    // Create new session
    const sessionData: any = {
        hunterAddress,
        chestId,
        universeId,
        cluesUnlocked: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        status: 'active',
    };

    if (allianceId) {
        sessionData.allianceId = allianceId;
    }

    const ref = await addDoc(collection(db, 'game_sessions'), sessionData);
    return { id: ref.id, ...sessionData } as GameSession;
}

/**
 * Unlock a paid clue via the API (burn happens server-side).
 * Returns the full clue text after payment confirmed.
 */
export async function unlockClueClient(
    sessionId: string,
    clueOrder: number
): Promise<{ success: boolean; clueText?: string; error?: string }> {
    const res = await fetch('/api/game/unlock-clue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clueOrder }),
    });
    return res.json();
}

// ============================================================
// 📝 ANSWER SUBMISSION
// ============================================================

/**
 * Submit a chest answer via the secure API.
 * Server validates the hash, distributes rewards, mints NFT.
 */
export async function submitAnswer(
    sessionId: string,
    chestId: string,
    answer: string
): Promise<{
    correct: boolean;
    isFirstHunter?: boolean;
    rewardULC?: number;
    nftName?: string;
    error?: string;
}> {
    const res = await fetch('/api/game/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, chestId, answer }),
    });
    return res.json();
}

// ============================================================
// 📊 LEADERBOARD
// ============================================================

export async function getLeaderboard(type: 'solo' | 'alliances' = 'solo', count = 50): Promise<any[]> {
    const q = query(
        collection(db, `leaderboard_${type}`),
        orderBy('totalRewardULC', 'desc'),
        limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ id: d.id, rank: i + 1, ...d.data() }));
}

// ============================================================
// 🎖️ PLAYER STATS
// ============================================================

export async function getPlayerChestHistory(walletAddress: string): Promise<ChestAttempt[]> {
    const q = query(
        collection(db, 'chest_attempts'),
        where('hunterAddress', '==', walletAddress),
        where('isCorrect', '==', true),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChestAttempt));
}

export async function getHunterStats(walletAddress: string): Promise<{
    chestsFound: number;
    totalEarned: number;
    rank: number;
}> {
    // Basic stats from solo leaderboard entry
    try {
        const ref = doc(db, 'leaderboard_solo', walletAddress);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            return {
                chestsFound: data.chestsFound || 0,
                totalEarned: data.totalRewardULC || 0,
                rank: data.rank || 0 // Assuming rank is synced periodically or we just show count
            };
        }
    } catch (e) {
        console.error('Failed to get hunter stats:', e);
    }
    return { chestsFound: 0, totalEarned: 0, rank: 0 };
}
