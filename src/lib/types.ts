
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
}

export interface ContentPost {
    id: string;
    creatorId: string;
    caption?: string;
    mediaType: 'image' | 'video';
    mediaUrl: string;
    thumbnailUrl?: string; // For videos
    isPremium: boolean;
    unlockPrice?: number;
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
    type: 'tip' | 'subscription_payment' | 'premium_unlock' | 'creator_payout' | 'ai_chat_fee' | 'staking_reward';
    timestamp: number;
    referenceId?: string; // post id, subscription id, etc.
}

export interface Muse {
    id: string;
    name: string;
    avatar: string;
    description: string;
    personality: string;
    ownerId: string;
    last chatted?: any;
}
