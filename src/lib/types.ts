export interface NetworkWallet {
    address: string;
    verified: boolean;
    lastUsed?: number;
}

export interface CharacterProfile {
    id: string;
    name: string;
    gender: 'female' | 'male' | 'other';
    ageRange?: string;
    hairColor: string;
    eyeColor: string;
    faceStyle: string;
    bodyStyle: string;
    vibe: string;
    characterPromptBase: string;
    referenceImageUrl?: string;
    referenceImageUrls?: string[];
    identitySeed?: number;
    height?: string;
    persona_id?: string;
    persona_prompt?: string;
    face_reference_image?: string;
    style_bias?: string;
    createdAt: number;
}

export interface UserProfile {
    uid: string;
    authUid?: string; // Links Firebase Auth Session
    email?: string;
    username: string;
    walletAddress: string;
    createdAt: number;
    updatedAt?: number;
    bio?: string;
    avatar?: string;
    featured?: boolean;
    boostScore?: number;
    twitter?: string;
    telegram?: string;
    discord?: string;
    isCreator?: boolean;
    ulcBalance?: {
        available: number;
        locked: number;
        staked: number; // Dedicated for Staking
        claimable: number;
    };
    usdcBalance?: {
        available: number;
        claimable: number;
    };
    totalEarnings?: number;
    totalSpent?: number;
    welcomeBonusClaimed?: boolean;
    firstPurchaseBonusClaimed?: boolean;
    unlockedPostIds?: string[];
    activeSubscriptionIds?: string[];
    paymentWallets?: {
        Base?: NetworkWallet | null;
        EVM?: NetworkWallet | null; // Generic EVM
    };
    preferredPaymentNetwork?: 'Base' | 'EVM';
    creatorData?: Creator;
    isFrozen?: boolean;
    socials?: {
        twitter?: string;
        telegram?: string;
        discord?: string;
    };
    promoCard?: PromoCard | null;
    savedCharacter?: CharacterProfile | null;
    onboardingState?: OnboardingState;
    aiLearningState?: {
        mode: "default" | "memory" | "adaptive";
        confidenceScore: number;
        activatedAt: number;
    };
    aiCreatorModeEnabled?: boolean;
    aiCreatorModeExpiresAt?: number;
    aiCreatorModeActivatedAt?: number;
    aiCreatorModeConfig?: {
        personaName: string;
        niche: string;
        tone: string;
        targetAudience: string;
        vibe: string;
    };
    aiCreatorModeLastChargedAt?: number;
    aiCreatorModeLastRunAt?: number;
    aiPreferences?: AIPreference;

    // Creator Milestone Program (First 100)
    creatorProgramIndex?: number | null;
    creatorInFirst100Program?: boolean;
    creatorWelcomeRewardGranted?: boolean;
    uniquePremiumUnlockBuyerIds?: string[];
    totalUniquePremiumUnlocks?: number;
    milestoneRewardCount?: number;
    totalMilestoneRewardULC?: number;
}

export interface PromoCard {
    imageUrl: string;
    title: string;
    description: string;
    ctaText: string;
    creatorId: string;
    creatorName: string;
    creatorAvatar: string;
    updatedAt: number;
}

export interface Creator {
    uid: string;
    username: string;
    bio?: string;
    avatar?: string;
    subscriptionPriceMonthly: number;
    payoutWallets?: {
        Base?: { address: string };
    };
    preferredPayoutNetwork?: 'Base';
    category?: string;
    coverImage?: string;
    creatorStatus?: 'active' | 'inactive';
    visibility?: 'public' | 'private';
    collectionWallets?: {
        Base?: NetworkWallet | null;
    };
    defaultClaimNetwork?: 'Base';
}

export interface SystemConfig {
    admin_wallet_address: string;
    ai_generation_burn_split?: number;
    ai_generation_cost?: number;
    ai_generation_treasury_split?: number;
    genesis_initialized?: boolean;
    isSealed?: boolean;
    last_manual_fix_v3_at?: number;
    v3StatsResetAt?: number;
    platform_subscription_fee_split?: number;
    // Community & Social
    community?: {
        telegramUrl: string;
        twitterUrl: string;
        instagramUrl: string;
        investorPresentationUrl: string;
        creatorPresentationUrl: string;
        forumCategories: string[];
    };
    pools?: {
        [key: string]: number; // e.g. "reserve": 420000000
    };
    premium_unlock_burn_ratio?: number;
    premium_unlock_fee_split?: number;
    premium_unlock_treasury_ratio?: number;
    subscription_buyback_ratio?: number;
    subscription_treasury_ratio?: number;
    totalTreasuryUSDC?: number;
    totalPresaleSold?: number;
    treasury_address: string;
    // Economic Persistence (The Seal)
    initialSupplyAtSeal?: number;      // Fixed at 1B
    targetCapitalizationUSDC?: number; // Fixed at 15M
    initialPriceAtSeal?: number;       // Fixed at 0.015
    protocolFloorPrice?: number;       // Dynamically calculated
    // Pre-Sale Tier Upgrade
    presaleAllocationULC?: number;
    currentPresaleStage?: number;
    presalePriceUSDC?: number;
    listingPriceUSDC?: number;

    // Post-launch Buyback Configuration
    treasury_buyback_enabled?: boolean;
    treasury_buyback_ratio?: number;
    operationCostUSDC?: number;
    treasuryUSDCBalanceManual?: number;
    presaleCompleted?: boolean;
    tokenLaunchCompleted?: boolean;
    marketLiquidityReady?: boolean;

    // Creator Milestone Pool Stats
    totalCreatorRewardsULC?: number;
    totalPromoPoolDistributedULC?: number;
    totalCreatorIncentiveDistributedULC?: number;
    totalBuybackStakingUSDC?: number;
    totalStakedULC?: number;
}

