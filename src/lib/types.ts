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
  welcomeBonusClaimed?: boolean;
};

export type CreatorProfile = {
  uid: string; // Same as walletAddress
  walletAddress: string;
  username: string;
  displayName?: string;
  avatar: string;
  coverImage: string;
  creatorBio: string;
  category: string; // Added back based on schema

  socialLinks?: {
    x?: string;
  };

  // Monetization settings
  subscriptionPrice: number; // Monthly price in USDT
  premiumDefaultPrice: number; // Default unlock price in ULC
  
  // Creator Stats
  totalSubscribers: number;
  totalUnlocks: number;
  totalTips: number;
  totalRevenue: number; // Aggregate from all sources
  
  // Status
  isActive: boolean; // To allow disabling a creator profile
  updatedAt: number;
  createdAt: number; // Timestamp of becoming a creator
};

// Represents a published post visible in the main feed
export type ContentPost = {
  id: string;
  creatorId: string;
  creatorName: string; // Denormalized for quick display
  creatorAvatar: string; // Denormalized for quick display
  creator?: CreatorProfile; // Optional: To be populated client-side
  mediaUrl: string;
  mediaType: 'image' | 'video'; // Added based on logical structure
  caption: string;
  isPremium: boolean;
  priceULC: number;
  createdAt: number;
  
  // Engagement Metrics
  likes: number;
  unlockCount: number;
  earningsULC: number;
};

// Represents media uploaded by a creator, not yet published
export type CreatorMedia = {
  id: string;
  creatorId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption: string;
  isPremium: boolean;
  priceULC: number;
  status: 'draft' | 'scheduled';
  scheduledFor?: number;
  createdAt: any; // Firestore Timestamp
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
  | 'ai_chat_fee'
  | 'welcome_bonus';

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

export type SystemWallet = {
  address: string;
  balance: number;
  currency: string;
};

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

export type SystemConfig = {
  treasury_wallet_address: string;
  treasury_network: 'TRON';
  admin_wallet_address: string;
  supported_usdt_networks: string[];
  ulc_token_network: 'OASIS_ROSE';

  ulc_presale_price: number;
  internal_ulc_purchase_price: number;

  amm_launch_price: number;
  amm_activation_threshold: number;
  amm_enabled: boolean;
  amm_mode: 'inactive' | 'active';

  wallet_integration_enabled: boolean;
  subscription_split_enabled: boolean;
  creator_payout_mode: 'split' | 'direct';

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
  
  wallets: Record<SystemWalletType, SystemWallet>; // Corrected based on schema
  genesis_initialized: boolean;
  ai_chat_cost?: number;
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

// New type based on the discovered 'subscriptions' collection
export type Subscription = {
  id?: string;
  userId: string;
  creatorId: string;
  amount: number;
  status: string;
  createdAt: number;
};