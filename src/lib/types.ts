
export interface UserProfile {
  uid: string;
  walletAddress: string;
  username: string;
  bio?: string;
  avatar?: string;
  ulcBalance: {
    available: number;
    locked: number;
    claimable: number;
  };
  totalEarnings: number;
  totalSpent: number;
  isCreator: boolean;
  isFrozen?: boolean;
  createdAt: number;
  welcomeBonusClaimed?: boolean;
  unlockedPostIds: string[];
  activeSubscriptionIds: string[];
  paymentWalletAddress?: string;
  paymentNetwork?: 'TRON';
  paymentWalletVerified?: boolean;
}

export interface Creator {
  uid: string;
  walletAddress: string;
  username: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  category?: string;
  socialLinks?: { [key: string]: string };
  subscriptionPrice: number;
  totalSubscribers?: number;
  totalEarnings?: number;
  payoutWalletAddress?: string;
  payoutNetwork?: 'TRON';
  payoutWalletVerified?: boolean;
}

export interface ContentPost {
  id: string;
  creatorId: string;
  title: string;
  type: 'text' | 'image' | 'video';
  content: string;
  isPremium: boolean;
  priceULC?: number;
  unlockCount: number;
  createdAt: number;
  mediaUrl?: string;
}

export interface CreatorMedia {
  id: string;
  creatorId: string;
  type: 'image' | 'video';
  url: string;
  createdAt: number;
  title?: string;
  postIds?: string[];
}

export interface LedgerEntry {
  id: string;
  fromWallet: string;
  toWallet: string;
  amount: number;
  currency: 'ULC' | 'USDT';
  type: string;
  timestamp: number;
  referenceId?: string;
  metadata?: { [key: string]: any };
}

export interface SystemConfig {
  internal_ulc_purchase_price: number;
  ai_chat_cost: number;
  wallets: {
    [key in SystemWalletType]: {
      address: string;
      balance: number;
      currency: 'ULC' | 'USDT';
    };
  };
}

export type SystemWalletType = 
  | 'genesis_wallet'
  | 'reserve_pool'
  | 'presale_pool'
  | 'presale_vesting_pool'
  | 'promo_pool'
  | 'treasury_wallet'
  | 'treasury_usdt_ledger'
  | 'amm_reserve_pool_usdt'
  | 'creator_incentive_pool'
  | 'creator_vesting_pool'
  | 'team_vesting_wallet'
  | 'team_vesting_pool'
  | 'liquidity_launch_pool'
  | 'exchange_listing_pool'
  | 'burn_pool'
  | 'staking_pool';


export interface VestingSchedule {
  id: string;
  uid: string;
  type: string;
  totalAmount: number;
  claimedAmount: number;
  startTime: number;
  durationMonths: number;
}

export interface AIMuse {
  id: string;
  name: string;
  persona: string;
  avatar: string;
  creatorUid: string;
  ownerUid: string;
  price: number;
  isForSale: boolean;
}
