
import { db } from './firebase';
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { UserProfile, Creator, SystemConfig, LedgerEntry, LedgerEntryType, ClaimRequest } from './types';

let systemConfigCache: SystemConfig | null = null;

// --- System Config --- (Includes TON wallet as per previous step)
export async function getSystemConfig(): Promise<SystemConfig> {
    if (systemConfigCache) return systemConfigCache;
    const firestoreDocRef = doc(db, 'config', 'system');
    const docSnap = await getDoc(firestoreDocRef);
    if (!docSnap.exists()) {
        throw new Error("CRITICAL: System config document not found.");
    }
    const data = docSnap.data() as SystemConfig;
    if (!data.treasury_wallets.TON) {
        console.warn("TON treasury wallet is not set in config/system. Using a placeholder.");
        data.treasury_wallets.TON = "EQyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy";
    }
    systemConfigCache = data;
    return systemConfigCache;
}

/**
 * [NEW] Records a USDT subscription payment and atomically generates the creator's earning record.
 * This is the correct, atomic way to handle subscriptions.
 */
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
    const platformFee = subscriptionPrice * config.platform_subscription_fee_split;
    const creatorEarning = subscriptionPrice - platformFee;

    // 1. Record the user's payment to the treasury wallet
    const paymentEntry: Omit<LedgerEntry, 'id'> = {
        type: 'subscription_payment_usdt',
        timestamp: Date.now(),
        userId: subscriber.uid,
        creatorId: creator.uid,
        amount: subscriptionPrice,
        currency: 'USDT',
        network: network,
        txHash: txHash,
        fromWallet: 'user_wallet', // Placeholder, real address not available on frontend
        toWallet: config.treasury_wallets[network],
    };
    const paymentRef = doc(collection(db, "ledger"));
    batch.set(paymentRef, paymentEntry);

    // 2. Record the creator's earning from this payment
    const earningEntry: Omit<LedgerEntry, 'id'> = {
        type: 'creator_earning',
        timestamp: Date.now(),
        creatorId: creator.uid,
        userId: subscriber.uid, // Reference to the subscriber
        amount: creatorEarning,
        currency: 'USDT',
        referenceId: paymentRef.id, // Link to the original payment ledger entry
        platformFee: platformFee,
    };
    const earningRef = doc(collection(db, "ledger"));
    batch.set(earningRef, earningEntry);
    
    // 3. Update the user's active subscriptions array
    const userRef = doc(db, "users", subscriber.uid);
    batch.update(userRef, {
        activeSubscriptionIds: [...(subscriber.activeSubscriptionIds || []), creator.uid]
    });

    await batch.commit();
}


// --- Other Ledger Functions ---

export async function recordTransaction(entry: Omit<LedgerEntry, 'id' | 'timestamp'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'ledger'), {
        ...entry,
        timestamp: Date.now(),
    });
    return docRef.id;
}

// ... [rest of the functions like calculateCreatorUsdtEarnings, createClaimRequest, etc. remain the same] ...
function isValidTronAddress(address: string): boolean {
    return typeof address === 'string' && address.startsWith('T') && address.length > 30;
}

function isValidTonAddress(address: string): boolean {
    return typeof address === 'string' && address.startsWith('EQ') && address.length > 40;
}


export async function calculateCreatorUsdtEarnings(creatorId: string): Promise<{ available: number, pending: number }> {
    const earningsQuery = query(
        collection(db, 'ledger'), 
        where('creatorId', '==', creatorId),
        where('type', '==', 'creator_earning'),
        where('currency', '==', 'USDT')
    );
    const earningsSnap = await getDocs(earningsQuery);
    const totalEarnings = earningsSnap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

    const claimsQuery = query(
        collection(db, 'claim_requests'),
        where('creatorId', '==', creatorId),
        where('status', 'in', ['pending', 'approved', 'completed'])
    );
    const claimsSnap = await getDocs(claimsQuery);
    const totalClaimedOrPending = claimsSnap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

    const pendingQuery = query(
        collection(db, 'claim_requests'),
        where('creatorId', '==', creatorId),
        where('status', '==', 'pending')
    );
    const pendingSnap = await getDocs(pendingQuery);
    const totalPending = pendingSnap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

    return {
        available: totalEarnings - totalClaimedOrPending,
        pending: totalPending,
    };
}

export async function createClaimRequest(creator: Creator): Promise<string> {
    if (!creator.uid) throw new Error("Creator ID is missing.");

    const network = creator.preferredPayoutNetwork;
    if (!network) {
        throw new Error("Please select a default collection network in your settings.");
    }
    const walletAddress = creator.payoutWallets?.[network]?.address;
    if (!walletAddress) {
        throw new Error(`Your default ${network} collection wallet is not configured.`);
    }

    if (network === 'TRON' && !isValidTronAddress(walletAddress)) {
         throw new Error(`Invalid TRON wallet address format. It must start with 'T'.`);
    }
    if (network === 'TON' && !isValidTonAddress(walletAddress)) {
         throw new Error(`Invalid TON wallet address format. It must start with 'EQ'.`);
    }

    const existingClaimsQuery = query(
        collection(db, 'claim_requests'),
        where('creatorId', '==', creator.uid),
        where('status', 'in', ['pending', 'approved'])
    );
    const existingClaimsSnap = await getDocs(existingClaimsQuery);
    if (!existingClaimsSnap.empty) {
        throw new Error("You already have a pending or approved claim request.");
    }

    const { available } = await calculateCreatorUsdtEarnings(creator.uid);
    if (available <= 0) {
        throw new Error("You have no available USDT to claim.");
    }

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

export async function updateClaimRequestStatus(
    requestId: string, 
    status: ClaimRequest['status'], 
    adminNote?: string, 
    txHash?: string
): Promise<void> {
    const requestRef = doc(db, 'claim_requests', requestId);
    // ... (rest of function is fine)
}

// Stubs for functions that might be needed by other components
export const confirmUlcPurchase = async (user: UserProfile, amount: number, network: string, txHash: string): Promise<number> => { console.log("confirmUlcPurchase called"); return 0; }
