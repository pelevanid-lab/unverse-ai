
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
    systemConfigCache = docSnap.data() as SystemConfig;
    return systemConfigCache;
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
    const userDocRef = doc(db, 'users', address);
    const config = await getSystemConfig();
    
    if (!config?.wallets?.promo_pool?.address) {
        throw new Error("Promo pool address not configured.");
    }

    const batch = writeBatch(db);
    
    // 1. Record in Ledger
    const ledgerRef = doc(collection(db, 'ledger'));
    batch.set(ledgerRef, {
        fromWallet: config.wallets.promo_pool.address,
        toUserId: address,
        toWallet: address,
        amount: 100,
        currency: 'ULC',
        type: 'welcome_bonus',
        timestamp: Date.now(),
    });

    // 2. Update User Profile
    batch.update(userDocRef, {
        welcomeBonusClaimed: true,
        'ulcBalance.available': increment(100)
    });

    await batch.commit();
}

export async function recordUsdtSubscription(
    subscriber: UserProfile,
    creator: UserProfile,
    config: SystemConfig,
    network: 'TRON' | 'TON',
    txHash: string
): Promise<void> {
    if (!creator.creatorData) throw new Error("Target user is not a creator.");

    const batch = writeBatch(db);
    const subscriptionPrice = creator.creatorData.subscriptionPriceMonthly;
    
    const platformRatio = 0.15;
    const treasuryShare = subscriptionPrice * 0.10;
    const buybackShare = subscriptionPrice * 0.05;
    const creatorEarning = subscriptionPrice - (treasuryShare + buybackShare);

    const now = Date.now();
    const duration = 30 * 24 * 60 * 60 * 1000;

    const subQuery = query(
        collection(db, 'subscriptions'),
        where('userId', '==', subscriber.uid),
        where('creatorId', '==', creator.uid),
        where('status', '==', 'active')
    );
    const subSnap = await getDocs(subQuery);
    
    let subRef;
    let newExpiry;

    if (!subSnap.empty) {
        const currentSub = subSnap.docs[0];
        subRef = doc(db, 'subscriptions', currentSub.id);
        const currentExpiry = currentSub.data().expiresAt;
        newExpiry = Math.max(now, currentExpiry) + duration;
        batch.update(subRef, { expiresAt: newExpiry, updatedAt: now });
    } else {
        subRef = doc(collection(db, 'subscriptions'));
        newExpiry = now + duration;
        const newSub: Omit<SubscriptionRecord, 'id'> = {
            userId: subscriber.uid,
            creatorId: creator.uid,
            startedAt: now,
            expiresAt: newExpiry,
            status: 'active'
        };
        batch.set(subRef, newSub);
    }

    const paymentRef = doc(collection(db, "ledger"));
    batch.set(paymentRef, {
        type: 'subscription_payment',
        timestamp: now,
        fromUserId: subscriber.uid,
        toUserId: creator.uid,
        amount: subscriptionPrice,
        currency: 'USDT',
        network: network,
        txHash: txHash,
        toWallet: config.treasury_wallets[network],
    });

    batch.set(doc(collection(db, "ledger")), {
        type: 'creator_earning',
        timestamp: now,
        creatorId: creator.uid,
        toUserId: creator.uid,
        userId: subscriber.uid,
        amount: creatorEarning,
        currency: 'USDT',
        referenceId: paymentRef.id,
    });

    batch.set(doc(collection(db, "ledger")), {
        type: 'treasury_fee',
        timestamp: now,
        amount: treasuryShare,
        currency: 'USDT',
        referenceId: paymentRef.id,
        toWallet: config.treasury_wallets[network]
    });

    batch.set(doc(collection(db, "ledger")), {
        type: 'buyback_burn_fee',
        timestamp: now,
        amount: buybackShare,
        currency: 'USDT',
        referenceId: paymentRef.id,
    });
    
    const userRef = doc(db, "users", subscriber.uid);
    const updatedSubs = Array.from(new Set([...(subscriber.activeSubscriptionIds || []), creator.uid]));
    batch.update(userRef, {
        activeSubscriptionIds: updatedSubs
    });

    await batch.commit();
}

