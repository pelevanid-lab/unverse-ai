
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
        config.protocolFloorPrice = config.listingPriceUSDT || 0.015;
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
    const targetCap = config.targetCapitalizationUSDT || 15000000;
    
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
    const userDocRef = doc(db, 'users', address);
    const configRef = doc(db, 'config', 'system');
    
    const batch = writeBatch(db);
    
    // 1. Record in Ledger
    const ledgerRef = doc(collection(db, 'ledger'));
    batch.set(ledgerRef, {
        fromWallet: "SYSTEM_PROMO_POOL",
        toUserId: address,
        toWallet: address,
        amount: 15, // Reduced from 100 (User Request)
        currency: 'ULC',
        type: 'welcome_bonus',
        timestamp: Date.now(),
    });

    // 2. Update User Profile
    batch.update(userDocRef, {
        welcomeBonusClaimed: true,
        'ulcBalance.available': increment(15)
    });

    // 3. Update Global Promo Pool
    batch.update(configRef, {
        'pools.promo': increment(-15)
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
    
    const creatorRatio = 0.85;
    const platformMarginRatio = 0.15;
    
    const treasuryRatio = config.subscription_treasury_ratio || 0.67;
    const buybackRatio = config.subscription_buyback_ratio || 0.33;

    const platformMargin = subscriptionPrice * platformMarginRatio;
    const treasuryShare = platformMargin * treasuryRatio;
    const buybackShare = platformMargin * buybackRatio;
    const creatorEarning = subscriptionPrice * creatorRatio;

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

    // 3. Update Creator USDT Balance
    const creatorRef = doc(db, 'users', creator.uid);
    batch.update(creatorRef, {
        'usdtBalance.available': increment(creatorEarning),
        totalEarnings: increment(creatorEarning)
    });

    // 4. Update Global USDT Stats
    const statsRef = doc(db, 'config', 'system');
    
    // Rule: 10% Treasury, 5% Buyback Staking Reward
    const buybackStakingShare = buybackShare; // Entire 5% goes to staking

    batch.update(statsRef, {
        totalTreasuryUSDT: increment(treasuryShare),
        totalBuybackStakingUSDT: increment(buybackStakingShare)
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
        type: 'buyback_staking_fee',
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
        totalBuybackStakingUSDT: 0,
        totalPresaleSold: 0,
        totalStakedULC: 0,
        totalTreasuryUSDT: 0,
        treasury_wallets: {
            TON: "EQD09uY4E4729uY4E4729uY4E4729uY4E472",
            TRON: "TCY7Bm6hej8nwcjMDmXyYndjZBE4Zpmk2",
        },
        // Buyback Defaults (Post-Launch Preparation)
        treasury_buyback_enabled: true,
        treasury_buyback_ratio: 0.3,
        operationCostUSDT: 0,
        treasuryUSDTBalanceManual: 0,
        presaleCompleted: false,
        tokenLaunchCompleted: false,
        marketLiquidityReady: false,
        // Pre-Sale Tier Upgrade 2026
        presaleAllocationULC: 100000000,
        currentPresaleStage: 1,
        presalePriceUSDT: 0.009,
        listingPriceUSDT: 0.015,
    };

    // We use merge: true to not overwrite currently accumulated values like totalTreasuryUSDT, 
    // but we ensure all keys are strictly aligned to the codebase structure.
    await setDoc(configRef, syncedConfig, { merge: true });
    
    systemConfigCache = null; 
    return syncedConfig;
}

export async function handleStaking(user: UserProfile, amount: number) {
    if (amount <= 0) throw new Error("Amount must be positive");
    
    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User not found");
        
        const userData = userSnap.data() as UserProfile;
        const available = userData.ulcBalance?.available || 0;
        
        if (available < amount) throw new Error("INSUFFICIENT_BALANCE");

        // 1. Move Balance
        transaction.update(userRef, {
            'ulcBalance.available': increment(-amount),
            'ulcBalance.staked': increment(amount)
        });

        // 2. Update Global Stats
        const configRef = doc(db, 'config', 'system');
        transaction.update(configRef, {
            totalStakedULC: increment(amount)
        });

        // 3. Ledger Entry
        const ledgerRef = doc(collection(db, 'ledger'));
        transaction.set(ledgerRef, {
            type: 'staking_deposit',
            userId: user.uid,
            amount: amount,
            currency: 'ULC',
            timestamp: Date.now()
        });
    });
}

export async function handleUnstaking(user: UserProfile, amount: number) {
    if (amount <= 0) throw new Error("Amount must be positive");
    
    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User not found");
        
        const userData = userSnap.data() as UserProfile;
        const staked = userData.ulcBalance?.staked || 0;
        
        if (staked < amount) throw new Error("INSUFFICIENT_STAKED_BALANCE");

        // 1. Move Balance
        transaction.update(userRef, {
            'ulcBalance.available': increment(amount),
            'ulcBalance.staked': increment(-amount)
        });

        // 2. Update Global Stats
        const configRef = doc(db, 'config', 'system');
        transaction.update(configRef, {
            totalStakedULC: increment(-amount)
        });

        // 3. Ledger Entry
        const ledgerRef = doc(collection(db, 'ledger'));
        transaction.set(ledgerRef, {
            type: 'staking_withdraw',
            userId: user.uid,
            amount: amount,
            currency: 'ULC',
            timestamp: Date.now()
        });
    });
}

export async function sealEconomyAction() {
    const sealFn = httpsCallable(functions, "sealEconomy_v2");
    return await sealFn();
}

