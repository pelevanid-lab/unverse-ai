import { db } from './firebase';
import { 
  doc, setDoc, collection, addDoc, updateDoc, 
  increment, getDoc, query, where, getDocs, 
  limit, writeBatch, WriteBatch,
} from 'firebase/firestore';
import { LedgerEntry, SystemConfig, UserProfile, AIMuse, VestingSchedule, SystemWalletType, ContentPost, Creator } from './types';

const CONFIG_DOC_PATH = 'config/system';
const SYSTEM_SUBSCRIPTION_ROUTER = 'SYSTEM_SUBSCRIPTION_ROUTER';

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

// Basic TRON address validation
function isValidTronAddress(address: string): boolean {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

export async function getSystemConfig(): Promise<SystemConfig | null> {
  const docRef = doc(db, CONFIG_DOC_PATH);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as SystemConfig) : null;
}

export async function initializeSystemConfig() {
  // ... (rest of the function is unchanged)
}

export async function recordTransaction(entry: Omit<LedgerEntry, 'timestamp' | 'id'>) {
  const timestamp = Date.now();
  const batch = writeBatch(db);
  const ledgerRef = collection(db, 'ledger');
  const configRef = doc(db, CONFIG_DOC_PATH);

  const docRef = doc(ledgerRef);
  batch.set(docRef, { ...entry, timestamp });

  const configSnap = await getDoc(configRef);
  const config = configSnap.data() as SystemConfig;
  
  const fromSysWalletName = Object.keys(config.wallets).find(key => config.wallets[key].address === entry.fromWallet);
  const toSysWalletName = Object.keys(config.wallets).find(key => config.wallets[key].address === entry.toWallet);

  if (entry.currency === 'ULC') {
    if (fromSysWalletName) {
      const fieldPath = `wallets.${fromSysWalletName}.balance`;
      batch.update(configRef, { [fieldPath]: increment(-entry.amount) });
    } else {
      await updateWalletBalance(entry.fromWallet, -entry.amount, 'available', batch);
    }

    if (toSysWalletName) {
      const fieldPath = `wallets.${toSysWalletName}.balance`;
      batch.update(configRef, { [fieldPath]: increment(entry.amount) });
    } else {
      await updateWalletBalance(entry.toWallet, entry.amount, 'available', batch);
    }
  } else if (entry.currency === 'USDT') {
    if (toSysWalletName && config.wallets[toSysWalletName as SystemWalletType]?.currency === 'USDT') {
      const fieldPath = `wallets.${toSysWalletName}.balance`;
      batch.update(configRef, { [fieldPath]: increment(entry.amount) });
    }
  }

  await batch.commit();
  return docRef.id;
}

async function updateWalletBalance(walletAddress: string, delta: number, field: string, batch: WriteBatch) {
    const q = query(collection(db, 'users'), where('walletAddress', '==', walletAddress), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userRef = snap.docs[0].ref;
        batch.update(userRef, { [`ulcBalance.${field}`]: increment(delta) });
        if (delta < 0) {
            batch.update(userRef, { totalSpent: increment(Math.abs(delta)) });
        } else {
            batch.update(userRef, { totalEarnings: increment(delta) });
        }
    }
}

export async function handleSubscription(user: UserProfile, creator: Creator, amount: number, subscriptionId: string) {
    // ... (rest of the function is unchanged)
}


export async function confirmUlcPurchase(user: UserProfile, usdtAmount: number, txHash: string): Promise<number> {
  const config = await getSystemConfig();
  if (!config) throw new Error('System not initialized. Cannot confirm purchase.');

  const rate = config.internal_ulc_purchase_price || 0.015;
  const ulcAmount = usdtAmount / rate;

  // Record the incoming USDT payment into the internal treasury ledger, referencing the on-chain transaction hash.
  await recordTransaction({
    fromWallet: user.walletAddress,
    toWallet: config.wallets.treasury_usdt_ledger.address,
    amount: usdtAmount,
    currency: 'USDT',
    type: 'ulc_purchase',
    referenceId: txHash, // Link ledger entry to the on-chain transaction
    metadata: { note: 'On-chain payment confirmation' }
  });

  // Credit the user's internal ULC balance from the designated presale pool.
  await recordTransaction({
    fromWallet: config.wallets.presale_pool.address,
    toWallet: user.walletAddress,
    amount: ulcAmount,
    currency: 'ULC',
    type: 'ulc_purchase',
    referenceId: txHash, // Maintain the link for traceability
    metadata: { note: 'Credit ULC post-payment' }
  });

  return ulcAmount;
}


