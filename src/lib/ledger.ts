
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, writeBatch, doc, or, updateDoc, setDoc, limit, runTransaction, increment, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { UserProfile, Creator, SystemConfig, LedgerEntry, LedgerEntryType, ClaimRequest, SubscriptionRecord, VestingSchedule } from './types';

let systemConfigCache: SystemConfig | null = null;

export async function getSystemConfig(): Promise<SystemConfig> {
    if (systemConfigCache) return systemConfigCache;
    const firestoreDocRef = doc(db, 'config', 'system');
    const docSnap = await getDoc(firestoreDocRef);
    if (!docSnap.exists()) {
        throw new Error("CRITICAL: System config document not found.");
    }
    
    // Fetch stats for floor price calculation
    const statsRef = doc(db, 'config', 'stats');
    const statsSnap = await getDoc(statsRef);
    const stats = statsSnap.exists() ? statsSnap.data() : { totalBurnedULC: 0 };

    const config = docSnap.data() as SystemConfig;
    
    // Calculate Dynamic Floor Price
    if (config.isSealed) {
        config.protocolFloorPrice = calculateProtocolFloorPrice(config, stats.totalBurnedULC || 0);
    } else {
        config.protocolFloorPrice = config.listingPriceUSDC || 0.015;
    }

    systemConfigCache = config;
    return systemConfigCache;
}

/**
 * Dynamic Pricing Model: Market Cap Persistence
 * Formula: Price = TargetCap / (InitialSupply - Burned)
 */
export function calculateProtocolFloorPrice(config: SystemConfig, burnedAmount: number): number {
    const initialSupply = config.initialSupplyAtSeal || 1000000000;
    const targetCap = config.targetCapitalizationUSDC || 15000000;
    
    const remainingSupply = Math.max(1, initialSupply - burnedAmount);
    return Number((targetCap / remainingSupply).toFixed(6));
}

/**
 * Basic transaction recording for single entries
 */
export async function recordTransaction(entry: Omit<LedgerEntry, 'id' | 'timestamp'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'ledger'), {
        ...entry,
        timestamp: Date.now(),
    });
    return docRef.id;
}

export async function grantWelcomeBonus(address: string): Promise<void> {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'GRANT_WELCOME_BONUS',
            userId: address
        })
    });
    
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to grant welcome bonus");
    }
}

export async function recordUsdcSubscription(
    subscriber: UserProfile,
    creator: UserProfile,
    config: SystemConfig,
    network: 'Base' | 'EVM',
    txHash: string
): Promise<void> {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'RECORD_SUBSCRIPTION',
            userId: subscriber.uid,
            payload: {
                creatorId: creator.uid,
                network,
                txHash
            }
        })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to record subscription");
    }
}

export async function calculateCreatorUsdcEarnings(creatorId: string): Promise<{ available: number, pending: number }> {
    const earningsQuery = query(
        collection(db, 'ledger'), 
        where('toUserId', '==', creatorId),
        where('type', 'in', ['creator_earning', 'tip', 'premium_unlock_earning']),
        where('currency', '==', 'USDC')
    );
    
    const earningsSnap = await getDocs(earningsQuery);
    const totalEarnings = earningsSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

    const claimsQuery = query(
        collection(db, 'claim_requests'),
        where('creatorId', '==', creatorId),
        where('status', 'in', ['pending', 'approved', 'completed'])
    );
    const claimsSnap = await getDocs(claimsQuery);
    const totalClaimedOrPending = claimsSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

    const pendingQuery = query(
        collection(db, 'claim_requests'),
        where('creatorId', '==', creatorId),
        where('status', '==', 'pending')
    );
    const pendingSnap = await getDocs(pendingQuery);
    const totalPending = pendingSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

    return {
        available: Math.max(0, totalEarnings - totalClaimedOrPending),
        pending: totalPending,
    };
}

export async function createClaimRequest(creator: Creator, walletAddress: string): Promise<string> {
    if (!creator.uid) throw new Error("Creator ID is missing.");
    const network = 'Base';
    
    const { available } = await calculateCreatorUsdcEarnings(creator.uid);
    if (available <= 0) throw new Error("You have no available USDC to claim.");
    
    const newClaim: Omit<ClaimRequest, 'id'> = {
        creatorId: creator.uid,
        amount: available,
        currency: "USDC",
        network: network,
        walletAddress: walletAddress,
        status: "pending",
        requestedAt: Date.now(),
    };
    const docRef = await addDoc(collection(db, 'claim_requests'), newClaim);
    return docRef.id;
}

