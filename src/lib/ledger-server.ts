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
