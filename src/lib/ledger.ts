import { db } from './firebase';
import { 
  doc, setDoc, collection, addDoc, updateDoc, 
  increment, getDoc, query, where, getDocs, 
  limit, writeBatch 
} from 'firebase/firestore';
import { LedgerEntry, SystemConfig, UserProfile, AIMuse, VestingSchedule, SystemWalletType } from './types';

const CONFIG_DOC_PATH = 'config/system';

export const SYSTEM_WALLETS: SystemWalletType[] = [
  'genesis_wallet',
  'reserve_pool',
  'presale_pool',
  'presale_vesting_pool',
  'promo_pool',
  'treasury_wallet',
  'treasury_usdt_ledger',
  'amm_reserve_pool_usdt',
  'creator_incentive_pool',
  'creator_vesting_pool',
  'team_vesting_wallet',
  'team_vesting_pool',
  'liquidity_launch_pool',
  'exchange_listing_pool',
  'burn_pool',
  'staking_pool'
];

export async function getSystemConfig(): Promise<SystemConfig | null> {
  const docRef = doc(db, CONFIG_DOC_PATH);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as SystemConfig) : null;
}

/**
 * initializeSystemConfig - One-time setup of the platform architecture.
 * Records initial distributions to the ledger.
 */
export async function initializeSystemConfig() {
  const existing = await getSystemConfig();
  if (existing) throw new Error("System already initialized.");

  const walletMap: Record<string, string> = {};
  SYSTEM_WALLETS.forEach(w => {
    walletMap[w] = `0xSYS_${w.toUpperCase()}`;
  });

  const config: SystemConfig = {
    treasury_wallet_address: "",
    treasury_network: "TRON",
    admin_wallet_address: "",
    supported_usdt_networks: ["TRON", "ETHEREUM", "BSC", "POLYGON"],
    ulc_token_network: "OASIS_ROSE",

    ulc_presale_price: 0.01,
    internal_ulc_purchase_price: 0.015,

    amm_launch_price: 0.015,
    amm_activation_threshold: 150000,
    amm_enabled: false,
    amm_mode: "inactive",

    wallet_integration_enabled: true,
    subscription_split_enabled: true,
    creator_payout_mode: "split",

    presale_vesting_months: 24,
    creator_incentive_vesting_months: 24,
    team_vesting_months: 36,
    team_vesting_cliff_months: 0,

    subscription_buyback_ratio: 0.5,
    subscription_treasury_ratio: 0.5,

    premium_commission_staking_ratio: 0.5,
    premium_commission_treasury_ratio: 0.5,

    emission_rate: 0.000002,
    emission_max_reward: 20,
    
    genesis_initialized: true,
    wallets: walletMap as any,
    ai_chat_cost: 0.5
  };

  const batch = writeBatch(db);
  batch.set(doc(db, CONFIG_DOC_PATH), config);

  // Initialize system wallet balances
  SYSTEM_WALLETS.forEach(w => {
    batch.set(doc(db, 'system_wallets', w), {
      address: walletMap[w],
      balance: w === 'genesis_wallet' ? 1000000000 : 0, // 1 Billion Total Supply
      currency: 'ULC',
      updatedAt: Date.now()
    });
  });

  await batch.commit();

  // Execute Exact Genesis Distribution (Ledger-based)
  const distributions: { wallet: SystemWalletType; amount: number }[] = [
    { wallet: 'reserve_pool', amount: 420000000 },
    { wallet: 'presale_pool', amount: 100000000 },
    { wallet: 'promo_pool', amount: 50000000 },
    { wallet: 'treasury_wallet', amount: 80000000 },
    { wallet: 'creator_incentive_pool', amount: 120000000 },
    { wallet: 'team_vesting_wallet', amount: 130000000 },
    { wallet: 'liquidity_launch_pool', amount: 60000000 },
    { wallet: 'exchange_listing_pool', amount: 40000000 }
  ];

  for (const dist of distributions) {
    await recordTransaction({
      fromWallet: walletMap.genesis_wallet,
      toWallet: walletMap[dist.wallet],
      amount: dist.amount,
      currency: 'ULC',
      type: 'genesis_allocation',
      metadata: { target: dist.wallet }
    });
  }

  return config;
}

