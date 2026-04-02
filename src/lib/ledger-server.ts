import { adminDb } from './firebase-admin';
import * as admin from 'firebase-admin';

export async function processAiGenerationPaymentServer(userId: string, cost: number, isRegeneration?: boolean): Promise<string> {
    const finalCost = isRegeneration ? Math.max(5, Math.floor(cost / 2)) : cost;
    
    return await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists) throw new Error("User not found");
        
        const userData = userSnap.data() as any;
        const balance = userData.ulcBalance?.available || 0;
        if (balance < finalCost) throw new Error("INSUFFICIENT_ULC");

        const configSnap = await adminDb.collection('config').doc('system').get();
        const config = configSnap.exists ? configSnap.data() : {};
        const tSplit = config?.ai_generation_treasury_split ?? 7;
        const bSplit = config?.ai_generation_burn_split ?? 3;
        const totalSplit = tSplit + bSplit;

        const treasuryShare = Number((cost * (tSplit / totalSplit)).toFixed(2));
        const burnShare = Number((cost - treasuryShare).toFixed(2));

        // 1. Deduct from user
        transaction.update(userRef, {
            'ulcBalance.available': admin.firestore.FieldValue.increment(-finalCost)
        });

        // 2. Update Global Treasury and Burn Stats
        const statsRef = adminDb.collection('config').doc('stats');
        transaction.set(statsRef, {
            totalTreasuryULC: admin.firestore.FieldValue.increment(treasuryShare),
            totalBurnedULC: admin.firestore.FieldValue.increment(burnShare)
        }, { merge: true });

        // 3. Record in Ledger
        const ledgerRef = adminDb.collection('ledger').doc();
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

export async function refundAiGenerationPaymentServer(userId: string, ledgerId: string, cost: number): Promise<void> {
    await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const configSnap = await adminDb.collection('config').doc('system').get();
        const config = configSnap.exists ? configSnap.data() : {};
        
        const tSplit = config?.ai_generation_treasury_split ?? 7;
        const bSplit = config?.ai_generation_burn_split ?? 3;
        const totalSplit = tSplit + bSplit;

        const treasuryShare = Number((cost * (tSplit / totalSplit)).toFixed(2));
        const burnShare = Number((cost - treasuryShare).toFixed(2));

        // 1. Refund user
        transaction.update(userRef, {
            'ulcBalance.available': admin.firestore.FieldValue.increment(cost)
        });

        // 2. Reverse Stats
        const statsRef = adminDb.collection('config').doc('stats');
        transaction.set(statsRef, {
            totalTreasuryULC: admin.firestore.FieldValue.increment(-treasuryShare),
            totalBurnedULC: admin.firestore.FieldValue.increment(-burnShare)
        }, { merge: true });

        // 3. Record Refund Entry
        const refundLedgerRef = adminDb.collection('ledger').doc();
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

export async function processAiCreatorActivationServer(userId: string): Promise<string> {
    return await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("User not found");
        
        const userData = userSnap.data() as any;
        const now = Date.now();

        const firstTime = !userData.aiCreatorModeActivatedAt;
        const finalCost = firstTime ? 0 : 10;

        const balance = userData.ulcBalance?.available || 0;
        if (balance < finalCost) throw new Error("INSUFFICIENT_ULC");

        const treasuryShare = Number((finalCost * 0.70).toFixed(2));
        const burnShare = Number((finalCost - treasuryShare).toFixed(2));
        const expiresAt = now + (30 * 24 * 60 * 60 * 1000);

        transaction.update(userRef, {
            'ulcBalance.available': admin.firestore.FieldValue.increment(-finalCost),
            aiCreatorModeEnabled: true,
            aiCreatorModeActivatedAt: firstTime ? now : userData.aiCreatorModeActivatedAt,
            aiCreatorModeExpiresAt: expiresAt,
            aiCreatorModeLastChargedAt: now
        });

        if (finalCost > 0) {
            const statsRef = adminDb.collection('config').doc('stats');
            transaction.set(statsRef, {
                totalTreasuryULC: admin.firestore.FieldValue.increment(treasuryShare),
                totalBurnedULC: admin.firestore.FieldValue.increment(burnShare)
            }, { merge: true });
        }

        const ledgerRef = adminDb.collection('ledger').doc();
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

export async function processAiCreatorGenerationServer(userId: string): Promise<string> {
    const cost = 2;
    return await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("User not found");
        
        const userData = userSnap.data() as any;
        const now = Date.now();

        if (!userData.aiCreatorModeExpiresAt || userData.aiCreatorModeExpiresAt < now) {
            throw new Error("UNIQ_MODE_EXPIRED");
        }

        const balance = userData.ulcBalance?.available || 0;
        if (balance < cost) throw new Error("INSUFFICIENT_ULC");

        const treasuryShare = Number((cost * 0.70).toFixed(2));
        const burnShare = Number((cost - treasuryShare).toFixed(2));

        transaction.update(userRef, {
            'ulcBalance.available': admin.firestore.FieldValue.increment(-cost),
            aiCreatorModeLastRunAt: now
        });

        const statsRef = adminDb.collection('config').doc('stats');
        transaction.set(statsRef, {
            totalTreasuryULC: admin.firestore.FieldValue.increment(treasuryShare),
            totalBurnedULC: admin.firestore.FieldValue.increment(burnShare)
        }, { merge: true });

        const ledgerRef = adminDb.collection('ledger').doc();
        transaction.set(ledgerRef, {
            type: 'ai_creator_generation',
            fromUserId: userId,
            amount: cost,
            currency: 'ULC',
            timestamp: now,
            details: { treasury: treasuryShare, burn: burnShare }
        });

        return ledgerRef.id;
    });
}

