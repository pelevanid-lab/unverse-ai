import { db } from './firebase';
import { 
  doc, setDoc, collection, addDoc, updateDoc, 
  increment, getDoc, query, where, getDocs, 
  orderBy, limit, writeBatch, Timestamp 
} from 'firebase/firestore';
import { LedgerEntry, SystemConfig, UserProfile, AIMuse, VestingSchedule } from './types';

const CONFIG_DOC_PATH = 'config/system';

export async function getSystemConfig(): Promise<SystemConfig | null> {
  const docRef = doc(db, CONFIG_DOC_PATH);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as SystemConfig;
  }
  return null;
}

export async function initializeSystemConfig(adminAddress: string) {
  const config: SystemConfig = {
    admin_wallet_address: adminAddress,
    treasury_wallet_address: '0xTreasury_Main',
    genesis_wallet_address: '0xGenesis_Main',
    reserve_pool_address: '0xReserve_Pool',
    burn_pool_address: '0xBurn_Pool',
    staking_pool_address: '0xStaking_Pool',
    ulc_presale_price: 0.01,
    internal_ulc_purchase_price: 0.015,
    genesis_initialized: true,
    subscription_split: {
      creator: 0.9,
      platform: 0.1,
      platform_treasury_split: 0.5,
      platform_burn_split: 0.5
    },
    premium_unlock_commission: 0.05,
    premium_commission_treasury_split: 0.5,
    premium_commission_staking_split: 0.5,
    ai_chat_cost: 0.5
  };

  await setDoc(doc(db, CONFIG_DOC_PATH), config);
  return config;
}

export async function seedMuses() {
  const muses: AIMuse[] = [
    {
      id: 'isabella',
      name: 'Isabella',
      category: 'Cyberpunk Artiste',
      personality: 'Mysterious, artistic, and deeply philosophical about the digital void. She speaks in metaphors.',
      tone: 'Dreamy & Sarcastic',
      flirtingLevel: 'medium',
      avatar: 'https://picsum.photos/seed/isabella/400/400',
      isOfficial: true
    },
    {
      id: 'elena',
      name: 'Elena',
      category: 'Fitness Mentor',
      personality: 'High-energy, supportive, and obsessed with physical health and longevity code.',
      tone: 'Motivational & Direct',
      flirtingLevel: 'low',
      avatar: 'https://picsum.photos/seed/elena/400/400',
      isOfficial: true
    },
    {
      id: 'chloe',
      name: 'Chloe',
      category: 'Tech Enthusiast',
      personality: 'Gamer girl vibes, fast-paced, and understands the deepest parts of blockchain.',
      tone: 'Playful & Hyper',
      flirtingLevel: 'high',
      avatar: 'https://picsum.photos/seed/chloe/400/400',
      isOfficial: true
    }
  ];

  const batch = writeBatch(db);
  for (const muse of muses) {
    const museRef = doc(db, 'muses', muse.id);
    batch.set(museRef, muse);
  }
  await batch.commit();
}

export async function recordTransaction(entry: Omit<LedgerEntry, 'timestamp'>) {
  const timestamp = Date.now();
  const ledgerRef = collection(db, 'ledger');
  
  const newDoc = await addDoc(ledgerRef, {
    ...entry,
    timestamp
  });

  const batch = writeBatch(db);

  if (entry.currency === 'ULC') {
    if (entry.fromWallet && !isSystemPool(entry.fromWallet)) {
      await updateWalletBalance(entry.fromWallet, -entry.amount, 'available', batch);
    }
    if (entry.toWallet && !isSystemPool(entry.toWallet)) {
      await updateWalletBalance(entry.toWallet, entry.amount, 'available', batch);
    }
  }

  await batch.commit();
  return newDoc.id;
}

async function updateWalletBalance(walletAddress: string, delta: number, field: 'available' | 'locked' | 'claimable', batch: any) {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('walletAddress', '==', walletAddress), limit(1));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const userDoc = snap.docs[0];
    batch.update(userDoc.ref, {
      [`ulcBalance.${field}`]: increment(delta)
    });
  }
}

function isSystemPool(address: string) {
  const systemPools = ['system', 'reserve_pool', 'genesis_wallet', 'burn_pool', 'staking_pool', 'treasury', '0xTreasury_Main', '0xGenesis_Main', '0xReserve_Pool', '0xBurn_Pool', '0xStaking_Pool'];
  return systemPools.includes(address);
}

export async function buyULC(user: UserProfile, usdtAmount: number) {
  const config = await getSystemConfig();
  if (!config) throw new Error("System not configured");

  const price = config.internal_ulc_purchase_price;
  const ulcAmount = usdtAmount / price;

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: config.treasury_wallet_address,
    amount: usdtAmount,
    currency: 'USDT',
    type: 'ulc_purchase'
  });

  await recordTransaction({
    fromWallet: config.reserve_pool_address,
    toWallet: user.walletAddress,
    amount: ulcAmount,
    currency: 'ULC',
    type: 'ulc_purchase'
  });

  return ulcAmount;
}

