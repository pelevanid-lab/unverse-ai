
import { db } from './firebase';
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { UserProfile, Creator, SystemConfig, LedgerEntry, LedgerEntryType, ClaimRequest } from './types';

let systemConfigCache: SystemConfig | null = null;

// --- Corrected getSystemConfig with the right path --- 
export async function getSystemConfig(): Promise<SystemConfig> {
    if (systemConfigCache) return systemConfigCache;
    // Correct path is 'config/system' as shown in the screenshot
    const docRef = doc(db, 'config', 'system');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        console.error("CRITICAL: System config document not found at 'config/system'");
        throw new Error("System config not found!");
    }
    systemConfigCache = docSnap.data() as SystemConfig;
    return systemConfigCache;
}

// --- Wallet Address Validation --- 
function isValidTronAddress(address: string): boolean {
    return typeof address === 'string' && address.startsWith('T') && address.length > 30;
}

function isValidTonAddress(address: string): boolean {
    return typeof address === 'string' && address.startsWith('EQ') && address.length > 40;
}

/**
 * A generic function to add a new entry to the ledger. Fixes the previous build error.
 */
export async function recordTransaction(entry: Omit<LedgerEntry, 'id' | 'timestamp'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'ledger'), {
        ...entry,
        timestamp: Date.now(),
    });
    return docRef.id;
}

/**
 * Calculates the creator's available USDT balance for claiming.
 * Available = SUM(creator_earning) - SUM(claim_requests where status IS NOT 'rejected')
 */
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

/**
 * Creates a new claim request for a creator with validation.
 */
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
         throw new Error(`Invalid TRON wallet address format. It must start with \'T\'.`);
    }
    if (network === 'TON' && !isValidTonAddress(walletAddress)) {
         throw new Error(`Invalid TON wallet address format. It must start with \'EQ\'.`);
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

/**
 * Admin action to update the status of a claim request.
 * Creates a ledger entry when a claim is marked as 'completed'.
 */
export async function updateClaimRequestStatus(
    requestId: string, 
    status: ClaimRequest['status'], 
    adminNote?: string, 
    txHash?: string
): Promise<void> {
    const requestRef = doc(db, 'claim_requests', requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error("Claim request not found.");
    const claimData = requestSnap.data() as ClaimRequest;

    const batch = writeBatch(db);
    const updateData: Partial<ClaimRequest> = { status };

    if (status === 'approved') updateData.approvedAt = Date.now();
    if (status === 'rejected') updateData.adminNote = adminNote || "Rejected by admin.";
    if (status === 'completed') {
        if (!txHash) throw new Error("Transaction Hash is required.");
        updateData.completedAt = Date.now();
        updateData.txHash = txHash;

        const config = await getSystemConfig();
        const fromWallet = config.treasury_wallets[claimData.network];
        if (!fromWallet) throw new Error(`Treasury wallet for ${claimData.network} not configured.`);

        const ledgerEntry: Omit<LedgerEntry, 'id' | 'timestamp'> = {
            type: 'creator_claim_executed',
            amount: claimData.amount,
            currency: 'USDT',
            network: claimData.network,
            fromWallet: fromWallet, 
            toWallet: claimData.walletAddress,
            creatorId: claimData.creatorId,
            referenceId: requestId,
            txHash: txHash,
        };
        const ledgerRef = doc(collection(db, "ledger"));
        batch.set(ledgerRef, { ...ledgerEntry, timestamp: Date.now() });
    }

    batch.update(requestRef, updateData);
    await batch.commit();
}

// --- Stubs for functions mentioned in wallet/page.tsx to avoid compilation errors ---
export const confirmUlcPurchase = async (user: UserProfile, amount: number, network: string, txHash: string): Promise<number> => { console.log("confirmUlcPurchase called"); return 0; }
export const claimVestedTokens = async (scheduleId: string): Promise<void> => { console.log("claimVestedTokens called"); }
export const calculateVestingClaimable = (schedule: any): number => { console.log("calculateVestingClaimable called"); return 0; }
