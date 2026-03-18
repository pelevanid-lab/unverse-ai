
import { db } from './firebase';
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, writeBatch, doc, or, updateDoc, setDoc } from 'firebase/firestore';
import { UserProfile, Creator, SystemConfig, LedgerEntry, LedgerEntryType, ClaimRequest } from './types';

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
    const platformFee = subscriptionPrice * (config.platform_subscription_fee_split || 0.1);
    const creatorEarning = subscriptionPrice - platformFee;

    const paymentRef = doc(collection(db, "ledger"));
    batch.set(paymentRef, {
        type: 'subscription_payment_usdt',
        timestamp: Date.now(),
        fromUserId: subscriber.uid,
        toUserId: creator.uid,
        amount: subscriptionPrice,
        currency: 'USDT',
        network: network,
        txHash: txHash,
        toWallet: config.treasury_wallets[network],
    });

    const earningRef = doc(collection(db, "ledger"));
    batch.set(earningRef, {
        type: 'creator_earning',
        timestamp: Date.now(),
        creatorId: creator.uid,
        toUserId: creator.uid,
        userId: subscriber.uid,
        amount: creatorEarning,
        currency: 'USDT',
        referenceId: paymentRef.id,
        platformFee: platformFee,
    });
    
    const userRef = doc(db, "users", subscriber.uid);
    batch.update(userRef, {
        activeSubscriptionIds: [...(subscriber.activeSubscriptionIds || []), creator.uid]
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
    const batch = writeBatch(db);
    const usdtEntryRef = doc(collection(db, 'ledger'));
    batch.set(usdtEntryRef, {
        fromUserId: user.uid,
        amount: amount * 0.015,
        currency: 'USDT',
        type: 'ulc_purchase_payment',
        network: network,
        txHash: txHash,
        timestamp: Date.now()
    });

    const ulcEntryRef = doc(collection(db, 'ledger'));
    batch.set(ulcEntryRef, {
        toUserId: user.uid,
        amount: amount,
        currency: 'ULC',
        type: 'ulc_purchase',
        referenceId: usdtEntryRef.id,
        timestamp: Date.now()
    });

    const userRef = doc(db, 'users', user.uid);
    batch.update(userRef, {
        'ulcBalance.available': (user.ulcBalance?.available || 0) + amount
    });

    await batch.commit();
}

// --- ADMIN / SYSTEM FUNCTIONS ---

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

export async function seedMuses() {
    // Placeholder for muse seeding logic
    console.log("Seeding AI Muses...");
}

export async function triggerGenesisAllocation(user: UserProfile) {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
        'ulcBalance.available': (user.ulcBalance?.available || 0) + 50000
    });
}

export async function toggleUserFreeze(uid: string, freeze: boolean) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { isFrozen: freeze });
}