export async function handlePremiumUnlock(user: UserProfile, creatorWallet: string, amount: number, contentId: string) {
  const config = await getSystemConfig();
  if (!config) throw new Error("System not configured");

  const commission = amount * config.premium_unlock_commission;
  const creatorShare = amount - commission;
  const treasurySplit = commission * config.premium_commission_treasury_split;
  const stakingSplit = commission * config.premium_commission_staking_split;

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: creatorWallet,
    amount: creatorShare,
    currency: 'ULC',
    type: 'premium_unlock',
    referenceId: contentId
  });

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: config.treasury_wallet_address,
    amount: treasurySplit,
    currency: 'ULC',
    type: 'premium_unlock',
    referenceId: contentId,
    metadata: { part: 'treasury_commission' }
  });

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: config.staking_pool_address,
    amount: stakingSplit,
    currency: 'ULC',
    type: 'premium_unlock',
    referenceId: contentId,
    metadata: { part: 'staking_rewards' }
  });
}

export async function handleSubscription(user: UserProfile, creatorWallet: string, usdtAmount: number, creatorId: string) {
  const config = await getSystemConfig();
  if (!config) throw new Error("System not configured");

  const creatorShare = usdtAmount * config.subscription_split.creator;
  const platformFee = usdtAmount * config.subscription_split.platform;
  const treasurySplit = platformFee * config.subscription_split.platform_treasury_split;
  const burnSplit = platformFee * config.subscription_split.platform_burn_split;

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: creatorWallet,
    amount: creatorShare,
    currency: 'USDT',
    type: 'subscription_payment',
    referenceId: creatorId
  });

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: config.treasury_wallet_address,
    amount: treasurySplit,
    currency: 'USDT',
    type: 'subscription_payment',
    referenceId: creatorId,
    metadata: { part: 'treasury' }
  });

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: config.burn_pool_address,
    amount: burnSplit,
    currency: 'USDT',
    type: 'subscription_payment',
    referenceId: creatorId,
    metadata: { part: 'buyback_burn' }
  });
}

export async function processChatFee(user: UserProfile) {
  const config = await getSystemConfig();
  if (!config) throw new Error("System not configured");

  if (user.ulcBalance.available < config.ai_chat_cost) {
    throw new Error("Insufficient ULC for chat");
  }

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: config.burn_pool_address,
    amount: config.ai_chat_cost,
    currency: 'ULC',
    type: 'ai_chat_fee',
  });
}

export async function handleTipping(user: UserProfile, creatorWallet: string, amount: number, creatorId: string) {
  if (user.ulcBalance.available < amount) {
    throw new Error("Insufficient ULC balance");
  }

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: creatorWallet,
    amount: amount,
    currency: 'ULC',
    type: 'tip',
    referenceId: creatorId
  });
}

export async function toggleUserFreeze(uid: string, freeze: boolean) {
  await updateDoc(doc(db, 'users', uid), {
    isFrozen: freeze
  });
}

export function calculateVestingClaimable(schedule: VestingSchedule): number {
  const now = Date.now();
  const elapsed = now - schedule.startTime;
  const durationMs = schedule.durationMonths * 30 * 24 * 60 * 60 * 1000;
  
  if (elapsed <= 0) return 0;
  if (elapsed >= durationMs) return schedule.totalAmount - schedule.claimedAmount;

  const totalVested = (schedule.totalAmount * elapsed) / durationMs;
  const claimable = totalVested - schedule.claimedAmount;
  
  return Math.max(0, claimable);
}

export async function claimVestedTokens(user: UserProfile, schedule: VestingSchedule) {
  const claimable = calculateVestingClaimable(schedule);
  if (claimable <= 0) throw new Error("No tokens available to claim");

  const batch = writeBatch(db);
  
  // Update schedule
  const scheduleRef = doc(db, 'vesting_schedules', schedule.id);
  batch.update(scheduleRef, {
    claimedAmount: increment(claimable)
  });

  // Update user balances
  const userRef = doc(db, 'users', user.uid);
  batch.update(userRef, {
    'ulcBalance.available': increment(claimable),
    'ulcBalance.claimable': increment(-claimable)
  });

  // Record in ledger
  const ledgerRef = collection(db, 'ledger');
  const timestamp = Date.now();
  batch.set(doc(ledgerRef), {
    fromWallet: 'system_vesting',
    toWallet: user.walletAddress,
    amount: claimable,
    currency: 'ULC',
    type: 'vesting_claim',
    referenceId: schedule.id,
    timestamp
  });

  await batch.commit();
}
