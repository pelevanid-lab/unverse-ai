import { db } from './firebase';
import crypto from 'crypto';
import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    increment,
    writeBatch,
    limit,
} from 'firebase/firestore';
import { TreasureChest, GameSession, Alliance, AllianceMember, AllianceReward, Clue } from './types';

// ============================================================
// 🔒 SERVER-SIDE ANSWER VALIDATION
// (Called from /api/game/submit-answer route handler)
// ============================================================

/**
 * Validate a player's answer against the stored SHA-256 hash.
 * Normalizes answer: lowercase + trim + remove punctuation.
 */
export function validateAnswer(rawAnswer: string, storedHash: string): boolean {
    const normalized = rawAnswer.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    return hash === storedHash;
}

// ============================================================
// 💰 REWARD DISTRIBUTION
// ============================================================

/**
 * Distribute treasure reward to player or alliance pool.
 * Called server-side only after answer validation.
 */
export async function distributeTreasureReward(params: {
    chestId: string;
    hunterAddress: string;
    sessionId: string;
    isFirstHunter: boolean;
    allianceId?: string;
}): Promise<{ rewardULC: number; nftName?: string }> {
    const { chestId, hunterAddress, sessionId, isFirstHunter, allianceId } = params;

    const chestRef = doc(db, 'chests', chestId);
    const chestSnap = await getDoc(chestRef);
    if (!chestSnap.exists()) throw new Error('Chest not found');
    const chest = { id: chestSnap.id, ...chestSnap.data() } as TreasureChest;

    const batch = writeBatch(db);
    let rewardULC = 0;
    let nftName: string | undefined;

    if (isFirstHunter) {
        rewardULC = chest.baseRewardULC;

        // Update chest to permanently open
        batch.update(chestRef, {
            status: 'permanently_open',
            firstHunterAddress: hunterAddress,
            firstHunterAllianceId: allianceId || null,
            firstHuntedAt: Date.now(),
            totalExplorers: increment(1),
            totalAttempts: increment(1),
        });

        // Update universe stats
        const universeRef = doc(db, 'universes', chest.universeId);
        batch.update(universeRef, {
            chestsOpened: increment(1),
            totalRewardULC: increment(rewardULC),
        });

        if (allianceId) {
            // Alliance pool distribution
            await batch.commit();
            return distributeAllianceReward(chestId, allianceId, rewardULC, hunterAddress);
        }

        // Solo hunter: direct reward
        const hunterRef = doc(db, 'users', hunterAddress);
        batch.update(hunterRef, {
            'ulcBalance.available': increment(rewardULC),
        });

        // Ledger entry
        batch.set(doc(collection(db, 'ledger')), {
            toWallet: hunterAddress,
            toUserId: hunterAddress,
            amount: rewardULC,
            currency: 'ULC',
            type: 'treasure_reward',
            memo: `First Hunter: ${chest.name}`,
            referenceId: chestId,
            timestamp: Date.now(),
        });

        // Leaderboard update
        const lbRef = doc(db, 'leaderboard_solo', hunterAddress);
        batch.set(lbRef, {
            walletAddress: hunterAddress,
            chestsFound: increment(1),
            totalRewardULC: increment(rewardULC),
        }, { merge: true });

        nftName = chest.name;

    } else {
        // Explorer bonus (smaller, consistent)
        rewardULC = chest.explorerBonusULC;
        batch.update(chestRef, {
            totalExplorers: increment(1),
        });

        const hunterRef = doc(db, 'users', hunterAddress);
        batch.update(hunterRef, {
            'ulcBalance.available': increment(rewardULC),
        });

        batch.set(doc(collection(db, 'ledger')), {
            toWallet: hunterAddress,
            toUserId: hunterAddress,
            amount: rewardULC,
            currency: 'ULC',
            type: 'explorer_bonus',
            memo: `Explorer: ${chest.name}`,
            referenceId: chestId,
            timestamp: Date.now(),
        });
    }

    // Mark session solved
    batch.update(doc(db, 'game_sessions', sessionId), {
        status: 'solved',
        lastActiveAt: Date.now(),
    });

    await batch.commit();
    return { rewardULC, nftName };
}

// ============================================================
// ⛏️ ALLIANCE / MINING POOL DISTRIBUTION
// ============================================================

/**
 * Distribute reward among alliance members proportional to contribution score.
 * Deducts 5% treasury cut for alliance founder.
 * Only distributes to members with score ≥ 2% of total AND active in last 48h.
 */