export async function processUniqProUnlockServer(userId: string): Promise<string> {
    const cost = 2; // Standard cost is 2 ULC
    return await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("User not found");
        
        const userData = userSnap.data() as any;
        if (userData.isAdvancedModeUnlocked) {
            throw new Error("ALREADY_UNLOCKED");
        }

        // 🌟 PREMIUM BYPASS: If user has an active Uniq Premium subscription (aiCreatorModeExpiresAt), cost is 0
        const now = Date.now();
        const isPremium = userData.aiCreatorModeExpiresAt && userData.aiCreatorModeExpiresAt > now;
        const finalCost = isPremium ? 0 : cost;

        const balance = userData.ulcBalance?.available || 0;
        if (balance < finalCost) throw new Error("INSUFFICIENT_ULC");

        const treasuryShare = Number((finalCost * 0.70).toFixed(2));
        const burnShare = Number((finalCost - treasuryShare).toFixed(2));

        transaction.update(userRef, {
            'ulcBalance.available': admin.firestore.FieldValue.increment(-finalCost),
            isAdvancedModeUnlocked: true
        });

        if (finalCost > 0) {
            const statsRef = adminDb.collection('config').doc('stats');
            transaction.set(statsRef, {
                totalTreasuryULC: admin.firestore.FieldValue.increment(treasuryShare),
                totalBurnedULC: admin.firestore.FieldValue.increment(burnShare)
            }, { merge: true });
        }

        const ledgerRef = adminDb.collection('ledger').doc();
        transaction.set(ledgerRef, {
            type: 'premium_unlock',
            fromUserId: userId,
            amount: finalCost,
            currency: 'ULC',
            timestamp: now,
            details: { 
                treasury: treasuryShare, 
                burn: burnShare, 
                feature: 'uniq_pro_engine',
                isPremiumBypass: isPremium
            }
        });

        return ledgerRef.id;
    });
}

