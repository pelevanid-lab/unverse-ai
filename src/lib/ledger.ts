import { db } from './firebase';
import { doc, setDoc, collection, addDoc, updateDoc, increment, getDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { LedgerEntry, LedgerTransactionType } from './types';

export async function recordTransaction(entry: Omit<LedgerEntry, 'id' | 'timestamp'>) {
  const timestamp = Date.now();
  const ledgerRef = collection(db, 'ledger');
  const newDoc = await addDoc(ledgerRef, {
    ...entry,
    timestamp
  });

  // Update balances (simplified logic for prototype)
  if (entry.currency === 'ULC') {
    if (entry.fromWallet !== 'system') {
      await updateWalletBalance(entry.fromWallet, -entry.amount, 'ULC');
    }
    if (entry.toWallet !== 'system') {
      await updateWalletBalance(entry.toWallet, entry.amount, 'ULC');
    }
  }

  return newDoc.id;
}

async function updateWalletBalance(walletAddress: string, delta: number, currency: 'ULC' | 'USDT') {
  // Logic to find user by wallet and update their cached balance
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('walletAddress', '==', walletAddress), limit(1));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const userDoc = snap.docs[0];
    await updateDoc(userDoc.ref, {
      'ulcBalance.available': increment(delta)
    });
  }
}

export async function getSystemConfig() {
  const docRef = doc(db, 'config', 'system');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data();
  }
  return null;
}

export async function buyULC(walletAddress: string, usdtAmount: number) {
  const config = await getSystemConfig();
  const price = config?.internal_ulc_purchase_price || 0.015;
  const ulcAmount = usdtAmount / price;

  await recordTransaction({
    fromWallet: walletAddress,
    toWallet: config?.treasury_wallet_address || 'treasury',
    amount: usdtAmount,
    currency: 'USDT',
    type: 'ulc_purchase'
  });

  await recordTransaction({
    fromWallet: 'reserve_pool',
    toWallet: walletAddress,
    amount: ulcAmount,
    currency: 'ULC',
    type: 'ulc_purchase'
  });

  return ulcAmount;
}