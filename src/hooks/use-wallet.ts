import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import {
  doc,
  setDoc,
  onSnapshot,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  orderBy,
  writeBatch,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useDisconnect } from 'wagmi';
import { UserProfile } from '@/lib/types';
import { getSystemConfig, recordTransaction } from '@/lib/ledger';

// Module-level lock to prevent race conditions from React Strict Mode double-invoking effects.
// A useRef hook is tied to the component instance and does not survive unmount/remount.
let isUserCreationInProgress = false;

/**
 * useWallet - Manages user authentication, profile creation, and the one-time welcome bonus.
 */
export function useWallet() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const { open } = useWeb3Modal();
  const { address: rawAddress, isConnected, isDisconnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  const address = rawAddress?.toLowerCase();

  // Effect 1: Manage anonymous Firebase session.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
      } else {
        signInAnonymously(auth).catch(error => console.error("Anonymous sign-in failed:", error));
      }
    });
    return () => unsubscribe();
  }, []);

  // Effect 2: Core logic for finding, creating, and granting welcome bonus to users.
  useEffect(() => {
    if (!address || !firebaseUser) {
      setUser(null);
      if (isDisconnected) setLoading(false);
      return;
    }

    const userDocRef = doc(db, 'users', address);

    const findOrCreateProfile = async () => {
      const userDocSnap = await getDoc(userDocRef);

      // --- USER EXISTS ---
      // This block handles existing users. It includes a check to retroactively grant
      // the welcome bonus if it was missed for any reason.
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as UserProfile;

        // IDEMPOTENCY CHECK: Only proceed if the user flag isn't set.
        if (!userData.welcomeBonusClaimed) {
          console.log(`User ${address} found, checking for missing welcome bonus.`);
          
          // LEDGER CHECK: Before granting, verify no 'welcome_bonus' transaction exists.
          const ledgerQuery = query(collection(db, 'ledger'), where('toWallet', '==', address), where('type', '==', 'welcome_bonus'), limit(1));
          const ledgerSnap = await getDocs(ledgerQuery);

          if (ledgerSnap.empty) {
            console.log(`No bonus transaction found for ${address}. Granting now.`);
            try {
              const config = await getSystemConfig();
              if (config?.wallets.promo_pool) {
                await recordTransaction({
                  fromWallet: config.wallets.promo_pool.address,
                  toWallet: address,
                  amount: 100,
                  currency: 'ULC',
                  type: 'welcome_bonus',
                });
                await updateDoc(userDocRef, { welcomeBonusClaimed: true });
                console.log(`Retroactive welcome bonus granted to ${address}.`);
              }
            } catch (error) {
              console.error("Error granting retroactive welcome bonus:", error);
            }
          } else {
            // Data inconsistency: Ledger has the transaction, but the user flag is false. Fix it.
            console.log(`Bonus transaction found for ${address}, but flag was missing. Correcting flag.`);
            await updateDoc(userDocRef, { welcomeBonusClaimed: true });
          }
        }
        return;
      }

      // --- NEW USER CREATION ---
      // This block is protected by a module-level lock to prevent race conditions.
      if (isUserCreationInProgress) {
        console.log("User creation already in progress. Skipping duplicate request.");
        return;
      }
      isUserCreationInProgress = true;
      
      console.log(`Starting creation process for new user ${address}.`);

      try {
        const legacyQuery = query(collection(db, 'users'), where('walletAddress', 'in', [address, rawAddress]), orderBy('createdAt', 'asc'));
        const legacyDocs = await getDocs(legacyQuery);

        if (!legacyDocs.empty) {
          // Legacy migration logic (omitted for brevity)
        } else {
          console.log(`No legacy profile for ${address}. Creating new profile.`);
          const newUserProfile: UserProfile = {
            uid: address,
            walletAddress: address,
            username: `Explorer_${address.slice(2, 8)}`,
            bio: "New citizen of the Unverse.",
            avatar: `https://i.pravatar.cc/150?u=${address}`,
            ulcBalance: { available: 0, locked: 0, claimable: 0 },
            totalEarnings: 0,
            totalSpent: 0,
            isCreator: false,
            createdAt: Date.now(),
            welcomeBonusClaimed: true, // Set flag immediately as part of creation
          };
          await setDoc(userDocRef, newUserProfile);
          console.log(`Profile created for ${address}. Now granting welcome bonus.`);

          const config = await getSystemConfig();
          if (config?.wallets.promo_pool) {
            await recordTransaction({
              fromWallet: config.wallets.promo_pool.address,
              toWallet: address,
              amount: 100,
              currency: 'ULC',
              type: 'welcome_bonus',
            });
            console.log(`Welcome bonus of 100 ULC granted to ${address}.`);
          }
        }
      } catch (error) {
        console.error("Error during user creation and bonus grant:", error);
      } finally {
        isUserCreationInProgress = false;
        console.log(`Creation process finished for ${address}.`);
      }
    };

    const unsubscribeSnapshot = onSnapshot(userDocRef, (snapshot) => {
      setUser(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
      setLoading(false);
    });

    findOrCreateProfile();

    return () => unsubscribeSnapshot();
  }, [address, rawAddress, firebaseUser, isDisconnected]);

  // Effect 3: Handle wallet disconnection.
  useEffect(() => {
    if (isDisconnected) {
      setUser(null);
    }
  }, [isDisconnected]);

  const connectWallet = () => open();
  const disconnectWallet = () => disconnect();

  return {
    user,
    loading,
    connectWallet,
    disconnectWallet,
    isConnected: !!user && isConnected,
    walletAddress: user?.walletAddress || '',
    rawAddress: rawAddress,
    ulcBalance: user?.ulcBalance?.available || 0,
    lockedULC: user?.ulcBalance?.locked || 0,
    claimableULC: user?.ulcBalance?.claimable || 0,
  };
}
