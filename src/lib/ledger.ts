import { db } from './firebase';
import { 
  doc, setDoc, collection, addDoc, updateDoc, 
  increment, getDoc, query, where, getDocs, 
  orderBy, limit, writeBatch, Timestamp 
} from 'firebase/firestore';
import { LedgerEntry, SystemConfig, UserProfile, AIMuse, VestingSchedule } from './types';

const CONFIG_DOC_PATH = 'config/system';

/**
 * getSystemConfig - Fetches the platform's global economic parameters.
 */
export async function getSystemConfig(): Promise<SystemConfig | null> {
  const docRef = doc(db, CONFIG_DOC_PATH);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as SystemConfig;
  }
  return null;
}

/**
 * initializeSystemConfig - Sets up the platform's genesis parameters.
 * Only callable once by the primary admin.
 */
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

/**
 * triggerGenesisAllocation - Grants the 50k ULC starter allocation with 24m vesting.
 */
export async function triggerGenesisAllocation(user: UserProfile) {
  const amount = 50000;
  const startTime = Date.now();
  
  const schedule: Omit<VestingSchedule, 'id'> = {
    uid: user.uid,
    totalAmount: amount,
    claimedAmount: 0,
    startTime,
    durationMonths: 24,
    type: 'team'
  };

  const scheduleRef = await addDoc(collection(db, 'vesting_schedules'), schedule);
  
  await recordTransaction({
    fromWallet: 'system_genesis',
    toWallet: user.walletAddress,
    amount: amount,
    currency: 'ULC',
    type: 'genesis_allocation',
    referenceId: scheduleRef.id
  });

  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    'ulcBalance.locked': increment(amount)
  });
}

/**
 * seedMuses - Populates the platform with initial AI influencers.
 */
export async function seedMuses() {
  const muses: Omit<AIMuse, 'id'>[] = [
    {
      name: 'Isabella AI',
      category: 'Digital Fashionista',
      personality: 'Sophisticated, trend-setting, and highly intelligent digital model.',
      tone: 'Elegant and inspiring',
      flirtingLevel: 'low',
      avatar: 'https://picsum.photos/seed/isabella/600/800',
      isOfficial: true
    },
    {
      name: 'Elena Cyber',
      category: 'Fitness & Wellness',
      personality: 'Energetic, supportive, and obsessed with bio-hacking the digital realm.',
      tone: 'Motivating and direct',
      flirtingLevel: 'medium',
      avatar: 'https://picsum.photos/seed/elena/600/800',
      isOfficial: true
    },
    {
      name: 'Chloe Play',
      category: 'Pro Gamer',
      personality: 'Witty, competitive, and loves deep dives into metaverse lore.',
      tone: 'Playful and sarcastic',
      flirtingLevel: 'high',
      avatar: 'https://picsum.photos/seed/chloe/600/800',
      isOfficial: true
    }
  ];

  const batch = writeBatch(db);
  for (const m of muses) {
    const ref = doc(collection(db, 'muses'));
    batch.set(ref, { id: ref.id, ...m });
  }
  await batch.commit();
}

/**
 * recordTransaction - Core economic engine.
 */
export async function recordTransaction(entry: Omit<LedgerEntry, 'timestamp' | 'id'>) {
  const timestamp = Date.now();
  const ledgerRef = collection(db, 'ledger');
  
  const docRef = await addDoc(ledgerRef, {
    ...entry,
    timestamp
  });

  const batch = writeBatch(db);
  
  // Wallet Address Lookups & Balance Updates
  if (entry.currency === 'ULC') {
    if (entry.fromWallet && !isSystemPool(entry.fromWallet)) {
      await updateWalletBalance(entry.fromWallet, -entry.amount, 'available', batch);
    }
    if (entry.toWallet && !isSystemPool(entry.toWallet)) {
      await updateWalletBalance(entry.toWallet, entry.amount, 'available', batch);
    }
  }

  await batch.commit();
  return docRef.id;
}

async function updateWalletBalance(walletAddress: string, delta: number, field: string, batch: any) {
  const q = query(collection(db, 'users'), where('walletAddress', '==', walletAddress), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    batch.update(snap.docs[0].ref, {
      [`ulcBalance.${field}`]: increment(delta)
    });
  }
}

function isSystemPool(address: string) {
  return ['system', 'system_genesis', 'burn_pool', 'staking_pool', 'treasury'].includes(address);
}

export async function processChatFee(user: UserProfile) {
  const config = await getSystemConfig();
  const fee = config?.ai_chat_cost || 0.5;

  if (user.ulcBalance.available < fee) {
    throw new Error("Insufficient ULC for AI interaction.");
  }

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: 'burn_pool',
    amount: fee,
    currency: 'ULC',
    type: 'ai_chat_fee'
  });
}