export interface SystemStats {
    totalTreasuryULC: number;
    totalBurnedULC: number;
}

export type LedgerEntryType = 
    | 'welcome_bonus' 
    | 'subscription_payment' 
    | 'subscription_payment_usdc' 
    | 'creator_earning' 
    | 'premium_unlock' 
    | 'limited_purchase'
    | 'tip' 
    | 'withdrawal'
    | 'ulc_purchase'
    | 'ulc_purchase_payment'
    | 'staking_reward'
    | 'staking_deposit'
    | 'staking_withdraw'
    | 'treasury_fee'
    | 'buyback_burn_fee'
    | 'buyback_staking_fee'
    | 'ai_generation_payment'
    | 'ai_generation_refund'
    | 'ai_creator_activation'
    | 'ai_creator_generation'
    | 'vesting_claim'
    | 'vesting_created'
    | 'genesis_allocation'
    | 'premium_unlock_earning'
    | 'creator_welcome_reward'
    | 'creator_milestone_reward'
    | 'ulc_purchase_grouped'
    | 'creator_claim_executed'
    | 'internal_ulc_transfer'
    | 'presale_purchase';

export interface VestingSchedule {
    id: string;
    userId: string;
    totalAmount: number;
    startTime: number;
    duration: number; // in milliseconds
    cliff: number;    // in milliseconds
    releasedAmount: number;
    lastClaimedAt?: number;
    description?: string;
    poolId?: string;
}

export interface LedgerEntry {
    id: string;
    timestamp: number;
    type: LedgerEntryType;
    amount: number;
    currency: 'ULC' | 'USDC';
    userId?: string;
    fromUserId?: string;
    toUserId?: string;
    fromWallet?: string;
    toWallet?: string;
    creatorId?: string;
    txHash?: string;
    network?: 'Base' | 'EVM';
    memo?: string;
    referenceId?: string;
    platformFee?: number;
    description?: string;
    ulcBurned?: number;
    adminId?: string;
    metadata?: any;
    details?: any;
}

export interface ClaimRequest {
    id: string;
    creatorId: string;
    amount: number;
    currency: 'USDC' | 'ULC';
    network: 'Base' | 'EVM';
    walletAddress: string;
    status: 'pending' | 'approved' | 'completed' | 'rejected';
    requestedAt: number;
}

export interface SubscriptionRecord {
    id: string;
    userId: string;
    creatorId: string;
    startedAt: number;
    expiresAt: number;
    status: 'active' | 'expired';
}

export type PostContentType = "public" | "premium" | "limited";

export interface ContentPost {
    id: string;
    creatorId: string;
    creatorName?: string;
    creatorAvatar?: string;
    title?: string;
    content: string; // Caption
    contentType: PostContentType;
    unlockPrice: number; // Price in ULC
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
    
    // AI Metadata
    isAI?: boolean;
    aiPrompt?: string;
    aiEnhancedPrompt?: string;
    isAdvanced?: boolean;
}

export interface CreatorMedia {
    id: string;
    creatorId: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    contentType: PostContentType;
    priceULC: number;
    status: 'draft' | 'scheduled' | 'published' | 'planned';
    createdAt: any;
    scheduledFor?: number;
    limited?: {
        totalSupply: number;
        price: number;
    };
    prompt?: string;
    enhancedPrompt?: string;
    isAI?: boolean;
    aiPrompt?: string;
    aiEnhancedPrompt?: string;
    source?: 'ai_auto' | 'user';
    isAdvanced?: boolean;
}

export interface GroupedLedgerEntry {
    id: string;
    timestamp: number;
    mainEntry: LedgerEntry;
    relatedEntries: LedgerEntry[];
}

export interface AccessStatus {
    hasAccess: boolean;
    reason?: 'not_subscribed' | 'sold_out' | 'insufficient_balance' | 'not_logged_in';
}

export interface Chat {
    id: string;
    participants: string[];
    lastMessage: string;
    lastTimestamp: number;
    creatorId: string;
    creatorName?: string;
    creatorAvatar?: string;
    subscriberId: string;
    subscriberName: string;
    subscriberAvatar: string;
    unreadCount: number;
}

export interface Message {
    id: string;
    senderId: string;
    content: string;
    timestamp: number;
}

export interface OnboardingState {
    step: 'welcome' | 'goal_selection' | 'first_generate' | 'first_container' | 'first_publish' | 'first_monetization' | 'completed';
    goal?: 'explore' | 'earn' | 'create';
    completedSteps: string[];
}

export interface AIPreference {
    preferredStyles: string[];
    dislikedPatterns: string[];
    visualToneSummary: string;
}


export interface SceneLock {
    sceneType: 'beach' | 'jet' | 'indoor' | 'city_night' | 'bedroom' | 'yacht' | 'studio' | 'nature' | 'other';
    environmentSummary: string;
    outfitSummary: string;
    lightingSummary: string;
    propSummary: string;
    baseComposition: string;
    allowedVariationTypes: string[];
    riskyVariationTypes: string[];
    intensity: 'low' | 'medium' | 'high';
}

export interface AIGenerationLog {
    id: string;
    userId: string;
    prompt: string;
    enhancedPrompt: string;
    mediaUrl: string;
    paymentReference: string | null;
    timestamp: any;
    satisfactionScore: number | null;
    contentScore?: number;
    negativePrompt?: string;
    monetized?: boolean;
    savedToContainer?: boolean;
    published?: boolean;
    tags?: string[];
    // 🧬 SCENE LOCK (Director Mode 2.0)
    sceneLock?: SceneLock;
    sceneType?: string;
    seed?: number;
}
