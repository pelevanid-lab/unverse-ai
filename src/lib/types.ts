export interface UserProfile {
    uid: string;
    email: string;
    username: string;
    walletAddress: string;
    createdAt: number;
    updatedAt: number;
    bio?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    isCreator?: boolean;
    ulc: number; // Universal Ledger Coin balance
    usdt: number; // Tether balance - for creator claims
}

export interface LedgerEntry {
    id: string;
    timestamp: number;
    type: string;
    amount: number;
    currency: 'ULC' | 'USDT';
    fromUserId?: string;
    toUserId?: string;
    fromWallet?: string;
    toWallet?: string;
    creatorId?: string;
    txHash?: string;
    network?: 'TRON' | 'TON';
    memo?: string;
    referenceId?: string; // Used to link related transactions
    metadata?: any;
}

// Represents a user-facing transaction, which may group multiple ledger entries.
export interface GroupedLedgerEntry {
    id: string; // referenceId or a unique ID for the group
    timestamp: number;
    mainEntry: LedgerEntry; // The primary entry to display for the user
    relatedEntries: LedgerEntry[]; // All raw entries in the group
}

export interface ContentPost {
    id: string;
    creatorId: string;
    title: string;
    content: string;
    isPremium: boolean;
    unlockPrice: number;
    createdAt: number;
    updatedAt: number;
}