export async function executeBuybackAction(data: {
    amountUSDT: number;
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
    // 100% Profit Margin: Ensure no generation goes below a 5 ULC base (covers $0.03 cost at $0.015/ULC for 2x margin)
    // If original cost is 10 (Consistent), regen is 5. If original cost is 5 (Standard), regen is 5.
    const finalCost = isRegeneration ? Math.max(5, Math.floor(cost / 2)) : cost;
    return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error("User not found");
        
        const userData = userSnap.data() as UserProfile;
        const balance = userData.ulcBalance?.available || 0;
        if (balance < finalCost) throw new Error("INSUFFICIENT_ULC");
        // The 'cost' parameter is now used directly, removing the shadowed 'const cost = 3;'
        // The fixed shares are replaced with calculated percentages.

        const config = await getSystemConfig();
        const tSplit = config.ai_generation_treasury_split ?? 7;
        const bSplit = config.ai_generation_burn_split ?? 3;
        const totalSplit = tSplit + bSplit;

        const treasuryShare = Number((cost * (tSplit / totalSplit)).toFixed(2));
        const burnShare = Number((cost - treasuryShare).toFixed(2));

        // 1. Deduct from user
        transaction.update(userRef, {
            'ulcBalance.available': increment(-finalCost)
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
            amount: finalCost,
            currency: 'ULC',
            timestamp: Date.now(),
            details: { treasury: treasuryShare, burn: burnShare }
        });

        return ledgerRef.id;
    });
}

export async function refundAiGenerationPayment(userId: string, ledgerId: string, cost: number): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const config = await getSystemConfig();
        const tSplit = config.ai_generation_treasury_split ?? 7;
        const bSplit = config.ai_generation_burn_split ?? 3;
        const totalSplit = tSplit + bSplit;

        const treasuryShare = Number((cost * (tSplit / totalSplit)).toFixed(2));
        const burnShare = Number((cost - treasuryShare).toFixed(2));

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

/**
 * AI Creator Mode Activation (10 ULC for renewal, First time FREE)
 * 70% Treasury / 30% Burn
 */
export async function processAiCreatorActivation(userId: string): Promise<string> {
    return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User not found");
        
        const userData = userSnap.data() as UserProfile;
        const now = Date.now();

        // Check if already active
        if (userData.aiCreatorModeExpiresAt && userData.aiCreatorModeExpiresAt > now) {
            throw new Error("ALREADY_ACTIVE");
        }

        // Logic: First time is FREE. Subsequent activations are 10 ULC.
        const firstTime = !userData.aiCreatorModeActivatedAt;
        const finalCost = firstTime ? 0 : 10;

        const balance = userData.ulcBalance?.available || 0;
        if (balance < finalCost) throw new Error("INSUFFICIENT_ULC");

        const treasuryShare = Number((finalCost * 0.70).toFixed(2));
        const burnShare = Number((finalCost - treasuryShare).toFixed(2));

        const expiresAt = now + (30 * 24 * 60 * 60 * 1000);

        transaction.update(userRef, {
            'ulcBalance.available': increment(-finalCost),
            aiCreatorModeEnabled: true,
            aiCreatorModeActivatedAt: firstTime ? now : userData.aiCreatorModeActivatedAt,
            aiCreatorModeExpiresAt: expiresAt,
            aiCreatorModeLastChargedAt: now
        });

        if (finalCost > 0) {
            const statsRef = doc(db, 'config', 'stats');
            transaction.set(statsRef, {
                totalTreasuryULC: increment(treasuryShare),
                totalBurnedULC: increment(burnShare)
            }, { merge: true });
        }

        const ledgerRef = doc(collection(db, 'ledger'));
        transaction.set(ledgerRef, {
            type: 'ai_creator_activation',
            fromUserId: userId,
            amount: finalCost,
            currency: 'ULC',
            timestamp: now,
            details: { treasury: treasuryShare, burn: burnShare, expiresAt }
        });

        return ledgerRef.id;
    });
}

/**
 * AI Creator Mode Daily Generation (2 ULC)
 * 70% Treasury / 30% Burn
 */
export async function processAiCreatorGeneration(userId: string): Promise<string> {
    const cost = 2;
    return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User not found");
        
        const userData = userSnap.data() as UserProfile;
        const now = Date.now();

        // Ensure active
        if (!userData.aiCreatorModeExpiresAt || userData.aiCreatorModeExpiresAt < now) {
            throw new Error("COPILOT_MODE_EXPIRED");
        }

        const finalCost = cost;
        const balance = userData.ulcBalance?.available || 0;
        if (balance < finalCost) throw new Error("INSUFFICIENT_ULC");

        const treasuryShare = Number((finalCost * 0.70).toFixed(2));
        const burnShare = Number((finalCost - treasuryShare).toFixed(2));

        transaction.update(userRef, {
            'ulcBalance.available': increment(-finalCost),
            aiCreatorModeLastRunAt: now
        });

        const statsRef = doc(db, 'config', 'stats');
        transaction.set(statsRef, {
            totalTreasuryULC: increment(treasuryShare),
            totalBurnedULC: increment(burnShare)
        }, { merge: true });

        const ledgerRef = doc(collection(db, 'ledger'));
        transaction.set(ledgerRef, {
            type: 'ai_creator_generation',
            fromUserId: userId,
            amount: finalCost,
            currency: 'ULC',
            timestamp: now,
            details: { treasury: treasuryShare, burn: burnShare }
        });

        return ledgerRef.id;
    });
}
