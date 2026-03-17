
import { Timestamp } from 'firebase/firestore';

// Renamed from User to UserProfile to match the usage in the use-wallet hook.
// This ensures the application correctly types the user data, including the new fields.
export interface UserProfile {
    uid: string;
    walletAddress: string;
    username: string;
    avatar: string;
    bio?: string;
    isCreator?: boolean;
    createdAt: any; 
    totalEarnings?: number;
    totalSpent?: number;
    ulcBalance?: {
        available: number;
        locked: number;
        claimable: number;
    };
    welcomeBonusClaimed?: boolean;
    unlockedPostIds?: string[];
    activeSubscriptionIds?: string[];
}

export interface Creator {
    uid: string;
    walletAddress: string;
    username: string;
    avatar: string;
    bio?: string;
    coverImage?: string;
    subscriptionPrice?: number;
    followerCount?: number;
    payoutWalletAddress?: string;
    payoutNetwork?: 'TRON';
    payoutWalletVerified?: boolean;
}

export interface ContentPost {
    id: string;
    creatorId: string;
    caption?: string;
    mediaType: 'image' | 'video';
    mediaUrl: string;
    thumbnailUrl?: string; // For videos
    isPremium: boolean;
    priceULC?: number;
    likeCount: number;
    commentCount: number;
    createdAt: Timestamp;
    creator?: Creator;
    unlockCount?: number;
    revenue?: number;
}

export interface LedgerEntry {
    id?: string;
    fromWallet: string;
    toWallet: string;
    amount: number;
    currency: 'ULC' | 'USDT';
    type: 'tip' | 'subscription_payment' | 'premium_unlock' | 'creator_payout' | 'ai_chat_fee' | 'staking_reward' | 'subscription_fee' | 'subscription_buyback' | 'premium_unlock_fee' | 'genesis_allocation' | 'ulc_purchase' | 'vesting_claim' | 'admin_adjustment' | 'platform_commission' | 'treasury_usdt_inflow';
    timestamp: number;
    referenceId?: string; // post id, subscription id, etc.
    metadata?: any;
}

export interface Muse {
    id: string;
    name: string;
    avatar: string;
    description: string;
    personality: string;
    ownerId: string;
    lastchatted?: any;
}

export interface SystemConfig {
    treasury_wallet_address: string;
    treasury_network: string;
    admin_wallet_address: string;
    supported_usdt_networks: string[];
    ulc_token_network: string;
    ulc_presale_price: number;
    internal_ulc_purchase_price: number;
    amm_launch_price: number;
    amm_activation_threshold: number;
    amm_enabled: boolean;
    amm_mode: string;
    wallet_integration_enabled: boolean;
    subscription_split_enabled: boolean;
    creator_payout_mode: string;
    presale_vesting_months: number;
    creator_incentive_vesting_months: number;
    team_vesting_months: number;
    team_vesting_cliff_months: number;
    subscription_buyback_ratio: number;
    subscription_treasury_ratio: number;
    premium_commission_staking_ratio: number;
    premium_commission_treasury_ratio: number;
    emission_rate: number;
    emission_max_reward: number;
    genesis_initialized: boolean;
    wallets: { [key: string]: { address: string; balance: number; currency: string } };
    ai_chat_cost: number;
    subscription_platform_fee_rate?: number;
    premium_platform_fee_rate?: number;
}

export type SystemWalletType = 'genesis_wallet' | 'reserve_pool' | 'presale_pool' | 'presale_vesting_pool' | 'promo_pool' | 'treasury_wallet' | 'treasury_usdt_ledger' | 'amm_reserve_pool_usdt' | 'creator_incentive_pool' | 'creator_vesting_pool' | 'team_vesting_wallet' | 'team_vesting_pool' | 'liquidity_launch_pool' | 'exchange_listing_pool' | 'burn_pool' | 'staking_pool';

export interface VestingSchedule {
    id: string;
    uid: string;
    totalAmount: number;
    claimedAmount: number;
    startTime: number;
    durationMonths: number;
    type: 'team' | 'creator';
}

export interface AIMuse {
    id: string;
    name: string;
    category: string;
    personality: string;
    tone: string;
    flirtingLevel: string;
    avatar: string;
    isOfficial: boolean;
}
