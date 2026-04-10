import { db } from './firebase';
import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    addDoc,
    updateDoc,
    increment,
    writeBatch,
    limit,
    serverTimestamp,
} from 'firebase/firestore';
import { Alliance, AllianceMember } from './types';

// ============================================================
// 🤝 ALLIANCE ENGINE
// ============================================================

export async function getAlliances(publicOnly = true): Promise<Alliance[]> {
    const q = publicOnly
        ? query(collection(db, 'alliances'), where('isPublic', '==', true))
        : query(collection(db, 'alliances'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Alliance));
}

export async function getAlliance(allianceId: string): Promise<Alliance | null> {
    const snap = await getDoc(doc(db, 'alliances', allianceId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Alliance;
}

export async function getAllianceMembers(allianceId: string): Promise<AllianceMember[]> {
    const q = query(
        collection(db, 'alliance_members'),
        where('allianceId', '==', allianceId),
        where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as AllianceMember))
        .sort((a, b) => b.contributionScore - a.contributionScore);
}

export async function getPlayerAlliance(walletAddress: string): Promise<Alliance | null> {
    const q = query(
        collection(db, 'alliance_members'),
        where('walletAddress', '==', walletAddress),
        where('status', '==', 'active'),
        limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const member = snap.docs[0].data() as AllianceMember;
    return getAlliance(member.allianceId);
}

// ============================================================
// CREATE / JOIN / LEAVE
// ============================================================

export async function createAllianceClient(params: {
    name: string;
    symbol: string;
    isPublic: boolean;
    entryFeeULC: number;
    founderAddress: string;
}): Promise<{ success: boolean; allianceId?: string; error?: string }> {
    const res = await fetch('/api/alliance/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return res.json();
}

export async function joinAllianceClient(params: {
    allianceId: string;
    walletAddress: string;
    inviteCode?: string;
}): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/alliance/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return res.json();
}

export async function leaveAllianceClient(params: {
    allianceId: string;
    walletAddress: string;
}): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/alliance/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return res.json();
}

export async function kickMemberClient(params: {
    allianceId: string;
    targetWallet: string;
    ownerAddress: string;
}): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/alliance/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return res.json();
}

export async function disbandAllianceClient(params: {
    allianceId: string;
    ownerAddress: string;
}): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/alliance/disband', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return res.json();
}

// ============================================================
// CONTRIBUTION SCORE HELPERS
// ============================================================

export async function addContributionScore(
    walletAddress: string,
    allianceId: string,
    points: number
): Promise<void> {
    const q = query(
        collection(db, 'alliance_members'),
        where('allianceId', '==', allianceId),
        where('walletAddress', '==', walletAddress),
        where('status', '==', 'active'),
        limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    await updateDoc(snap.docs[0].ref, {
        contributionScore: increment(points),
        lastActiveAt: Date.now(),
    });
}

// ============================================================
// CONTRIBUTION SCORE TABLE (reference)
// ============================================================
export const CONTRIBUTION_POINTS = {
    CLUE_UNLOCK: 10,
    PUZZLE_STEP: 25,
    CORRECT_SUBANSWER: 50,
    CHEST_OPENER: 200,  // bonus for the member who opened the chest
    STAKE_PER_100_ULC: 5,
} as const;

// ============================================================
// ELIGIBILITY CHECK (client-side preview, validated server-side)
// ============================================================

export function isEligibleForReward(
    member: AllianceMember,
    totalTeamScore: number,
    MIN_PCT = 0.02,
    ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000
): boolean {
    const now = Date.now();
    const isActive = (now - member.lastActiveAt) <= ACTIVE_WINDOW_MS;
    const meetsScore = totalTeamScore > 0 && (member.contributionScore / totalTeamScore) >= MIN_PCT;
    return isActive && meetsScore;
}
