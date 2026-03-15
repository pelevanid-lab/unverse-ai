import { db } from './firebase';
import { 
  doc, setDoc, collection, addDoc, updateDoc, 
  increment, getDoc, query, where, getDocs, 
  limit, writeBatch 
} from 'firebase/firestore';
import { LedgerEntry, SystemConfig, UserProfile, AIMuse, VestingSchedule, SystemWalletType } from './types';

const CONFIG_DOC_PATH = 'config/system';

export const SYSTEM_WALLETS: SystemWalletType[] = [
  'genesis_wallet', 'treasury_wallet', 'reserve_pool', 'burn_pool', 
  'staking_pool', 'creator_incentives', 'team_vesting', 'liquidity_pool',
  'marketing_wallet', 'exchange_liquidity', 'presale_vault', 'platform_ops',
  'buyback_vault', 'community_grants', 'security_reserve', 'ai_muse_vault', 'advisory_pool'
];

export async function getSystemConfig(): Promise<SystemConfig | null> {
  const docRef = doc(db, CONFIG_DOC_PATH);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as SystemConfig) : null;
}

export async function initializeSystemConfig(adminAddress: string) {
  const existing = await getSystemConfig();
  if (existing) throw new Error("System already initialized.");

  const walletMap: Record<string, string> = {};
  SYSTEM_WALLETS.forEach(w => {
    walletMap[w] = `0xSYS_${w.toUpperCase()}`;
  });

  const config: SystemConfig = {
    admin_wallet_address: adminAddress,
    genesis_initialized: true,
    ulc_presale_price: 0.01,
    internal_ulc_purchase_price: 0.015,
    ai_chat_cost: 0.5,
    premium_unlock_commission: 0.05,
    subscription_split: { creator: 0.9, platform: 0.1 },
    wallets: walletMap as any
  };

  const batch = writeBatch(db);
  batch.set(doc(db, CONFIG_DOC_PATH), config);

  // Initialize all 17 system wallet balances in /system_wallets
  SYSTEM_WALLETS.forEach(w => {
    batch.set(doc(db, 'system_wallets', w), {
      address: walletMap[w],
      balance: w === 'genesis_wallet' ? 100000000 : 
               w === 'reserve_pool' ? 420000000 : 
               w === 'team_vesting' ? 130000000 :
               w === 'creator_incentives' ? 120000000 : 0,
      currency: 'ULC',
      updatedAt: Date.now()
    });
  });

  await batch.commit();

  // Record Genesis Block in Ledger
  await recordTransaction({
    fromWallet: 'GENESIS_PROTOCOL',
    toWallet: walletMap.genesis_wallet,
    amount: 100000000,
    currency: 'ULC',
    type: 'genesis_allocation',
    metadata: { info: 'Initial supply distribution' }
  });

  return config;
}

export async function recordTransaction(entry: Omit<LedgerEntry, 'timestamp' | 'id'>) {
  const timestamp = Date.now();
  const batch = writeBatch(db);
  const ledgerRef = collection(db, 'ledger');
  
  const docRef = doc(ledgerRef);
  batch.set(docRef, { ...entry, timestamp });

  if (entry.currency === 'ULC') {
    // Update Source
    const fromSys = SYSTEM_WALLETS.find(w => `0xSYS_${w.toUpperCase()}` === entry.fromWallet || w === entry.fromWallet);
    if (fromSys) {
      batch.update(doc(db, 'system_wallets', fromSys), { balance: increment(-entry.amount), updatedAt: timestamp });
    } else {
      await updateWalletBalance(entry.fromWallet, -entry.amount, 'available', batch);
    }

    // Update Destination
    const toSys = SYSTEM_WALLETS.find(w => `0xSYS_${w.toUpperCase()}` === entry.toWallet || w === entry.toWallet);
    if (toSys) {
      batch.update(doc(db, 'system_wallets', toSys), { balance: increment(entry.amount), updatedAt: timestamp });
    } else {
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
    durationMonths: 24,
    type: 'team'
  };

  const scheduleRef = await addDoc(collection(db, 'vesting'), schedule);
  
  await recordTransaction({
    fromWallet: 'team_vesting',
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

  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'treasury_wallet', amount: usdtAmount, currency: 'USDT', type: 'ulc_purchase' });
  await recordTransaction({ fromWallet: 'genesis_wallet', toWallet: user.walletAddress, amount: ulcAmount, currency: 'ULC', type: 'ulc_purchase' });

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
  await recordTransaction({ fromWallet: 'team_vesting', toWallet: user.walletAddress, amount: claimable, currency: 'ULC', type: 'vesting_claim', referenceId: schedule.id });
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
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: creatorWallet, amount: amount * 0.9, currency: 'USDT', type: 'subscription_payment', referenceId: creatorId });
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'treasury_wallet', amount: amount * 0.05, currency: 'USDT', type: 'subscription_payment', referenceId: creatorId });
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'buyback_vault', amount: amount * 0.05, currency: 'USDT', type: 'subscription_payment', referenceId: creatorId });
  await addDoc(collection(db, 'subscriptions'), { userId: user.uid, creatorId, amount, status: 'active', createdAt: Date.now() });
}

export async function handleTipping(user: UserProfile, toWallet: string, amount: number, referenceId: string) {
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: toWallet, amount, currency: 'ULC', type: 'tip', referenceId });
}

export async function handleCreatorWithdrawal(user: UserProfile, amount: number) {
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: 'platform_ops', amount, currency: 'ULC', type: 'creator_payout' });
}