export async function recordTransaction(entry: Omit<LedgerEntry, 'timestamp' | 'id'>) {
  const timestamp = Date.now();
  const batch = writeBatch(db);
  const ledgerRef = collection(db, 'ledger');
  
  const docRef = doc(ledgerRef);
  batch.set(docRef, { ...entry, timestamp });

  if (entry.currency === 'ULC') {
    const fromSys = SYSTEM_WALLETS.find(w => `0xSYS_${w.toUpperCase()}` === entry.fromWallet || w === entry.fromWallet);
    if (fromSys) {
      batch.update(doc(db, 'system_wallets', fromSys), { balance: increment(-entry.amount), updatedAt: timestamp });
    } else {
      await updateWalletBalance(entry.fromWallet, -entry.amount, 'available', batch);
    }

    const toSys = SYSTEM_WALLETS.find(w => `0xSYS_${w.toUpperCase()}` === entry.toWallet || w === entry.toWallet);
    if (toSys) {
      batch.update(doc(db, 'system_wallets', toSys), { balance: increment(entry.amount), updatedAt: timestamp });
    } else {
      await updateWalletBalance(entry.toWallet, entry.amount, 'available', batch);
    }
  } else if (entry.currency === 'USDT') {
    const toSys = SYSTEM_WALLETS.find(w => `0xSYS_${w.toUpperCase()}` === entry.toWallet || w === entry.toWallet);
    if (toSys === 'treasury_usdt_ledger') {
       batch.update(doc(db, 'system_wallets', 'treasury_usdt_ledger'), { balance: increment(entry.amount), updatedAt: timestamp });
    }
  }

  await batch.commit();
  return docRef.id;
}

async function updateWalletBalance(walletAddress: string, delta: number, field: string, batch: any) {
  const q = query(collection(db, 'users'), where('walletAddress', '==', walletAddress), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    batch.update(snap.docs[0].ref, { [`ulcBalance.${field}`]: increment(delta) });
    if (delta < 0) batch.update(snap.docs[0].ref, { totalSpent: increment(Math.abs(delta)) });
    else batch.update(snap.docs[0].ref, { totalEarnings: increment(delta) });
  }
}

export async function triggerGenesisAllocation(user: UserProfile) {
  const amount = 50000;
  const startTime = Date.now();
  
  const schedule: Omit<VestingSchedule, 'id'> = {
    uid: user.uid,
    totalAmount: amount,
    claimedAmount: 0,
    startTime,
    durationMonths: 36, 
    type: 'team'
  };

  const scheduleRef = await addDoc(collection(db, 'vesting'), schedule);
  
  await recordTransaction({
    fromWallet: 'team_vesting_wallet',
    toWallet: user.walletAddress,
    amount: amount,
    currency: 'ULC',
    type: 'genesis_allocation',
    referenceId: scheduleRef.id
  });

  await updateDoc(doc(db, 'users', user.uid), { 'ulcBalance.locked': increment(amount) });
}

export async function seedMuses() {
  const muses: Omit<AIMuse, 'id'>[] = [
    { name: 'Isabella AI', category: 'Digital Fashion', personality: 'Sophisticated', tone: 'Elegant', flirtingLevel: 'low', avatar: 'https://picsum.photos/seed/isabella/600/800', isOfficial: true },
    { name: 'Elena Cyber', category: 'Wellness', personality: 'Energetic', tone: 'Motivating', flirtingLevel: 'medium', avatar: 'https://picsum.photos/seed/elena/600/800', isOfficial: true },
    { name: 'Chloe Play', category: 'Gaming', personality: 'Witty', tone: 'Playful', flirtingLevel: 'high', avatar: 'https://picsum.photos/seed/chloe/600/800', isOfficial: true }
  ];

  const batch = writeBatch(db);
  for (const m of muses) {
    const ref = doc(collection(db, 'ai_muses'));
    batch.set(ref, { id: ref.id, ...m });
  }
  await batch.commit();
}

export async function buyULC(user: UserProfile, usdtAmount: number) {
  const config = await getSystemConfig();
  const rate = config?.internal_ulc_purchase_price || 0.015;
  const ulcAmount = usdtAmount / rate;

  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'treasury_usdt_ledger', amount: usdtAmount, currency: 'USDT', type: 'ulc_purchase' });
  await recordTransaction({ fromWallet: 'presale_pool', toWallet: user.walletAddress, amount: ulcAmount, currency: 'ULC', type: 'ulc_purchase' });

  return ulcAmount;
}

