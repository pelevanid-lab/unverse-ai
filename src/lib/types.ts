
export interface UserProfile {
    uid: string;
    email?: string;
    username: string;
    bio?: string;
    avatar?: string;
    walletAddress: string;
    ulcBalance: {
        available: number;
        locked: number;
        claimable: number;
    };
    paymentWallets?: {
        TRON?: NetworkWallet;
        TON?: NetworkWallet;
    };
    preferredPaymentNetwork?: 'TRON' | 'TON';
    isAdmin?: boolean;
    isCreator?: boolean;
    activeSubscriptionIds?: string[];
    createdAt: number;
    creatorData?: {
        category?: string;
        coverImage?: string;
        subscriptionPriceMonthly?: number;
        defaultClaimNetwork?: "TRON" | "TON";
        collectionWallets?: {
            TRON?: {
                address: string;
                verified: boolean;
            };
            TON?: {
                address: string;
                verified: boolean;
            };
        };
        creatorStatus?: string;
        visibility?: string;
        totalUnlocks?: number;
    };
}

export interface NetworkWallet {
    address: string;
    verified: boolean;
}

export interface ClaimRequest {
    id: string;
    creatorId: string;
    amount: number;
    currency: "USDT";
    network: "TRON" | "TON";
    walletAddress: string;
    status: "pending" | "approved" | "completed" | "rejected";
    requestedAt: number;
    approvedAt?: number;
    completedAt?: number;
    txHash?: string;
    adminNote?: string;
}

export interface ContentPost { /* ... */ }

export type LedgerEntryType =
    'ulc_purchase' |
    'subscription_payment' |
    'creator_earning' |
    'platform_commission' |
    'vesting_release' |
    'promo_airdrop' |
    'creator_claim_executed' |
    'internal_ulc_transfer';

export interface LedgerEntry {
    id: string;
    fromWallet: string;
    toWallet: string;
    amount: number;
    currency: 'ULC' | 'USDT';
    type: LedgerEntryType;
    timestamp: number;
    referenceId?: string;
    network?: 'TRON' | 'TON';
    txHash?: string;
    creatorId?: string; // Added for easier querying of claim history
    fromUserId?: string;
    toUserId?: string;
    memo?: string;
    metadata?: Record<string, any>;
}

export interface VestingSchedule { /* ... */ }
export type SystemWalletType = string;
export interface SystemWallet { /* ... */ }
export interface SystemConfig { /* ... */ }
