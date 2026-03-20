
import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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
import { getSystemConfig, recordTransaction, grantWelcomeBonus } from '@/lib/ledger';

let isUserCreationInProgress = false;

export function useWallet() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  const { open } = useWeb3Modal();
  const { address: rawAddress, isConnected, isDisconnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  const address = rawAddress?.toLowerCase();

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

  useEffect(() => {
    if (!address || !firebaseUser) {
      setUser(null);
       if (isDisconnected) {
         setLoading(false);
       } else {
         setTimeout(() => setLoading(false), 1000); 
       }
      return;
    }

    const userDocRef = doc(db, 'users', address);

    const findOrCreateProfile = async () => {
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as UserProfile;
        if (!userData.welcomeBonusClaimed) {
          const ledgerQuery = query(collection(db, 'ledger'), where('toWallet', '==', address), where('type', '==', 'welcome_bonus'), limit(1));
          const ledgerSnap = await getDocs(ledgerQuery);
          if (ledgerSnap.empty) {
            try {
               await grantWelcomeBonus(address);
            } catch (error) {
              console.error("Error granting retroactive welcome bonus:", error);
            }
          } else {
            await updateDoc(userDocRef, { welcomeBonusClaimed: true });
          }
        }
        return;
      }

      if (isUserCreationInProgress) {
        return;
      }
      isUserCreationInProgress = true;

      try {
        const legacyQuery = query(collection(db, 'users'), where('walletAddress', 'in', [address, rawAddress]), orderBy('createdAt', 'asc'));
        const legacyDocs = await getDocs(legacyQuery);

        if (!legacyDocs.empty) {
          // Legacy migration logic (omitted)
        } else {
          // === THE FIX ===
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
            welcomeBonusClaimed: true, 
            unlockedPostIds: [],
            activeSubscriptionIds: [],
          };
          await setDoc(userDocRef, newUserProfile);

          try {
            await grantWelcomeBonus(address);
          } catch (error) {
            console.error("Error granting initial welcome bonus:", error);
          }
        }
      } catch (error) {
        console.error("Error during user creation:", error);
      } finally {
        isUserCreationInProgress = false;
      }
    };

    const unsubscribeSnapshot = onSnapshot(userDocRef, (snapshot) => {
      setUser(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
      setLoading(false);
    });

    findOrCreateProfile();

    return () => unsubscribeSnapshot();
  }, [address, rawAddress, firebaseUser, isDisconnected]);

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
