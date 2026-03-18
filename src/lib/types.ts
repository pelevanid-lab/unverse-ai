export interface NetworkWallet {
    address: string;
    verified: boolean;
    lastUsed?: number;
}

export interface UserProfile {
    uid: string;
    email?: string;
    username: string;
    walletAddress: string;
    createdAt: number;
    updatedAt?: number;
    bio?: string;
    avatar?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    isCreator?: boolean;
    ulcBalance?: {
        available: number;
        locked: number;
        claimable: number;
    };
    totalEarnings?: number;
    totalSpent?: number;
    welcomeBonusClaimed?: boolean;
    unlockedPostIds?: string[];
    activeSubscriptionIds?: string[];
    paymentWallets?: {
        TRON?: NetworkWallet | null;
        TON?: NetworkWallet | null;
    };
    preferredPaymentNetwork?: 'TRON' | 'TON';
    creatorData?: Creator;
    isFrozen?: boolean;
}

export interface Creator {
    uid: string;
    username: string;
    bio?: string;
    avatar?: string;
    subscriptionPriceMonthly: number;
    payoutWallets?: {
        TRON?: { address: string };
        TON?: { address: string };
    };
    preferredPayoutNetwork?: 'TRON' | 'TON';
    category?: string;
    coverImage?: string;
    creatorStatus?: 'active' | 'inactive';
    visibility?: 'public' | 'private';
}

export interface SystemConfig {
    treasury_wallets: {
        TRON: string;
        TON: string;
    };
    platform_subscription_fee_split: number;
    wallets: {
        promo_pool: {
            address: string;
        }
    };
    admin_wallet_address: string;
    genesis_initialized?: boolean;
    ulc_token_network?: string;
}

export type LedgerEntryType = 
    | 'welcome_bonus' 
    | 'subscription_payment_usdt' 
    | 'creator_earning' 
    | 'premium_unlock' 
    | 'tip' 
    | 'withdrawal'
    | 'ulc_purchase'
    | 'ulc_purchase_payment'
    | 'staking_reward'
    | 'treasury_fee';

export interface LedgerEntry {
    id: string;
    timestamp: number;
    type: LedgerEntryType;
    amount: number;
    currency: 'ULC' | 'USDT';
    userId?: string;
    fromUserId?: string;
    toUserId?: string;
    fromWallet?: string;
    toWallet: string;
    creatorId?: string;
    txHash?: string;
    network?: 'TRON' | 'TON';
    memo?: string;
    referenceId?: string;
    platformFee?: number;
    metadata?: any;
}

export interface ClaimRequest {
    id: string;
    creatorId: string;
    amount: number;
    currency: 'USDT' | 'ULC';
    network: 'TRON' | 'TON';
    walletAddress: string;
    status: 'pending' | 'approved' | 'completed' | 'rejected';
    requestedAt: number;
}

export type PostContentType = "public" | "premium" | "limited";

export interface ContentPost {
    id: string;
    creatorId: string;
    creatorName?: string;
    creatorAvatar?: string;
    title?: string;
    content: string; // Used for caption
    contentType: PostContentType;
    unlockPrice: number; // Price in ULC (used for premium)
    createdAt: number;
    updatedAt?: number;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    
    // Limited edition fields
    limited?: {
        totalSupply: number;
        soldCount: number;
        price: number;
    };

    // Stats
    likes?: number;
    unlockCount?: number;
    earningsULC?: number;
}

export interface CreatorMedia {
    id: string;
    creatorId: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    contentType: PostContentType;
    priceULC: number;
    status: 'draft' | 'scheduled' | 'published';
    createdAt: any;
    scheduledFor?: number;
    limited?: {
        totalSupply: number;
        price: number;
    };
}

export interface GroupedLedgerEntry {
    id: string;
    timestamp: number;
    mainEntry: LedgerEntry;
    relatedEntries: LedgerEntry[];
}