export async function handlePremiumUnlock(user: UserProfile, creatorWallet: string, amount: number, contentId: string) {
  const creatorShare = amount * 0.95;
  const stakingShare = amount * 0.025;
  const treasuryShare = amount * 0.025;

  await recordTransaction({ fromWallet: user.walletAddress, toWallet: creatorWallet, amount: creatorShare, currency: 'ULC', type: 'premium_unlock', referenceId: contentId });
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'staking_pool', amount: stakingShare, currency: 'ULC', type: 'staking_reward', referenceId: contentId });
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'treasury_wallet', amount: treasuryShare, currency: 'ULC', type: 'premium_unlock', referenceId: contentId });
}

export async function processChatFee(user: UserProfile) {
  const config = await getSystemConfig();
  const fee = config?.ai_chat_cost || 0.5;
  if (user.ulcBalance.available < fee) throw new Error("Insufficient ULC.");
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'burn_pool', amount: fee, currency: 'ULC', type: 'ai_chat_fee' });
}

export function calculateVestingClaimable(schedule: VestingSchedule): number {
  const elapsed = Date.now() - schedule.startTime;
  const totalDuration = schedule.durationMonths * 30 * 24 * 60 * 60 * 1000;
  if (elapsed <= 0) return 0;
  if (elapsed >= totalDuration) return schedule.totalAmount - schedule.claimedAmount;
  const vestedAmount = (elapsed / totalDuration) * schedule.totalAmount;
  return Math.max(0, vestedAmount - schedule.claimedAmount);
}

export async function claimVestedTokens(user: UserProfile, schedule: VestingSchedule) {
  const claimable = calculateVestingClaimable(schedule);
  if (claimable <= 0) throw new Error("No tokens claimable.");
  const batch = writeBatch(db);
  batch.update(doc(db, 'vesting', schedule.id), { claimedAmount: increment(claimable) });
  batch.update(doc(db, 'users', user.uid), { 'ulcBalance.available': increment(claimable), 'ulcBalance.locked': increment(-claimable) });
  await batch.commit();
  await recordTransaction({ fromWallet: 'team_vesting_pool', toWallet: user.walletAddress, amount: claimable, currency: 'ULC', type: 'vesting_claim', referenceId: schedule.id });
}

export async function handleStaking(user: UserProfile, amount: number) {
  if (user.ulcBalance.available < amount) throw new Error("Insufficient balance.");
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.uid), { 'ulcBalance.available': increment(-amount), 'ulcBalance.locked': increment(amount) });
  await batch.commit();
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'staking_pool', amount: amount, currency: 'ULC', type: 'admin_adjustment', metadata: { action: 'stake' } });
}

export async function handleUnstaking(user: UserProfile, amount: number) {
  if (user.ulcBalance.locked < amount) throw new Error("Insufficient balance.");
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.uid), { 'ulcBalance.available': increment(amount), 'ulcBalance.locked': increment(-amount) });
  await batch.commit();
  await recordTransaction({ fromWallet: 'staking_pool', toWallet: user.walletAddress, amount: amount, currency: 'ULC', type: 'admin_adjustment', metadata: { action: 'unstake' } });
}

export async function toggleUserFreeze(uid: string, status: boolean) {
  await updateDoc(doc(db, 'users', uid), { isFrozen: status });
}

export async function handleSubscription(user: UserProfile, creatorWallet: string, amount: number, creatorId: string) {
  const config = await getSystemConfig();
  const buybackRatio = config?.subscription_buyback_ratio || 0.5;
  const treasuryRatio = config?.subscription_treasury_ratio || 0.5;

  await recordTransaction({ fromWallet: user.walletAddress, toWallet: creatorWallet, amount: amount * 0.9, currency: 'USDT', type: 'subscription_payment', referenceId: creatorId });
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'treasury_usdt_ledger', amount: amount * 0.1 * treasuryRatio, currency: 'USDT', type: 'subscription_payment', referenceId: creatorId });
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'burn_pool', amount: amount * 0.1 * buybackRatio, currency: 'USDT', type: 'subscription_payment', referenceId: creatorId });
  await addDoc(collection(db, 'subscriptions'), { userId: user.uid, creatorId, amount, status: 'active', createdAt: Date.now() });
}

export async function handleTipping(user: UserProfile, toWallet: string, amount: number, referenceId: string) {
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: toWallet, amount, currency: 'ULC', type: 'tip', referenceId });
}

export async function handleCreatorWithdrawal(user: UserProfile, amount: number) {
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'treasury_wallet', amount, currency: 'ULC', type: 'creator_payout' });
}