export async function buyULC(user: UserProfile, usdtAmount: number) {
  const config = await getSystemConfig();
  const rate = config?.internal_ulc_purchase_price || 0.015;
  const ulcAmount = usdtAmount / rate;

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: 'treasury',
    amount: usdtAmount,
    currency: 'USDT',
    type: 'ulc_purchase'
  });

  await recordTransaction({
    fromWallet: 'system',
    toWallet: user.walletAddress,
    amount: ulcAmount,
    currency: 'ULC',
    type: 'ulc_purchase'
  });

  return ulcAmount;
}

export async function handlePremiumUnlock(user: UserProfile, creatorWallet: string, amount: number, contentId: string) {
  // Logic: 95% to creator, 2.5% to staking, 2.5% to treasury
  const creatorShare = amount * 0.95;
  const stakingShare = amount * 0.025;
  const treasuryShare = amount * 0.025;

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
    toWallet: 'staking_pool',
    amount: stakingShare,
    currency: 'ULC',
    type: 'staking_reward',
    referenceId: contentId
  });

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: 'treasury',
    amount: treasuryShare,
    currency: 'ULC',
    type: 'premium_unlock',
    referenceId: contentId
  });
}

export async function handleSubscription(user: UserProfile, creatorWallet: string, usdtAmount: number, creatorUid: string) {
  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: creatorWallet,
    amount: usdtAmount * 0.9,
    currency: 'USDT',
    type: 'subscription_payment',
    referenceId: creatorUid
  });
  
  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: 'treasury',
    amount: usdtAmount * 0.1,
    currency: 'USDT',
    type: 'subscription_payment',
    referenceId: creatorUid
  });
}

export async function handleTipping(user: UserProfile, creatorWallet: string, amount: number, creatorUid: string) {
  if (user.ulcBalance.available < amount) throw new Error("Insufficient ULC");
  
  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: creatorWallet,
    amount: amount,
    currency: 'ULC',
    type: 'tip',
    referenceId: creatorUid
  });
}

export function calculateVestingClaimable(schedule: VestingSchedule): number {
  const elapsed = Date.now() - schedule.startTime;
  const totalDuration = schedule.durationMonths * 30 * 24 * 60 * 60 * 1000;
  
  if (elapsed <= 0) return 0;
  if (elapsed >= totalDuration) return schedule.totalAmount - schedule.claimedAmount;
  
  const vestedAmount = (elapsed / totalDuration) * schedule.totalAmount;
  const claimable = vestedAmount - schedule.claimedAmount;
  
  return Math.max(0, claimable);
}

export async function claimVestedTokens(user: UserProfile, schedule: VestingSchedule) {
  const claimable = calculateVestingClaimable(schedule);
  if (claimable <= 0) throw new Error("No tokens currently claimable.");

  const batch = writeBatch(db);
  const scheduleRef = doc(db, 'vesting_schedules', schedule.id);
  const userRef = doc(db, 'users', user.uid);

  batch.update(scheduleRef, {
    claimedAmount: increment(claimable)
  });

  batch.update(userRef, {
    'ulcBalance.available': increment(claimable),
    'ulcBalance.locked': increment(-claimable)
  });

  await batch.commit();

  await recordTransaction({
    fromWallet: 'system_vesting',
    toWallet: user.walletAddress,
    amount: claimable,
    currency: 'ULC',
    type: 'vesting_claim',
    referenceId: schedule.id
  });
}

export async function handleStaking(user: UserProfile, amount: number) {
  if (user.ulcBalance.available < amount) throw new Error("Insufficient available balance.");

  const batch = writeBatch(db);
  const userRef = doc(db, 'users', user.uid);

  batch.update(userRef, {
    'ulcBalance.available': increment(-amount),
    'ulcBalance.locked': increment(amount)
  });

  await batch.commit();

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: 'staking_pool',
    amount: amount,
    currency: 'ULC',
    type: 'admin_adjustment', // Or define a 'stake' type
    metadata: { action: 'stake' }
  });
}

export async function handleUnstaking(user: UserProfile, amount: number) {
  if (user.ulcBalance.locked < amount) throw new Error("Insufficient staked balance.");

  const batch = writeBatch(db);
  const userRef = doc(db, 'users', user.uid);

  batch.update(userRef, {
    'ulcBalance.available': increment(amount),
    'ulcBalance.locked': increment(-amount)
  });

  await batch.commit();

  await recordTransaction({
    fromWallet: 'staking_pool',
    toWallet: user.walletAddress,
    amount: amount,
    currency: 'ULC',
    type: 'admin_adjustment',
    metadata: { action: 'unstake' }
  });
}

export async function handleCreatorWithdrawal(user: UserProfile, amount: number) {
  if (user.ulcBalance.available < amount) throw new Error("Insufficient balance for withdrawal.");

  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: 'treasury',
    amount: amount,
    currency: 'ULC',
    type: 'creator_payout'
  });
}

export async function toggleUserFreeze(uid: string, status: boolean) {
  await updateDoc(doc(db, 'users', uid), {
    isFrozen: status
  });
}
