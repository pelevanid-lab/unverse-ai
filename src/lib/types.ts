export type ULCBalance = {
  available: number;
  locked: number;
  claimable: number;
  lastClaimTimestamp?: number;
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
  isFrozen?: boolean;
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
  | 'genesis_allocation'
  | 'ai_chat_fee';

export type LedgerEntry = {
  id?: string;
  fromWallet: string;
  toWallet: string;
  amount: number;
  currency: 'ULC' | 'USDT';
  type: LedgerTransactionType;
  timestamp: number;
  referenceId?: string;
  metadata?: any;
};

export type SystemConfig = {
  treasury_wallet_address: string;
  admin_wallet_address: string;
  genesis_wallet_address: string;
  reserve_pool_address: string;
  burn_pool_address: string;
  staking_pool_address: string;
  ulc_presale_price: number;
  internal_ulc_purchase_price: number;
  genesis_initialized: boolean;
  subscription_split: {
    creator: number;
    platform: number;
    platform_treasury_split: number;
    platform_burn_split: number;
  };
  premium_unlock_commission: number;
  premium_commission_treasury_split: number;
  premium_commission_staking_split: number;
  ai_chat_cost: number;
};

export type AIMuse = {
  id: string;
  name: string;
  category: string;
  personality: string;
  tone: string;
  flirtingLevel: 'none' | 'low' | 'medium' | 'high';
  avatar: string;
  isOfficial?: boolean;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
};

export type VestingSchedule = {
  id: string;
  uid: string;
  totalAmount: number;
  claimedAmount: number;
  startTime: number;
  durationMonths: number;
  type: 'presale' | 'creator' | 'team';
};
