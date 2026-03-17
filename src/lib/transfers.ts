
import { firestore } from './firebase';
import { UserProfile, LedgerEntry } from './types';

/**
 * Atomically transfers ULC between two users.
 *
 * @param fromUserId The UID of the user sending ULC.
 * @param toUserId The UID of the user receiving ULC.
 * @param amount The amount of ULC to transfer.
 * @param memo An optional memo for the transaction.
 */
export const transferULC = async (
  fromUserId: string,
  toUserId: string,
  amount: number,
  memo?: string
): Promise<void> => {
  // Block zero or negative amounts
  if (amount <= 0) {
    throw new Error('Transfer amount must be positive.');
  }

  // Block self-transfers
  if (fromUserId === toUserId) {
    throw new Error('Sender and receiver cannot be the same user.');
  }

  const fromUserRef = firestore.doc(`users/${fromUserId}`);
  const toUserRef = firestore.doc(`users/${toUserId}`);
  const ledgerRef = firestore.collection('ledger').doc();

  try {
    await firestore.runTransaction(async (transaction) => {
      const [fromUserDoc, toUserDoc] = await Promise.all([
        transaction.get(fromUserRef),
        transaction.get(toUserRef),
      ]);

      if (!fromUserDoc.exists) {
        throw new Error(`Sender with user ID ${fromUserId} not found.`);
      }
      if (!toUserDoc.exists) {
        throw new Error(`Receiver with user ID ${toUserId} not found.`);
      }

      const fromUserData = fromUserDoc.data() as UserProfile;
      const toUserData = toUserDoc.data() as UserProfile;

      // Ensure balance check happens inside the transaction
      if (fromUserData.ulcBalance.available < amount) {
        throw new Error('Insufficient ULC balance.');
      }

      // All writes (ledger + balances) are in the same transaction

      // Create ledger entry, ensuring walletAddress is used
      const ledgerEntry: Omit<LedgerEntry, 'id'> = {
        type: 'internal_ulc_transfer',
        amount,
        currency: 'ULC',
        fromWallet: fromUserData.walletAddress,
        toWallet: toUserData.walletAddress,
        fromUserId,
        toUserId,
        memo,
        timestamp: Date.now(),
      };
      transaction.set(ledgerRef, ledgerEntry);

      // Update sender's balance
      transaction.update(fromUserRef, {
        'ulcBalance.available': fromUserData.ulcBalance.available - amount,
      });

      // Update receiver's balance
      transaction.update(toUserRef, {
        'ulcBalance.available': (toUserData.ulcBalance.available || 0) + amount,
      });
    });

    console.log(
      `Successfully transferred ${amount} ULC from ${fromUserId} to ${toUserId}`
    );
  } catch (error) {
    console.error('ULC transfer failed:', error);
    throw error; // Re-throw original error for the caller to handle
  }
};