export async function distributeAllianceReward(
    chestId: string,
    allianceId: string,
    totalReward: number,
    finderAddress: string
): Promise<{ rewardULC: number; nftName?: string }> {

    const TREASURY_CUT = 0.05;
    const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;
    const MIN_CONTRIBUTION_PCT = 0.02;

    // Load alliance
    const allianceRef = doc(db, 'alliances', allianceId);
    const allianceSnap = await getDoc(allianceRef);
    if (!allianceSnap.exists()) throw new Error('Alliance not found');
    const alliance = { id: allianceSnap.id, ...allianceSnap.data() } as Alliance;

    // Load active members
    const membersSnap = await getDocs(query(
        collection(db, 'alliance_members'),
        where('allianceId', '==', allianceId),
        where('status', '==', 'active')
    ));
    const now = Date.now();
    const activeMembers = membersSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as AllianceMember))
        .filter(m => (now - m.lastActiveAt) <= ACTIVE_WINDOW_MS);

    const totalScore = activeMembers.reduce((s, m) => s + m.contributionScore, 0);
    const eligibleMembers = activeMembers.filter(
        m => totalScore > 0 && (m.contributionScore / totalScore) >= MIN_CONTRIBUTION_PCT
    );

    // Treasury cut
    const treasuryCut = Math.floor(totalReward * TREASURY_CUT);
    const distributable = totalReward - treasuryCut;

    const shares: AllianceReward['shares'] = [];
    const batch = writeBatch(db);

    // Distribute to eligible members
    for (const member of eligibleMembers) {
        const pct = member.contributionScore / totalScore;
        const amount = Math.floor(distributable * pct);
        if (amount <= 0) continue;

        shares.push({
            walletAddress: member.walletAddress,
            amount,
            contributionScore: member.contributionScore,
            contributionPct: Math.round(pct * 100),
        });

        batch.update(doc(db, 'users', member.walletAddress), {
            'ulcBalance.available': increment(amount),
        });

        batch.set(doc(collection(db, 'ledger')), {
            toWallet: member.walletAddress,
            toUserId: member.walletAddress,
            amount,
            currency: 'ULC',
            type: 'pool_reward',
            memo: `Alliance Pool: chest ${chestId}`,
            referenceId: chestId,
            metadata: { allianceId },
            timestamp: Date.now(),
        });
    }

    // Treasury cut → founder wallet
    if (treasuryCut > 0) {
        batch.update(doc(db, 'users', alliance.founderAddress), {
            'ulcBalance.available': increment(treasuryCut),
        });
        batch.set(doc(collection(db, 'ledger')), {
            toWallet: alliance.founderAddress,
            toUserId: alliance.founderAddress,
            amount: treasuryCut,
            currency: 'ULC',
            type: 'pool_treasury_cut',
            memo: `Alliance Treasury Cut: ${allianceId}`,
            referenceId: chestId,
            timestamp: Date.now(),
        });
        // Update alliance treasury balance
        batch.update(allianceRef, {
            treasuryBalance: increment(treasuryCut),
            totalChestsFound: increment(1),
            totalRewardULC: increment(totalReward),
        });
    }

    // Record distribution
    const rewardRecord: Omit<AllianceReward, 'id'> = {
        allianceId,
        chestId,
        totalAmount: totalReward,
        distributedAt: Date.now(),
        shares,
    };
    batch.set(doc(collection(db, 'alliance_rewards')), rewardRecord);

    // Update leaderboard for alliance
    batch.set(doc(db, 'leaderboard_alliances', allianceId), {
        allianceId,
        name: alliance.name,
        symbol: alliance.symbol,
        chestsFound: increment(1),
        totalRewardULC: increment(totalReward),
        memberCount: eligibleMembers.length,
    }, { merge: true });

    await batch.commit();

    // Return finder's own reward for UI feedback
    const finderShare = shares.find(s => s.walletAddress === finderAddress);
    return { rewardULC: finderShare?.amount ?? 0 };
}

// ============================================================
// 🔥 CLUE UNLOCK (burn server-side)
// ============================================================

export async function processClueUnlock(params: {
    hunterAddress: string;
    sessionId: string;
    chestId: string;
    clue: Clue;
}): Promise<void> {
    const { hunterAddress, sessionId, chestId, clue } = params;
    const { costULC, burnRatio, order } = clue;

    const burnAmount = Math.floor(costULC * burnRatio);
    const treasuryAmount = costULC - burnAmount;

    const batch = writeBatch(db);

    // Deduct from user balance
    batch.update(doc(db, 'users', hunterAddress), {
        'ulcBalance.available': increment(-costULC),
    });

    // Ledger burn entry
    if (burnAmount > 0) {
        batch.set(doc(collection(db, 'ledger')), {
            fromWallet: hunterAddress,
            fromUserId: hunterAddress,
            amount: burnAmount,
            currency: 'ULC',
            type: 'clue_unlock_burn',
            memo: `Clue ${order} unlock: chest ${chestId}`,
            referenceId: chestId,
            timestamp: Date.now(),
        });
    }

    // Update contribution score for alliance members
    const sessionRef = doc(db, 'game_sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (sessionSnap.exists()) {
        const session = sessionSnap.data() as GameSession;
        const updatedClues = [...(session.cluesUnlocked || []), order];
        batch.update(sessionRef, {
            cluesUnlocked: updatedClues,
            lastActiveAt: Date.now(),
        });

        // Increment contribution score if in alliance
        if (session.allianceId) {
            const memberQuery = query(
                collection(db, 'alliance_members'),
                where('allianceId', '==', session.allianceId),
                where('walletAddress', '==', hunterAddress),
                limit(1)
            );
            const memberSnap = await getDocs(memberQuery);
            if (!memberSnap.empty) {
                batch.update(memberSnap.docs[0].ref, {
                    contributionScore: increment(10), // +10 for clue unlock
                    lastActiveAt: Date.now(),
                });
            }
        }
    }

    await batch.commit();
}