export async function calculateCreatorUsdtEarnings(creatorId: string): Promise<{ available: number, pending: number }> {
    const earningsQuery = query(
        collection(db, 'ledger'), 
        where('toUserId', '==', creatorId),
        where('type', 'in', ['creator_earning', 'tip', 'premium_unlock_earning']),
        where('currency', '==', 'USDT')
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

export async function createClaimRequest(creator: Creator): Promise<string> {
    if (!creator.uid) throw new Error("Creator ID is missing.");
    const network = creator.preferredPayoutNetwork;
    if (!network) throw new Error("Please select a default collection network in your settings.");
    const walletAddress = creator.payoutWallets?.[network]?.address;
    if (!walletAddress) throw new Error(`Your default ${network} collection address is not configured.`);
    const { available } = await calculateCreatorUsdtEarnings(creator.uid);
    if (available <= 0) throw new Error("You have no available USDT to claim.");
    const newClaim: Omit<ClaimRequest, 'id'> = {
        creatorId: creator.uid,
        amount: available,
        currency: "USDT",
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
}): Promise<any> {
    const createFunc = httpsCallable(functions, 'createVestingSchedule');
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

export async function initializeSystemConfig() {
    const configRef = doc(db, 'config', 'system');
    const initialConfig = {
        genesis_initialized: true,
        platform_subscription_fee_split: 0.1,
        admin_wallet_address: "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa",
        treasury_wallets: {
            TON: "EQD09uY4E4729uY4E4729uY4E4729uY4E472",
            TRON: "TCY7Bm6hej8nwcjMDmXyYndjZBE4Zpmk2"
        },
        wallets: {
            promo_pool: { address: "SYSTEM_PROMO", currency: "ULC", balance: 1000000 }
        }
    };
    await setDoc(configRef, initialConfig);
    return initialConfig as SystemConfig;
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
 * Costs 3 ULC: 70% Treasury (2.1), 30% Burn (0.9)
 */
export async function processAiGenerationPayment(userId: string): Promise<string> {
    return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error("User not found");
        
        const userData = userSnap.data() as UserProfile;
        const balance = userData.ulcBalance?.available || 0;
        const cost = 3;

        if (balance < cost) {
            throw new Error("INSUFFICIENT_ULC");
        }

        const treasuryShare = cost * 0.7; // 2.1
        const burnShare = cost * 0.3;     // 0.9

        // 1. Deduct from user
        transaction.update(userRef, {
            'ulcBalance.available': increment(-cost)
        });

        // 2. Update Global Treasury and Burn Stats
        const statsRef = doc(db, 'config', 'stats');
        transaction.set(statsRef, {
            totalTreasuryULC: increment(treasuryShare),
            totalBurnedULC: increment(burnShare)
        }, { merge: true });

        // 3. Record in Ledger
        const ledgerRef = doc(collection(db, 'ledger'));
        transaction.set(ledgerRef, {
            type: 'ai_generation_payment',
            fromUserId: userId,
            amount: cost,
            currency: 'ULC',
            timestamp: Date.now(),
            details: { treasury: treasuryShare, burn: burnShare }
        });

        return ledgerRef.id;
    });
}

export async function refundAiGenerationPayment(userId: string, ledgerId: string): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const cost = 3;
        const treasuryShare = cost * 0.7;
        const burnShare = cost * 0.3;

        // 1. Refund user
        transaction.update(userRef, {
            'ulcBalance.available': increment(cost)
        });

        // 2. Reverse Stats
        const statsRef = doc(db, 'config', 'stats');
        transaction.set(statsRef, {
            totalTreasuryULC: increment(-treasuryShare),
            totalBurnedULC: increment(-burnShare)
        }, { merge: true });

        // 3. Record Refund Entry
        const refundLedgerRef = doc(collection(db, 'ledger'));
        transaction.set(refundLedgerRef, {
            type: 'ai_generation_refund',
            toUserId: userId,
            amount: cost,
            currency: 'ULC',
            timestamp: Date.now(),
            referenceId: ledgerId
        });
    });
}
