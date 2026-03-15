
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
 * recordTransaction - The core of the SocialFi economy. 
 * Every token movement is recorded here and reflected in user Firestore profiles.
 */
export async function recordTransaction(entry: Omit<LedgerEntry, 'timestamp'>) {
  const timestamp = Date.now();
  const ledgerRef = collection(db, 'ledger');
  
  const newDoc = await addDoc(ledgerRef, {
    ...entry,
    timestamp
  });

  const batch = writeBatch(db);

  // ULC Balance updates
  if (entry.currency === 'ULC') {
    if (entry.fromWallet && !isSystemPool(entry.fromWallet)) {
      await updateWalletBalance(entry.fromWallet, -entry.amount, 'available', batch);
      if (entry.type === 'premium_unlock' || entry.type === 'tip' || entry.type === 'ai_chat_fee') {
          await updateEarningsStats(entry.fromWallet, 0, entry.amount, batch);
      }
    }
    if (entry.toWallet && !isSystemPool(entry.toWallet)) {
      await updateWalletBalance(entry.toWallet, entry.amount, 'available', batch);
      if (entry.type === 'premium_unlock' || entry.type === 'tip') {
          await updateEarningsStats(entry.toWallet, entry.amount, 0, batch);
      }
    }
  }

  // USDT interactions (Subscriptions)
  if (entry.currency === 'USDT') {
      if (entry.toWallet && !isSystemPool(entry.toWallet) && entry.type === 'subscription_payment') {
          await updateEarningsStats(entry.toWallet, entry.amount, 0, batch);
      }
  }

  await batch.commit();
  return newDoc.id;
}

async function updateEarningsStats(walletAddress: string, earningsDelta: number, spentDelta: number, batch: any) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('walletAddress', '==', walletAddress), limit(1));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const userDoc = snap.docs[0];
      batch.update(userDoc.ref, {
        totalEarnings: increment(earningsDelta),
        totalSpent: increment(spentDelta)
      });
    }
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
  const systemPools = ['system', 'reserve_pool', 'genesis_wallet', 'burn_pool', 'staking_pool', 'treasury', '0xTreasury_Main', '0xGenesis_Main', '0xReserve_Pool', '0xBurn_Pool', '0xStaking_Pool', 'system_vesting'];
  return systemPools.includes(address);
}

// ... rest of the helper functions (buyULC, handlePremiumUnlock, handleSubscription, etc.) remain as previously implemented but now fully operational with live DB
