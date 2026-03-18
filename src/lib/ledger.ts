
import { db } from './firebase';
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, writeBatch, doc, or } from 'firebase/firestore';
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
 * Basic transaction recording for single entries (like welcome bonus)
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
        toUserId: creator.uid, // Explicitly set for balance queries
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
    // 1. Fetch all earnings (Direct earnings + Subscription shares)
    const earningsQuery = query(
        collection(db, 'ledger'), 
        where('toUserId', '==', creatorId),
        where('type', 'in', ['creator_earning', 'tip', 'premium_unlock_earning']),
        where('currency', '==', 'USDT')
    );
    
    const earningsSnap = await getDocs(earningsQuery);
    const totalEarnings = earningsSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

    // 2. Fetch all claims (including ones that are already paid out)
    const claimsQuery = query(
        collection(db, 'claim_requests'),
        where('creatorId', '==', creatorId),
        where('status', 'in', ['pending', 'approved', 'completed'])
    );
    const claimsSnap = await getDocs(claimsQuery);
    const totalClaimedOrPending = claimsSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

    // 3. Fetch only pending claims for the "Pending" display
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
    
    // 1. Record the USDT incoming to Treasury
    const usdtEntryRef = doc(collection(db, 'ledger'));
    batch.set(usdtEntryRef, {
        fromUserId: user.uid,
        amount: amount * 0.015, // Price calculation
        currency: 'USDT',
        type: 'ulc_purchase_payment',
        network: network,
        txHash: txHash,
        timestamp: Date.now()
    });

    // 2. Record the ULC credits given to User
    const ulcEntryRef = doc(collection(db, 'ledger'));
    batch.set(ulcEntryRef, {
        toUserId: user.uid,
        amount: amount,
        currency: 'ULC',
        type: 'ulc_purchase',
        referenceId: usdtEntryRef.id,
        timestamp: Date.now()
    });

    // 3. Increment user's available balance
    const userRef = doc(db, 'users', user.uid);
    batch.update(userRef, {
        'ulcBalance.available': (user.ulcBalance?.available || 0) + amount
    });

    await batch.commit();
}