export const confirmUlcPurchase = async (user: UserProfile, amount: number, network: string, txHash: string): Promise<void> => {
    const confirmFunction = httpsCallable(functions, 'confirmPurchase');
    
    try {
        await confirmFunction({ amount, network, txHash });
    } catch (error: any) {
        console.error("Purchase confirmation error:", error);
        throw error;
    }
}

export const confirmPresalePurchaseAction = async (user: UserProfile, amount: number, network: string, txHash: string): Promise<any> => {
    const confirmFunction = httpsCallable(functions, 'confirmPresalePurchase');
    
    try {
        const result = await confirmFunction({ amount, network, txHash });
        return result.data;
    } catch (error: any) {
        console.error("Presale purchase error:", error);
        throw error;
    }
}

// --- ADMIN / SYSTEM FUNCTIONS ---

export async function getVestingSchedules(userId: string): Promise<VestingSchedule[]> {
    const q = query(
        collection(db, 'vesting_schedules'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VestingSchedule));
}

export async function getAllVestingSchedules(): Promise<VestingSchedule[]> {
    const q = query(
        collection(db, 'vesting_schedules'),
        orderBy('createdAt', 'desc'),
        limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VestingSchedule));
}

/**
 * Admin action to create a schedule
 */
export async function createVestingScheduleAction(data: {
    targetUserId: string;
    totalAmount: number;
    durationMonths: number;
    cliffMonths?: number;
    description?: string;
    poolId: string;
}): Promise<any> {
    const createFunc = httpsCallable(functions, 'createVestingSchedule_v2');
    const result = await createFunc(data);
    return result.data;
}

/**
 * Frontend wrapper for the claimVestedULC cloud function
 */
export async function claimVestedULCAction(scheduleId: string): Promise<any> {
    const claimFunc = httpsCallable(functions, 'claimVestedULC');
    const result = await claimFunc({ scheduleId });
    return result.data;
}

/**
 * Retrieves a secure 30-min signed URL for a post
 */
export async function getPostMediaAction(postId: string): Promise<{ url: string }> {
    const getMediaFunc = httpsCallable(functions, 'getPostMedia');
    const result = await getMediaFunc({ postId });
    return result.data as { url: string };
}

/**
 * Retrieves secure 24-hour signed URLs for multiple posts in a batch
 */
export async function getPostsMediaAction(postIds: string[]): Promise<{ [postId: string]: string }> {
    if (!postIds || postIds.length === 0) return {};
    const getMediaFunc = httpsCallable(functions, 'getPostsMedia');
    const result = await getMediaFunc({ postIds });
    return result.data as { [postId: string]: string };
}


export async function syncSystemConfigAction() {
    const configRef = doc(db, 'config', 'system');
    
    const configSnap = await getDoc(configRef);
    if (configSnap.exists() && configSnap.data()?.isSealed) {
        throw new Error("TOKENOMICS_LOCKED");
    }

    const syncedConfig: SystemConfig = {
        admin_wallet_address: "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa",
        ai_generation_burn_split: 3, // Repesents 30% proportional burn
        ai_generation_cost: 5,
        ai_generation_treasury_split: 7, // Represents 70% proportional treasury
        genesis_initialized: false,
        isSealed: false,
        last_manual_fix_v3_at: Date.now(),
        platform_subscription_fee_split: 0.15,
        pools: {
            creators: 120000000,
            exchanges: 40000000,
            liquidity: 60000000,
            presale: 100000000,
            promo: 50000000,
            reserve: 420000000,
            staking: 80000000,
            team: 130000000,
        },
        premium_unlock_burn_ratio: 0.33,
        premium_unlock_fee_split: 0.15,
        premium_unlock_treasury_ratio: 0.67,
        subscription_buyback_ratio: 0.33,
        subscription_treasury_ratio: 0.67,
        totalTreasuryUSDC: 0,
        treasury_address: "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa",
        // Buyback Defaults (Post-Launch Preparation)
        treasury_buyback_enabled: true,
        treasury_buyback_ratio: 0.3,
        operationCostUSDC: 0,
        treasuryUSDCBalanceManual: 0,
        presaleCompleted: false,
        tokenLaunchCompleted: false,
        marketLiquidityReady: false,
        // Pre-Sale Tier Upgrade 2026
        presaleAllocationULC: 100000000,
        currentPresaleStage: 1,
        presalePriceUSDC: 0.009,
        listingPriceUSDC: 0.015,
    };

    // We use merge: true to not overwrite currently accumulated values like totalTreasuryUSDC, 
    // but we ensure all keys are strictly aligned to the codebase structure.
    await setDoc(configRef, syncedConfig, { merge: true });
    
    systemConfigCache = null; 
    return syncedConfig;
}

