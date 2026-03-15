export type ULCBalance = {
  available: number;
  locked: number;
  claimable: number;
};

export type UserProfile = {
  uid: string;
  walletAddress: string;
  username: string;
  bio: string;
  avatar: string;
  ulcBalance: ULCBalance;
  totalEarnings: number;
  totalSpent: number;
  isCreator: boolean;
  createdAt: number;
};

export type CreatorProfile = {
  uid: string;
  name: string;
  category: string;
  bio: string;
  coverImage: string;
  avatar: string;
  ulcUnlockPrice: number;
  usdtSubscriptionPrice: number;
  stats: {
    totalEarnings: number;
    subscribers: number;
    unlocks: number;
  };
};

export type ContentPost = {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  title: string;
  caption: string;
  mediaUrl: string;
  isPremium: boolean;
  price: number;
  createdAt: number;
};

export type LedgerEntry = {
  id: string;
  fromWallet: string;
  toWallet: string;
  amount: number;
  currency: 'ULC' | 'USDT';
  type: LedgerTransactionType;
  timestamp: number;
  referenceId?: string;
  metadata?: any;
};

export type LedgerTransactionType = 
  | 'premium_unlock'
  | 'subscription_payment'
  | 'tip'
  | 'ulc_purchase'
  | 'presale_purchase'
  | 'vesting_claim'
  | 'burn'
  | 'staking_reward'
  | 'creator_payout'
  | 'admin_adjustment'
  | 'buyback_burn'
  | 'genesis_allocation';

export type SystemConfig = {
  treasury_wallet_address: string;
  admin_wallet_address: string;
  ulc_presale_price: number;
  internal_ulc_purchase_price: number;
  genesis_initialized: boolean;
  subscription_buyback_ratio: number;
  subscription_treasury_ratio: number;
  premium_commission_staking_ratio: number;
  premium_commission_treasury_ratio: number;
  reserve_pool_balance: number;
};

export type AIMuse = {
  id: string;
  name: string;
  category: string;
  personality: string;
  tone: string;
  flirtingLevel: 'none' | 'low' | 'medium' | 'high';
  avatar: string;
};