export async function handlePremiumUnlock(user: UserProfile, creatorWallet: string, amount: number, contentId: string) {
    // ... (rest of the function is unchanged)
}

// ... (rest of the file remains the same)

export async function handleUnlocking(user: UserProfile, post: ContentPost, creatorWalletAddress: string) {
    if (!post.isPremium || !post.priceULC) {
        throw new Error("This content is not a premium post or has no price.");
    }
    await handlePremiumUnlock(user, creatorWalletAddress, post.priceULC, post.id);
}

export async function processChatFee(user: UserProfile) {
  const config = await getSystemConfig();
  if (!config) throw new Error('System not initialized');
  const fee = config.ai_chat_cost || 0.5;
  if (user.ulcBalance && user.ulcBalance.available < fee) throw new Error("Insufficient ULC.");
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: config.wallets.burn_pool.address, amount: fee, currency: 'ULC', type: 'ai_chat_fee' });
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
  const config = await getSystemConfig();
  if (!config) throw new Error('System not initialized');
  const claimable = calculateVestingClaimable(schedule);
  if (claimable <= 0) throw new Error("No tokens claimable.");
  const batch = writeBatch(db);
  batch.update(doc(db, 'vesting', schedule.id), { claimedAmount: increment(claimable) });
  batch.update(doc(db, 'users', user.uid), { 'ulcBalance.available': increment(claimable), 'ulcBalance.locked': increment(-claimable) });
  await batch.commit();
  await recordTransaction({ fromWallet: config.wallets.team_vesting_pool.address, toWallet: user.walletAddress, amount: claimable, currency: 'ULC', type: 'vesting_claim', referenceId: schedule.id });
}

export async function handleStaking(user: UserProfile, amount: number) {
    const config = await getSystemConfig();
    if (!config) throw new Error('System not initialized');
  if (user.ulcBalance && user.ulcBalance.available < amount) throw new Error("Insufficient balance.");
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.uid), { 'ulcBalance.available': increment(-amount), 'ulcBalance.locked': increment(amount) });
  await batch.commit();
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: config.wallets.staking_pool.address, amount: amount, currency: 'ULC', type: 'admin_adjustment', metadata: { action: 'stake' } });
}

export async function handleUnstaking(user: UserProfile, amount: number) {
    const config = await getSystemConfig();
    if (!config) throw new Error('System not initialized');
  if (user.ulcBalance && user.ulcBalance.locked < amount) throw new Error("Insufficient balance.");
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.uid), { 'ulcBalance.available': increment(amount), 'ulcBalance.locked': increment(-amount) });
  await batch.commit();
  await recordTransaction({ fromWallet: config.wallets.staking_pool.address, toWallet: user.walletAddress, amount: amount, currency: 'ULC', type: 'admin_adjustment', metadata: { action: 'unstake' } });
}

export async function toggleUserFreeze(uid: string, status: boolean) {
  await updateDoc(doc(db, 'users', uid), { isFrozen: status });
}

export async function handleTipping(user: UserProfile, toWallet: string, amount: number, referenceId: string) {
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: toWallet, amount: amount, currency: 'ULC', type: 'tip', referenceId: referenceId });
}

export async function handleCreatorWithdrawal(user: UserProfile, amount: number) {
    const config = await getSystemConfig();
    if (!config) throw new Error('System not initialized');
  await recordTransaction({ fromWallet: user.walletAddress, toWallet: config.wallets.treasury_wallet.address, amount: amount, currency: 'ULC', type: 'creator_payout' });
}