export async function processUniqTwinUnlockServer(userId: string, path: 'photos' | 'imaginary'): Promise<string> {
    const cost = path === 'photos' ? 500 : 700;
    return await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("User not found");

        const userData = userSnap.data() as any;
        if (userData.uniq?.unlocked) throw new Error("ALREADY_UNLOCKED");

        const balance = userData.ulcBalance?.available || 0;
        if (balance < cost) throw new Error("INSUFFICIENT_ULC");

        const now = Date.now();
        const treasuryShare = Number((cost * 0.70).toFixed(2));
        const burnShare = Number((cost - treasuryShare).toFixed(2));

        transaction.update(userRef, {
            'ulcBalance.available': admin.firestore.FieldValue.increment(-cost),
            'uniq.unlocked': true,
            'uniq.unlocked_at': now,
            'uniq.twin_path': path,
            'uniq.twin_status': 'learning',
            'uniq.neural_progress': 0,
            'uniq.character_reset_count': 0,
        });

        const statsRef = adminDb.collection('config').doc('stats');
        transaction.set(statsRef, {
            totalTreasuryULC: admin.firestore.FieldValue.increment(treasuryShare),
            totalBurnedULC: admin.firestore.FieldValue.increment(burnShare)
        }, { merge: true });

        const ledgerRef = adminDb.collection('ledger').doc();
        transaction.set(ledgerRef, {
            type: 'uniq_twin_unlock',
            fromUserId: userId,
            amount: cost,
            currency: 'ULC',
            timestamp: now,
            details: { treasury: treasuryShare, burn: burnShare, path }
        });

        return ledgerRef.id;
    });
}

export async function recordUsdcSubscriptionServer(
    userId: string,
    creatorId: string,
    network: string,
    txHash: string
): Promise<void> {
    await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const creatorRef = adminDb.collection('users').doc(creatorId);
        const configRef = adminDb.collection('config').doc('system');

        const userSnap = await transaction.get(userRef);
        const creatorSnap = await transaction.get(creatorRef);
        const configSnap = await transaction.get(configRef);

        if (!userSnap.exists) throw new Error("User not found");
        if (!creatorSnap.exists) throw new Error("Creator not found");
        
        const creatorData = creatorSnap.data() as any;
        if (!creatorData.isCreator) throw new Error("Target user is not a creator");

        const config = configSnap.exists ? configSnap.data() : {};
        const subscriptionPrice = creatorData.creatorData?.subscriptionPriceMonthly ?? 0;
        
        const creatorRatio = 0.85;
        const platformMarginRatio = 0.15;
        const treasuryRatio = config?.subscription_treasury_ratio || 0.67;
        const buybackRatio = config?.subscription_buyback_ratio || 0.33;

        const platformMargin = subscriptionPrice * platformMarginRatio;
        const treasuryShare = platformMargin * treasuryRatio;
        const buybackShare = platformMargin * buybackRatio;
        const creatorEarning = subscriptionPrice * creatorRatio;

        const now = Date.now();
        const duration = 30 * 24 * 60 * 60 * 1000;

        // 1. Manage Subscription Record
        const subQuery = adminDb.collection('subscriptions')
            .where('userId', '==', userId)
            .where('creatorId', '==', creatorId)
            .where('status', '==', 'active')
            .limit(1);
        
        const subSnap = await subQuery.get();
        let newExpiry;
        if (!subSnap.empty) {
            const currentSub = subSnap.docs[0];
            const currentExpiry = currentSub.data().expiresAt;
            newExpiry = Math.max(now, currentExpiry) + duration;
            transaction.update(currentSub.ref, { expiresAt: newExpiry, updatedAt: now });
        } else {
            newExpiry = now + duration;
            const subRef = adminDb.collection('subscriptions').doc();
            transaction.set(subRef, {
                userId,
                creatorId,
                startedAt: now,
                expiresAt: newExpiry,
                status: 'active'
            });
        }

        // 2. Ledger Entries
        const paymentRef = adminDb.collection('ledger').doc();
        transaction.set(paymentRef, {
            type: 'subscription_payment',
            timestamp: now,
            fromUserId: userId,
            toUserId: creatorId,
            amount: subscriptionPrice,
            currency: 'USDC',
            network: network,
            txHash: txHash,
            toWallet: config?.treasury_address,
        });

        transaction.set(adminDb.collection('ledger').doc(), {
            type: 'creator_earning',
            timestamp: now,
            creatorId: creatorId,
            toUserId: creatorId,
            userId: userId,
            amount: creatorEarning,
            currency: 'USDC',
            referenceId: paymentRef.id,
        });

        // 3. Update Creator Balances
        transaction.update(creatorRef, {
            'usdcBalance.available': admin.firestore.FieldValue.increment(creatorEarning),
            totalEarnings: admin.firestore.FieldValue.increment(creatorEarning)
        });

        // 4. Global Stats
        const statsRef = adminDb.collection('config').doc('stats');
        transaction.set(statsRef, {
            totalTreasuryUSDC: admin.firestore.FieldValue.increment(treasuryShare),
            totalBuybackStakingUSDC: admin.firestore.FieldValue.increment(buybackShare)
        }, { merge: true });

        // 5. Update User's Active Subscriptions
        const userData = userSnap.data() as any;
        const currentSubs = userData.activeSubscriptionIds || [];
        if (!currentSubs.includes(creatorId)) {
            transaction.update(userRef, {
                activeSubscriptionIds: admin.firestore.FieldValue.arrayUnion(creatorId)
            });
        }
    });
}

