
import { db } from './firebase';
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, writeBatch, doc, or, updateDoc, setDoc, limit } from 'firebase/firestore';
import { UserProfile, Creator, SystemConfig, LedgerEntry, LedgerEntryType, ClaimRequest, SubscriptionRecord, AIMuse } from './types';

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
    console.log("Seeding AI Muses...");
    const batch = writeBatch(db);

    const musesData: Omit<AIMuse, 'id'>[] = [
        {
            name: "Isabella",
            avatar: "https://picsum.photos/seed/isabella/400/400",
            category: "Luxury Lifestyle",
            personality: "Sophisticated, elegant, and world-traveler. Loves fine dining and exclusive events.",
            tone: "Refined and encouraging",
            description: "Your guide to the world's most exclusive destinations.",
            chatCount: 0,
            isActive: true
        },
        {
            name: "Elena",
            avatar: "https://picsum.photos/seed/elena/400/400",
            category: "Fitness & Wellness",
            personality: "Energetic, disciplined, and mindful. Expert in yoga and high-performance training.",
            tone: "Motivating and direct",
            description: "Unlocking your peak physical and mental potential.",
            chatCount: 0,
            isActive: true
        },
        {
            name: "Chloe",
            avatar: "https://picsum.photos/seed/chloe/400/400",
            category: "Digital Nomad / Tech",
            personality: "Witty, adventurous, and futuristic. Obsessed with Web3, AI, and remote work hacks.",
            tone: "Casual and intellectually stimulating",
            description: "Navigating the digital frontier one block at a time.",
            chatCount: 0,
            isActive: true
        }
    ];

    for (const muse of musesData) {
        const museId = muse.name.toLowerCase();
        const museRef = doc(db, 'ai_muses', museId);
        const userRef = doc(db, 'users', museId);

        // 1. Create AI Muse Config
        batch.set(museRef, muse);

        // 2. Create corresponding User/Creator record
        batch.set(userRef, {
            uid: museId,
            username: muse.name,
            avatar: muse.avatar,
            bio: muse.description,
            isCreator: true,
            isAiContent: true,
            createdAt: Date.now(),
            creatorData: {
                subscriptionPriceMonthly: 15,
                category: muse.category,
                creatorStatus: 'active'
            },
            ulcBalance: { available: 1000, locked: 0, claimable: 0 }
        });

        // 3. Create 3 Seed Posts for each muse
        for (let i = 1; i <= 3; i++) {
            const postRef = doc(collection(db, 'posts'));
            batch.set(postRef, {
                creatorId: museId,
                creatorName: muse.name,
                creatorAvatar: muse.avatar,
                mediaUrl: `https://picsum.photos/seed/${museId}_${i}/800/1000`,
                mediaType: 'image',
                content: `AI Post #${i} from ${muse.name}. Exploring ${muse.category} vibes.`,
                contentType: 'public',
                unlockPrice: 0,
                createdAt: Date.now() - (i * 3600000), // Spaced by hours
                isAiContent: true,
                likes: Math.floor(Math.random() * 100),
                unlockCount: 0
            });
        }
    }

    await batch.commit();
    console.log("Muses and their content seeded successfully.");
}

export async function triggerGenesisAllocation(user: UserProfile) {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { 'ulcBalance.available': (user.ulcBalance?.available || 0) + 50000 });
}

export async function toggleUserFreeze(uid: string, freeze: boolean) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { isFrozen: freeze });
}