export async function handleStaking(user: UserProfile, amount: number) {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'STAKE',
            userId: user.uid,
            payload: { amount }
        })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Staking failed");
    }
}

export async function handleUnstaking(user: UserProfile, amount: number) {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'UNSTAKE',
            userId: user.uid,
            payload: { amount }
        })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Unstaking failed");
    }
}

export async function sealEconomyAction() {
    const sealFn = httpsCallable(functions, "sealEconomy_v2");
    return await sealFn();
}

export async function executeBuybackAction(data: {
    amountUSDC: number;
    description: string;
}) {
    const buybackFn = httpsCallable(functions, "executeBuyback");
    return await buybackFn(data);
}

export async function triggerGenesisAllocation(user: UserProfile) {
    const userRef = doc(db, 'users', user.uid);
    const amount = 50000;
    
    const batch = writeBatch(db);
    
    batch.update(userRef, { 
        'ulcBalance.available': increment(amount) 
    });

    batch.set(doc(collection(db, 'ledger')), {
        toUserId: user.uid,
        toWallet: user.walletAddress,
        amount: amount,
        currency: 'ULC',
        type: 'genesis_allocation',
        timestamp: Date.now()
    });

    await batch.commit();
}

export async function toggleUserFreeze(uid: string, freeze: boolean) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { isFrozen: freeze });
}

/**
 * AI Generation Monetization Logic
 * Supports dynamic costs (Standard: 5, Digital Twin: 20, Edit: 3)
 * Ratio: 70% Treasury / 30% Burn
 */
export async function processAiGenerationPayment(userId: string, cost: number, isRegeneration?: boolean): Promise<string> {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'AI_GENERATION_PAYMENT',
            userId,
            payload: { cost, isRegeneration }
        })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Payment failed");
    }

    const { ledgerId } = await response.json();
    return ledgerId;
}

export async function refundAiGenerationPayment(userId: string, ledgerId: string, cost: number): Promise<void> {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'AI_GENERATION_REFUND',
            userId,
            payload: { ledgerId, cost }
        })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Refund failed");
    }
}

/**
 * AI Creator Mode Activation (10 ULC for renewal, First time FREE)
 * 70% Treasury / 30% Burn
 */
export async function processAiCreatorActivation(userId: string): Promise<string> {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'AI_CREATOR_ACTIVATION',
            userId
        })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Activation failed");
    }

    const { ledgerId } = await response.json();
    return ledgerId;
}

/**
 * AI Creator Mode Daily Generation (2 ULC)
 * 70% Treasury / 30% Burn
 */
export async function processAiCreatorGeneration(userId: string): Promise<string> {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'AI_CREATOR_GENERATION',
            userId
        })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation payment failed");
    }

    const { ledgerId } = await response.json();
    return ledgerId;
}

/**
 * Uniq Pro Engine Unlock (15 ULC)
 * 70% Treasury / 30% Burn
 */
export async function processUniqProUnlock(userId: string): Promise<string> {
    const response = await fetch('/api/ledger/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'UNIQ_PRO_UNLOCK',
            userId
        })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Unlock failed");
    }

    const { ledgerId } = await response.json();
    return ledgerId;
}

export async function updateClaimRequestStatus(claimId: string, status: ClaimRequest['status'], adminId?: string, txHash?: string): Promise<void> {
    const claimRef = doc(db, 'claim_requests', claimId);
    const updateData: any = { status, updatedAt: Date.now() };
    if (adminId) updateData.processedBy = adminId;
    if (txHash) updateData.txHash = txHash;
    await updateDoc(claimRef, updateData);
}