export async function grantWelcomeBonusServer(userId: string): Promise<void> {
    await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const configRef = adminDb.collection('config').doc('system');
        
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("User not found");
        
        const userData = userSnap.data() as any;
        if (userData.welcomeBonusClaimed) return; // Fail-safe

        const bonusAmount = 15;

        // 1. Record in Ledger
        const ledgerRef = adminDb.collection('ledger').doc();
        transaction.set(ledgerRef, {
            fromWallet: "SYSTEM_PROMO_POOL",
            toUserId: userId,
            toWallet: userId,
            amount: bonusAmount,
            currency: 'ULC',
            type: 'welcome_bonus',
            timestamp: Date.now(),
        });

        // 2. Update User Profile
        transaction.update(userRef, {
            welcomeBonusClaimed: true,
            'ulcBalance.available': admin.firestore.FieldValue.increment(bonusAmount)
        });

        // 3. Update Global Promo Pool
        transaction.update(configRef, {
            'pools.promo': admin.firestore.FieldValue.increment(-bonusAmount)
        });
    });
}

export async function handleStakingServer(userId: string, amount: number): Promise<void> {
    if (amount <= 0) throw new Error("Amount must be positive");
    
    await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("User not found");
        
        const userData = userSnap.data() as any;
        const available = userData.ulcBalance?.available || 0;
        if (available < amount) throw new Error("INSUFFICIENT_BALANCE");

        // 1. Move Balance
        transaction.update(userRef, {
            'ulcBalance.available': admin.firestore.FieldValue.increment(-amount),
            'ulcBalance.staked': admin.firestore.FieldValue.increment(amount)
        });

        // 2. Update Global Stats
        const statsRef = adminDb.collection('config').doc('stats');
        transaction.set(statsRef, {
            totalStakedULC: admin.firestore.FieldValue.increment(amount)
        }, { merge: true });

        // 3. Ledger Entry
        const ledgerRef = adminDb.collection('ledger').doc();
        transaction.set(ledgerRef, {
            type: 'staking_deposit',
            userId: userId,
            amount: amount,
            currency: 'ULC',
            timestamp: Date.now()
        });
    });
}

export async function handleUnstakingServer(userId: string, amount: number): Promise<void> {
    if (amount <= 0) throw new Error("Amount must be positive");
    
    await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("User not found");
        
        const userData = userSnap.data() as any;
        const staked = userData.ulcBalance?.staked || 0;
        if (staked < amount) throw new Error("INSUFFICIENT_STAKED_BALANCE");

        // 1. Move Balance
        transaction.update(userRef, {
            'ulcBalance.available': admin.firestore.FieldValue.increment(amount),
            'ulcBalance.staked': admin.firestore.FieldValue.increment(-amount)
        });

        // 2. Update Global Stats
        const statsRef = adminDb.collection('config').doc('stats');
        transaction.set(statsRef, {
            totalStakedULC: admin.firestore.FieldValue.increment(-amount)
        }, { merge: true });

        // 3. Ledger Entry
        const ledgerRef = adminDb.collection('ledger').doc();
        transaction.set(ledgerRef, {
            type: 'staking_withdraw',
            userId: userId,
            amount: amount,
            currency: 'ULC',
            timestamp: Date.now()
        });
    });
}
