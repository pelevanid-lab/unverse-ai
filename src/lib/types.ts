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

export type SystemWalletType = 
  | 'genesis_wallet'
  | 'treasury_wallet'
  | 'reserve_pool'
  | 'burn_pool'
  | 'staking_pool'
  | 'creator_incentives'
  | 'team_vesting'
  | 'liquidity_pool'
  | 'marketing_wallet'
  | 'exchange_liquidity'
  | 'presale_vault'
  | 'platform_ops'
  | 'buyback_vault'
  | 'community_grants'
  | 'security_reserve'
  | 'ai_muse_vault'
  | 'advisory_pool';

export type SystemConfig = {
  admin_wallet_address: string;
  genesis_initialized: boolean;
  ulc_presale_price: number;
  internal_ulc_purchase_price: number;
  ai_chat_cost: number;
  premium_unlock_commission: number;
  subscription_split: {
    creator: number;
    platform: number;
  };
  wallets: Record<SystemWalletType, string>;
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
